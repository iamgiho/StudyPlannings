lock table public.student_timetable_cells in access exclusive mode;
-- Preserve all previous weekly variants in the private coach audit history.
insert into public.audit_logs(student_id,entity,new_data)
 select student_id,'timetable_before_shared',jsonb_agg(to_jsonb(t) order by week_start,day,hour) from public.student_timetable_cells t group by student_id;
with picked as(select distinct on(student_id) student_id,week_start from public.student_timetable_cells t order by student_id,coalesce((select max(a.created_at) from public.audit_logs a where a.student_id=t.student_id and a.entity='student_timetable' and a.new_data->>'week_start'=t.week_start::text),'-infinity'::timestamptz) desc,week_start desc)
delete from public.student_timetable_cells t using picked p where t.student_id=p.student_id and t.week_start<>p.week_start;
update public.student_timetable_cells set week_start='2000-01-03';
create or replace function planner_private.write_timetable(sid uuid,w date,cells jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
 w:=date '2000-01-03';
 if w is null or extract(isodow from w)<>1 then raise exception '주 기준 날짜를 확인하세요';end if;
 if cells is null or jsonb_typeof(cells)<>'array' or jsonb_array_length(cells)>168 then raise exception '시간표 형식을 확인하세요';end if;
 if exists(select 1 from jsonb_array_elements(cells) c where jsonb_typeof(c)<>'object' or jsonb_typeof(c->'day') is distinct from 'number' or jsonb_typeof(c->'hour') is distinct from 'number' or jsonb_typeof(c->'content') is distinct from 'string') then raise exception '시간표 입력값을 확인하세요';end if;
 if exists(select 1 from jsonb_array_elements(cells) c where (c ? 'span' and (jsonb_typeof(c->'span') is distinct from 'number' or (c->>'span')::numeric <> trunc((c->>'span')::numeric))) or (c->>'day')::numeric <> trunc((c->>'day')::numeric) or (c->>'hour')::numeric <> trunc((c->>'hour')::numeric)) then raise exception '시간표 정수를 확인하세요';end if;
 if exists(select 1 from jsonb_to_recordset(cells) as c(day int,hour int,content text,span int) where day is null or day not between 0 and 6 or hour is null or hour not between 0 and 23 or content is null or length(content) not between 0 and 160 or coalesce(span,1) not between 1 and 24 or (hour+18)%24+coalesce(span,1)>24) then raise exception '요일·시간·내용을 확인하세요';end if;
 if exists(select 1 from jsonb_to_recordset(cells) as c(day int,hour int,span int) cross join lateral generate_series((hour+18)%24,(hour+18)%24+coalesce(span,1)-1) as r(n) group by day,n having count(*)>1) then raise exception '시간표 블록이 겹칩니다';end if;
 -- Serialize saves for this student/week, including an initially empty week.
 perform pg_advisory_xact_lock(hashtextextended(sid::text||w::text,0));
 select coalesce(jsonb_agg(jsonb_build_object('day',day,'hour',hour,'content',content,'span',span)),'[]'::jsonb) into previous from public.student_timetable_cells where student_id=sid and week_start=w;
 delete from public.student_timetable_cells where student_id=sid and week_start=w;
 insert into public.student_timetable_cells(student_id,week_start,day,hour,content,span)
 select sid,w,day,hour,content,coalesce(span,1) from jsonb_to_recordset(cells) as c(day smallint,hour smallint,content text,span smallint);
 insert into public.audit_logs(student_id,actor,entity,old_data,new_data) values(sid,auth.uid(),'student_timetable',previous,jsonb_build_object('week_start',w,'cells',cells));
end$$;

revoke all on function planner_private.write_timetable(uuid,date,jsonb) from public,anon,authenticated;
create or replace function public.save_student_timetable(token text,w date,cells jsonb) returns void language plpgsql security definer set search_path='' as $$begin perform planner_private.write_timetable(planner_private.resolve_student(token),w,cells);end$$;
create or replace function public.save_coach_timetable(s uuid,w date,cells jsonb) returns void language plpgsql security definer set search_path='' as $$begin if auth.uid() is null or not public.is_coach(s) then raise exception '담당 학생의 시간표만 수정할 수 있습니다';end if;perform planner_private.write_timetable(s,w,cells);end$$;
revoke all on function public.save_coach_timetable(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.save_coach_timetable(uuid,date,jsonb) to authenticated;
create or replace function public.read_student_timetable(token text,w date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 sid:=planner_private.resolve_student(token);
 w:=date '2000-01-03';
 if w is null or extract(isodow from w)<>1 then raise exception '주 기준 날짜를 확인하세요';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('day',day,'hour',hour,'content',content,'span',span) order by day,hour)
 from public.student_timetable_cells where student_id=sid and week_start=w),'[]'::jsonb);
end$$;

