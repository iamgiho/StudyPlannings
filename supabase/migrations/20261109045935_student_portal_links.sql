-- Student links are bearer credentials. Only hashes are retained, in a schema
-- which is never exposed through the Data API. Link holders cannot list users.
create schema if not exists planner_private;
revoke all on schema planner_private from public,anon,authenticated;
create table planner_private.student_links (
 student_id uuid primary key references public.profiles(id),
 token_hash bytea not null unique,
 issued_by uuid not null references public.profiles(id),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table planner_private.student_links enable row level security;
revoke all on planner_private.student_links from public,anon,authenticated;

create function public.issue_student_link(s uuid) returns text
language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 링크를 발급할 수 있습니다';end if;
 if not exists(select 1 from public.profiles where id=s and role='student') then raise exception '학생이 없습니다';end if;
 secret:=encode(extensions.gen_random_bytes(32),'hex');
 insert into planner_private.student_links(student_id,token_hash,issued_by,expires_at)
 values(s,extensions.digest(secret,'sha256'),auth.uid(),now()+interval '180 days')
 on conflict(student_id) do update set token_hash=excluded.token_hash,issued_by=excluded.issued_by,expires_at=excluded.expires_at,created_at=now();
 insert into public.audit_logs(student_id,actor,entity,new_data) values(s,auth.uid(),'student_link',jsonb_build_object('action','issued','expires_days',180));
 return secret;
end$$;
create function public.revoke_student_link(s uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 링크를 중지할 수 있습니다';end if;
 delete from planner_private.student_links where student_id=s;
 insert into public.audit_logs(student_id,actor,entity,new_data) values(s,auth.uid(),'student_link',jsonb_build_object('action','revoked'));
end$$;
create function planner_private.resolve_student(token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if token is null or token!~'^[0-9a-f]{64}$' then raise exception '학생 링크가 만료되었거나 올바르지 않습니다';end if;
 select l.student_id into sid from planner_private.student_links l join public.profiles p on p.id=l.student_id
 where l.token_hash=extensions.digest(token,'sha256') and l.expires_at>now() and p.role='student' for share of l;
 if sid is null then raise exception '학생 링크가 만료되었거나 올바르지 않습니다';end if;
 return sid;
end$$;
revoke all on function planner_private.resolve_student(text) from public,anon,authenticated;

create function public.student_portal_read(token text,w date,m date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 sid:=planner_private.resolve_student(token);
 if w is null or m is null or extract(isodow from w)<>1 or extract(day from m)<>1 then raise exception '주·월 기준 날짜가 올바르지 않습니다';end if;
 return jsonb_build_object(
 'profile',(select jsonb_build_object('id',id,'name',name,'grade',grade,'stage',stage) from public.profiles where id=sid),
 'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.week_start) from public.weekly_plans p where p.student_id=sid and p.week_start in(w,w+7)),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.due_date,t.id) from public.tasks t where t.student_id=sid and not t.cancelled and ((t.due_date between w and w+13) or (t.due_date>=m and t.due_date<m+interval '1 month'))),'[]'::jsonb),
 'feedback',coalesce((select jsonb_agg(to_jsonb(f)) from public.published_feedback f where f.student_id=sid and f.week_start between w-28 and w),'[]'::jsonb),
 'sharing',(select coalesce(p.student_agreed,false) from public.sharing_preferences p where p.student_id=sid)
 );
end$$;
create function public.student_portal_update(token text,action text,payload jsonb) returns void
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
  if st<>3 then raise exception '3단계에서 주간 초안을 작성할 수 있습니다';end if;
  select * into p from public.weekly_plans where student_id=sid and week_start=(payload->>'week')::date for update;
  if p.confirmed then raise exception '확정된 계획은 코치와 상의해 주세요';end if;
  insert into public.weekly_plans(student_id,week_start,goal) values(sid,(payload->>'week')::date,left(coalesce(payload->>'goal',''),2000))
  on conflict(student_id,week_start) do update set goal=excluded.goal;
 elsif action='task' then
  select * into p from public.weekly_plans where id=(payload->>'plan')::uuid and student_id=sid for update;
  if p.id is null or st<2 or (st=3 and p.confirmed) then raise exception '과제 배분 수정 권한이 없습니다';end if;
  d:=(payload->>'date')::date;
  if d is null or d<p.week_start or d>p.week_start+6 then raise exception '같은 주 날짜를 선택하세요';end if;
  if nullif(payload->>'id','') is null then
   if st<>3 then raise exception '3단계 초안에서 과제를 추가할 수 있습니다';end if;
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
revoke all on function public.issue_student_link(uuid),public.revoke_student_link(uuid),public.student_portal_read(text,date,date),public.student_portal_update(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.issue_student_link(uuid),public.revoke_student_link(uuid) to authenticated;
grant execute on function public.student_portal_read(text,date,date),public.student_portal_update(text,text,jsonb) to anon,authenticated;
create index if not exists student_links_issued_by_idx on planner_private.student_links(issued_by);
