alter table public.profiles add column archived_at timestamptz;
create function public.set_student_archived(s uuid,archived boolean) returns void language plpgsql security definer set search_path='' as $$
declare previous timestamptz;
begin
 if auth.uid() is null or archived is null or not public.is_coach(s) then raise exception '담당 코치만 학생을 삭제하거나 복구할 수 있습니다';end if;
 select archived_at into previous from public.profiles where id=s and role='student' for update;
 if not found then raise exception '학생을 찾을 수 없습니다';end if;
 update public.profiles set archived_at=case when archived then coalesce(previous,clock_timestamp()) else null end where id=s;
 insert into public.audit_logs(student_id,actor,entity,old_data,new_data) values(s,auth.uid(),'student_archive',jsonb_build_object('archived_at',previous),jsonb_build_object('archived',archived));
end$$;
revoke all on function public.set_student_archived(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_student_archived(uuid,boolean) to authenticated;
create or replace function planner_private.resolve_student(token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if token~'^id:[a-z0-9_-]{6,32}$' then
  select l.student_id into sid from planner_private.student_links l join public.profiles p on p.id=l.student_id
  where l.access_id_hash=extensions.digest(substring(token from 4),'sha256') and l.expires_at>now() and p.role='student' and p.archived_at is null for share of l,p;
 elsif token~'^[0-9a-f]{64}$' then
  select l.student_id into sid from planner_private.student_links l join public.profiles p on p.id=l.student_id
  where l.token_hash=extensions.digest(token,'sha256') and l.expires_at>now() and p.role='student' and p.archived_at is null for share of l,p;
 end if;
 if sid is null then raise exception '학생 ID가 올바르지 않거나 사용이 중지되었습니다';end if;
 return sid;
end$$;
