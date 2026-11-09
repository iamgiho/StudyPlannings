alter table planner_private.student_links add column access_id_hash bytea unique;
create function public.set_student_access_id(s uuid,access_id text) returns text
language plpgsql security definer set search_path='' as $$
declare code text:=lower(trim(access_id));
begin
 if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 학생 ID를 설정할 수 있습니다';end if;
 if code is null or code!~'^[a-z0-9_-]{6,32}$' then raise exception '학생 ID는 영문·숫자·밑줄·하이픈 6~32자로 입력하세요';end if;
 insert into planner_private.student_links(student_id,token_hash,access_id_hash,issued_by,expires_at)
 values(s,extensions.digest(encode(extensions.gen_random_bytes(32),'hex'),'sha256'),extensions.digest(code,'sha256'),auth.uid(),now()+interval '180 days')
 on conflict(student_id) do update set token_hash=excluded.token_hash,access_id_hash=excluded.access_id_hash,issued_by=excluded.issued_by,expires_at=excluded.expires_at,created_at=now();
 insert into public.audit_logs(student_id,actor,entity,new_data) values(s,auth.uid(),'student_access_id',jsonb_build_object('action','set','expires_days',180));
 return code;
exception when unique_violation then raise exception '이미 다른 학생이 사용하는 ID입니다';
end$$;
revoke all on function public.set_student_access_id(uuid,text) from public,anon,authenticated;
grant execute on function public.set_student_access_id(uuid,text) to authenticated;
create or replace function planner_private.resolve_student(token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if token~'^id:[a-z0-9_-]{6,32}$' then
  select l.student_id into sid from planner_private.student_links l join public.profiles p on p.id=l.student_id
  where l.access_id_hash=extensions.digest(substring(token from 4),'sha256') and l.expires_at>now() and p.role='student' for share of l;
 elsif token~'^[0-9a-f]{64}$' then
  select l.student_id into sid from planner_private.student_links l join public.profiles p on p.id=l.student_id
  where l.token_hash=extensions.digest(token,'sha256') and l.expires_at>now() and p.role='student' for share of l;
 end if;
 if sid is null then raise exception '학생 ID가 올바르지 않거나 사용이 중지되었습니다';end if;
 return sid;
end$$;
