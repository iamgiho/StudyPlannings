alter table public.weekly_plans add column goal_items jsonb not null default '[]'::jsonb check(jsonb_typeof(goal_items)='array' and jsonb_array_length(goal_items)<=30);
update public.weekly_plans set goal_items=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',goal,'status','unreported')) where length(trim(goal))>0;

create function planner_private.write_weekly_goals(s uuid,w date,items jsonb) returns void
language plpgsql set search_path='' as $$
declare p public.weekly_plans;next_items jsonb;
begin
 if w is null or extract(isodow from w)<>1 or items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>30 then raise exception '주간 목표 형식을 확인하세요';end if;
 if exists(select 1 from jsonb_array_elements(items) c where jsonb_typeof(c)<>'object' or jsonb_typeof(c->'id') is distinct from 'string' or jsonb_typeof(c->'title') is distinct from 'string' or length(trim(c->>'title')) not between 1 and 2000) then raise exception '각 목표는 1~2000자로 입력하세요';end if;
 if exists(select 1 from jsonb_array_elements(items) c group by (c->>'id')::uuid having count(*)>1) then raise exception '목표 ID가 중복되었습니다';end if;
 insert into public.weekly_plans(student_id,week_start) values(s,w) on conflict(student_id,week_start) do nothing;
 select * into p from public.weekly_plans where student_id=s and week_start=w for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',(c->>'id')::uuid,'title',trim(c->>'title'),'status',coalesce((select old->>'status' from jsonb_array_elements(p.goal_items) old where old->>'id'=((c->>'id')::uuid)::text),'unreported')) order by n),'[]'::jsonb)
 into next_items from jsonb_array_elements(items) with ordinality as x(c,n);
 update public.weekly_plans set goal_items=next_items,goal=left(coalesce((select string_agg(c->>'title',E'\n' order by n) from jsonb_array_elements(next_items) with ordinality x(c,n)),''),2000) where id=p.id;
end$$;
revoke all on function planner_private.write_weekly_goals(uuid,date,jsonb) from public,anon,authenticated;
create function public.save_weekly_goals(s uuid,w date,items jsonb) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 목표를 수정할 수 있습니다';end if;perform planner_private.write_weekly_goals(s,w,items);end$$;
revoke all on function public.save_weekly_goals(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.save_weekly_goals(uuid,date,jsonb) to authenticated;

create function planner_private.mark_weekly_goal(s uuid,w date,item_id uuid,value text) returns void language plpgsql set search_path='' as $$
declare p public.weekly_plans;next_items jsonb;
begin
 if value is null or value not in('done','incomplete','not_done') then raise exception '수행 상태를 확인하세요';end if;
 if w is null or w>(now() at time zone 'Asia/Seoul')::date then raise exception '아직 시작하지 않은 주의 목표는 체크할 수 없습니다';end if;
 select * into p from public.weekly_plans where student_id=s and week_start=w for update;
 if p.id is null or not exists(select 1 from jsonb_array_elements(p.goal_items) c where c->>'id'=item_id::text) then raise exception '해당 주의 목표를 찾을 수 없습니다';end if;
 select jsonb_agg(case when c->>'id'=item_id::text then jsonb_set(c,'{status}',to_jsonb(value)) else c end order by n) into next_items from jsonb_array_elements(p.goal_items) with ordinality x(c,n);
 update public.weekly_plans set goal_items=next_items where id=p.id;
end$$;
revoke all on function planner_private.mark_weekly_goal(uuid,date,uuid,text) from public,anon,authenticated;
create function public.check_weekly_goal(s uuid,w date,item_id uuid,value text) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 목표를 체크할 수 있습니다';end if;perform planner_private.mark_weekly_goal(s,w,item_id,value);end$$;
revoke all on function public.check_weekly_goal(uuid,date,uuid,text) from public,anon,authenticated;
grant execute on function public.check_weekly_goal(uuid,date,uuid,text) to authenticated;

-- Keep goal text edits from older clients visible in the new item layout.
create function planner_private.sync_legacy_weekly_goal() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and jsonb_array_length(new.goal_items)=0 and length(trim(new.goal))>0) or (tg_op='UPDATE' and new.goal is distinct from old.goal and new.goal_items is not distinct from old.goal_items) then
  if length(trim(new.goal))=0 then new.goal_items:='[]'::jsonb;
  elsif tg_op='UPDATE' and jsonb_array_length(old.goal_items)=1 then new.goal_items:=jsonb_build_array(jsonb_set(old.goal_items->0,'{title}',to_jsonb(new.goal)));
  else new.goal_items:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',new.goal,'status','unreported'));end if;
 end if;
 return new;
end$$;
revoke all on function planner_private.sync_legacy_weekly_goal() from public,anon,authenticated;
create trigger sync_legacy_weekly_goal before insert or update on public.weekly_plans for each row execute function planner_private.sync_legacy_weekly_goal();

create or replace function public.student_portal_update(token text,action text,payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;st int;p public.weekly_plans;t public.tasks;pid uuid;d date;
begin
 sid:=planner_private.resolve_student(token);
 select stage into st from public.profiles where id=sid;
 if action='weekly_goals' then
  if st<>3 then raise exception '주간 목표 수정 권한이 없습니다';end if;
  perform planner_private.write_weekly_goals(sid,(payload->>'week')::date,payload->'items');
 elsif action='weekly_goal_check' then
  perform planner_private.mark_weekly_goal(sid,(payload->>'week')::date,(payload->>'id')::uuid,payload->>'status');
 elsif action='task_record' then
  if jsonb_typeof(payload->'note') is distinct from 'string' or length(payload->>'note')>2000 then raise exception '메모는 2000자 이내로 입력해 주세요';end if;
  if payload->>'status' is not null and payload->>'status' not in('done','incomplete','not_done') then raise exception '기록 상태가 올바르지 않습니다';end if;
  update public.tasks set student_note=payload->>'note',status=coalesce(payload->>'status',status)
  where id=(payload->>'id')::uuid and student_id=sid and not cancelled
   and (payload->>'status' is null or due_date<=(now() at time zone 'Asia/Seoul')::date);
  if not found then raise exception '본인의 과제만 저장할 수 있으며 미래 과제에는 수행 상태를 기록할 수 없습니다';end if;
 elsif action='check' then
  if payload->>'status' is null or payload->>'status' not in('done','incomplete','not_done','unreported') then raise exception '기록 상태가 올바르지 않습니다';end if;
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

