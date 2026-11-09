alter table public.tasks add column student_note text not null default '' check(length(student_note)<=2000);
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
