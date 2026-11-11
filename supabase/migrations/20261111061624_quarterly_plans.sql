create table public.quarter_plans(
 student_id uuid not null references public.profiles(id),
 quarter_start date not null check(extract(day from quarter_start)=1 and extract(month from quarter_start) in(1,4,7,10)),
 core_tasks jsonb not null default '[]'::jsonb check(jsonb_typeof(core_tasks)='array'),
 week_goals jsonb not null default '[]'::jsonb check(jsonb_typeof(week_goals)='array'),
 updated_at timestamptz not null default now(),
 primary key(student_id,quarter_start),
 check(octet_length(core_tasks::text)+octet_length(week_goals::text)<=1048576)
);
alter table public.quarter_plans enable row level security;
revoke all on public.quarter_plans from public,anon,authenticated;
grant select on public.quarter_plans to authenticated;
grant select,insert,update,delete on public.quarter_plans to service_role;
create policy quarter_plan_read on public.quarter_plans for select to authenticated using(public.can_read(student_id));

create function planner_private.write_quarter_plan(s uuid,q date,core jsonb,weeks jsonb) returns void language plpgsql set search_path='' as $$
declare previous jsonb;clean_core jsonb;clean_weeks jsonb;
begin
 if q is null or extract(day from q)<>1 or extract(month from q) not in(1,4,7,10) then raise exception '분기를 확인하세요';end if;
 if core is null or weeks is null or jsonb_typeof(core)<>'array' or jsonb_typeof(weeks)<>'array' or octet_length(core::text)+octet_length(weeks::text)>1048576 then raise exception '분기계획표 형식을 확인하세요';end if;
 if exists(select 1 from jsonb_array_elements(core) c where jsonb_typeof(c)<>'object' or jsonb_typeof(c->'subject') is distinct from 'string' or jsonb_typeof(c->'content') is distinct from 'string' or length(trim(c->>'subject')) not between 1 and 80 or length(trim(c->>'content')) not between 1 and 4000) then raise exception '과목과 핵심 과제 내용을 모두 입력하세요';end if;
 if exists(select 1 from jsonb_array_elements(weeks) c where jsonb_typeof(c)<>'object' or jsonb_typeof(c->'content') is distinct from 'string' or length(c->>'content')>4000) then raise exception '주차별 목표는 각 4000자 이내로 입력하세요';end if;
 select coalesce(jsonb_agg(jsonb_build_object('subject',trim(c->>'subject'),'content',trim(c->>'content')) order by n),'[]'::jsonb) into clean_core from jsonb_array_elements(core) with ordinality x(c,n);
 select coalesce(jsonb_agg(jsonb_build_object('content',c->>'content') order by n),'[]'::jsonb) into clean_weeks from jsonb_array_elements(weeks) with ordinality x(c,n);
 perform pg_advisory_xact_lock(hashtextextended('quarter:'||s::text||q::text,0));
 select to_jsonb(p) into previous from public.quarter_plans p where student_id=s and quarter_start=q;
 insert into public.quarter_plans(student_id,quarter_start,core_tasks,week_goals) values(s,q,clean_core,clean_weeks)
 on conflict(student_id,quarter_start) do update set core_tasks=excluded.core_tasks,week_goals=excluded.week_goals,updated_at=clock_timestamp();
 insert into public.audit_logs(student_id,actor,entity,old_data,new_data) values(s,auth.uid(),'quarter_plan',previous,jsonb_build_object('quarter_start',q,'core_tasks',clean_core,'week_goals',clean_weeks));
end$$;
revoke all on function planner_private.write_quarter_plan(uuid,date,jsonb,jsonb) from public,anon,authenticated;
create function public.save_coach_quarter_plan(s uuid,q date,core jsonb,weeks jsonb) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 수정할 수 있습니다';end if;perform planner_private.write_quarter_plan(s,q,core,weeks);end$$;
create function public.save_student_quarter_plan(token text,q date,core jsonb,weeks jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin sid:=planner_private.resolve_student(token);if not exists(select 1 from public.profiles where id=sid and stage=3) then raise exception '분기계획표 수정 권한이 없습니다';end if;perform planner_private.write_quarter_plan(sid,q,core,weeks);end$$;
create function public.read_student_quarter_plan(token text,q date) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid;begin sid:=planner_private.resolve_student(token);if q is null or extract(day from q)<>1 or extract(month from q) not in(1,4,7,10) then raise exception '분기를 확인하세요';end if;
 return coalesce((select jsonb_build_object('core_tasks',core_tasks,'week_goals',week_goals) from public.quarter_plans where student_id=sid and quarter_start=q),jsonb_build_object('core_tasks','[]'::jsonb,'week_goals','[]'::jsonb));end$$;
revoke all on function public.save_coach_quarter_plan(uuid,date,jsonb,jsonb),public.save_student_quarter_plan(text,date,jsonb,jsonb),public.read_student_quarter_plan(text,date) from public,anon,authenticated;
grant execute on function public.save_coach_quarter_plan(uuid,date,jsonb,jsonb) to authenticated;
grant execute on function public.save_student_quarter_plan(text,date,jsonb,jsonb),public.read_student_quarter_plan(text,date) to anon,authenticated;
