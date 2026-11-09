-- Keep the legacy boolean parameter for older clients; all new saves are unconfirmed.
create or replace function public.save_plan(s uuid,w date,g text,confirm_plan boolean default false) returns uuid language plpgsql security definer set search_path=public as $$declare p weekly_plans;begin if auth.uid() is null then raise exception '인증 필요';end if;if not is_coach(s) and not (auth.uid()=s and exists(select 1 from profiles where id=s and stage=3)) then raise exception '계획 작성 권한이 없습니다';end if;select * into p from weekly_plans where student_id=s and week_start=w for update;insert into weekly_plans(student_id,week_start,goal,confirmed) values(s,w,left(g,2000),false) on conflict(student_id,week_start) do update set goal=excluded.goal,confirmed=excluded.confirmed returning id into p.id;return p.id;end$$;
create or replace function public.save_task(p uuid,t uuid,title_text text,detail text,sub text,d date,cancel_task boolean default false) returns void language plpgsql security definer set search_path=public as $$declare plan weekly_plans;st int;previous tasks;begin if auth.uid() is null then raise exception '인증 필요';end if;select * into plan from weekly_plans where id=p for update;select stage into st from profiles where id=auth.uid();if plan.id is null or not (is_coach(plan.student_id) or (auth.uid()=plan.student_id and st>=2)) then raise exception '과제 수정 권한이 없습니다';end if;if d<plan.week_start or d>plan.week_start+6 then raise exception '같은 주의 날짜를 선택하세요';end if;if t is null then if not is_coach(plan.student_id) and st<>3 then raise exception '과제 추가 권한이 없습니다';end if;insert into tasks(student_id,plan_id,title,description,subject,due_date) values(plan.student_id,p,title_text,detail,sub,d);else select * into previous from tasks where id=t and plan_id=p;if previous.id is null then raise exception '과제를 찾을 수 없습니다';end if;if not is_coach(plan.student_id) and st=2 and (title_text<>previous.title or detail<>previous.description or sub<>previous.subject or cancel_task<>previous.cancelled) then raise exception '학생은 날짜 배분만 수정할 수 있습니다';end if;update tasks set title=title_text,description=detail,subject=sub,due_date=d,cancelled=cancel_task where id=t and plan_id=p;end if;end$$;
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
  select * into p from public.weekly_plans where id=(payload->>'plan')::uuid and student_id=sid for update;
  if p.id is null or st<2 then raise exception '과제 배분 수정 권한이 없습니다';end if;
  d:=(payload->>'date')::date;
  if d is null or d<p.week_start or d>p.week_start+6 then raise exception '같은 주 날짜를 선택하세요';end if;
  if nullif(payload->>'id','') is null then
   if st<>3 then raise exception '과제 추가 권한이 없습니다';end if;
   insert into public.tasks(student_id,plan_id,title,description,subject,due_date) values(sid,p.id,payload->>'title',coalesce(payload->>'description',''),payload->>'subject',d);
  else
   select * into t from public.tasks where id=(payload->>'id')::uuid and plan_id=p.id and student_id=sid;
   if t.id is null then raise exception '과제를 찾을 수 없습니다';end if;
   update public.tasks set due_date=d,title=case when st=3 then payload->>'title' else title end,
    description=case when st=3 then coalesce(payload->>'description','') else description end,
    subject=case when st=3 then payload->>'subject' else subject end where id=t.id;
  end if;
 else raise exception '지원하지 않는 변경입니다';
 end if;
 insert into public.audit_logs(student_id,entity,new_data) values(sid,'student_portal_action',jsonb_build_object('action',action,'task_id',payload->>'id'));
end$$;
