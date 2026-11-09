create or replace function planner_private.write_timetable(sid uuid,w date,cells jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin

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
create function public.save_coach_timetable(s uuid,w date,cells jsonb) returns void language plpgsql security definer set search_path='' as $$begin if auth.uid() is null or not public.is_coach(s) then raise exception '담당 학생의 시간표만 수정할 수 있습니다';end if;perform planner_private.write_timetable(s,w,cells);end$$;
revoke all on function public.save_coach_timetable(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.save_coach_timetable(uuid,date,jsonb) to authenticated;
create or replace function public.student_portal_update(token text,action text,payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;st int;p public.weekly_plans;t public.tasks;pid uuid;d date;
begin
 sid:=planner_private.resolve_student(token);
 select stage into st from public.profiles where id=sid;
 if action='check' then
  if payload->>'status' is null or payload->>'status' not in('done','incomplete','unreported') then raise exception '기록 상태가 올바르지 않습니다';end if;
  update public.tasks set status=payload->>'status' where id=(payload->>'id')::uuid and student_id=sid and not cancelled and due_date<=(now() at time zone 'Asia/Seoul')::date;
  if not found then raise exception '본인의 오늘 또는 과거 과제만 기록할 수 있습니다';end if;
 elsif action='note' then
  if jsonb_typeof(payload->'note') is distinct from 'string' or length(payload->>'note')>2000 then raise exception '메모는 2000자 이내로 입력해 주세요';end if;
  update public.tasks set student_note=payload->>'note' where id=(payload->>'id')::uuid and student_id=sid and not cancelled;
  if not found then raise exception '본인의 과제에만 메모를 저장할 수 있습니다';end if;
 elsif action='sharing' then
  if jsonb_typeof(payload->'agreed') is distinct from 'boolean' then raise exception '공유 의사를 확인하세요';end if;
  insert into public.sharing_preferences(student_id,student_agreed) values(sid,(payload->>'agreed')::boolean)
  on conflict(student_id) do update set student_agreed=excluded.student_agreed;
 elsif action='plan' then
  if st<>3 then raise exception '주간 목표 작성 권한이 없습니다';end if;
  select * into p from public.weekly_plans where student_id=sid and week_start=(payload->>'week')::date for update;

  insert into public.weekly_plans(student_id,week_start,goal) values(sid,(payload->>'week')::date,left(coalesce(payload->>'goal',''),2000))
  on conflict(student_id,week_start) do update set goal=excluded.goal;
 elsif action='task' then
  if st<2 then raise exception '일일 계획 수정 권한이 없습니다';end if;
  if nullif(payload->>'plan','') is null then
   insert into public.weekly_plans(student_id,week_start) values(sid,(payload->>'week')::date) on conflict(student_id,week_start) do nothing;
   select * into p from public.weekly_plans where student_id=sid and week_start=(payload->>'week')::date for update;
  else
   select * into p from public.weekly_plans where id=(payload->>'plan')::uuid and student_id=sid for update;
  end if;
  if p.id is null then raise exception '본인의 주간 계획을 선택하세요';end if;
  if payload ? 'cancel' and jsonb_typeof(payload->'cancel') is distinct from 'boolean' then raise exception '취소 여부를 확인하세요';end if;
  d:=(payload->>'date')::date;
  if d is null or d<p.week_start or d>p.week_start+6 then raise exception '같은 주 날짜를 선택하세요';end if;
  if nullif(payload->>'id','') is null then
   insert into public.tasks(student_id,plan_id,title,description,subject,due_date) values(sid,p.id,payload->>'title',coalesce(payload->>'description',''),payload->>'subject',d);
  else
   select * into t from public.tasks where id=(payload->>'id')::uuid and plan_id=p.id and student_id=sid;
   if t.id is null then raise exception '과제를 찾을 수 없습니다';end if;
   update public.tasks set due_date=d,title=payload->>'title',description=coalesce(payload->>'description',''),subject=payload->>'subject',cancelled=coalesce((payload->>'cancel')::boolean,false) where id=t.id;
  end if;
 else raise exception '지원하지 않는 변경입니다';
 end if;
 insert into public.audit_logs(student_id,entity,new_data) values(sid,'student_portal_action',jsonb_build_object('action',action,'task_id',payload->>'id'));
end$$;

create or replace function public.save_task(p uuid,t uuid,title_text text,detail text,sub text,d date,cancel_task boolean default false) returns void language plpgsql security definer set search_path=public as $$declare plan weekly_plans;st int;previous tasks;begin if auth.uid() is null then raise exception '인증 필요';end if;select * into plan from weekly_plans where id=p for update;select stage into st from profiles where id=auth.uid();if plan.id is null or not (is_coach(plan.student_id) or (auth.uid()=plan.student_id and st>=2)) then raise exception '과제 수정 권한이 없습니다';end if;if d<plan.week_start or d>plan.week_start+6 then raise exception '같은 주의 날짜를 선택하세요';end if;if t is null then insert into tasks(student_id,plan_id,title,description,subject,due_date) values(plan.student_id,p,title_text,detail,sub,d);else select * into previous from tasks where id=t and plan_id=p;if previous.id is null then raise exception '과제를 찾을 수 없습니다';end if;update tasks set title=title_text,description=detail,subject=sub,due_date=d,cancelled=cancel_task where id=t and plan_id=p;end if;end$$;