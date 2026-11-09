alter table public.student_timetable_cells add column span smallint not null default 1;
alter table public.student_timetable_cells add constraint timetable_span_check check(span between 1 and 24 and (hour+18)%24+span<=24);
alter table public.student_timetable_cells drop constraint student_timetable_cells_content_check;
alter table public.student_timetable_cells add constraint student_timetable_cells_content_check check(length(content) between 0 and 160);
create or replace function public.read_student_timetable(token text,w date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 sid:=planner_private.resolve_student(token);
 if w is null or extract(isodow from w)<>1 then raise exception '주 기준 날짜를 확인하세요';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('day',day,'hour',hour,'content',content,'span',span) order by day,hour)
 from public.student_timetable_cells where student_id=sid and week_start=w),'[]'::jsonb);
end$$;
create or replace function public.save_student_timetable(token text,w date,cells jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;previous jsonb;
begin
 sid:=planner_private.resolve_student(token);
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
 insert into public.audit_logs(student_id,entity,old_data,new_data) values(sid,'student_timetable',previous,jsonb_build_object('week_start',w,'cells',cells));
end$$;
revoke all on function public.read_student_timetable(text,date),public.save_student_timetable(text,date,jsonb) from public,anon,authenticated;
grant execute on function public.read_student_timetable(text,date),public.save_student_timetable(text,date,jsonb) to anon,authenticated;
