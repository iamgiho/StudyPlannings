-- The administrator can see usernames. No password or raw personal-link token
-- is exposed. This registry remains in a non-API schema with no client grants.
alter table planner_private.student_links add column access_id_label text;
update planner_private.student_links set access_id_label='test123'
 where access_id_hash=extensions.digest('test123','sha256');
create or replace function public.set_student_access_id(s uuid,access_id text) returns text
language plpgsql security definer set search_path='' as $$
declare code text:=lower(trim(access_id));
begin
 if auth.uid() is null or not public.is_coach(s) then raise exception '담당 코치만 학생 ID를 설정할 수 있습니다';end if;
 if code is null or code!~'^[a-z0-9_-]{6,32}$' then raise exception '학생 ID는 영문·숫자·밑줄·하이픈 6~32자로 입력하세요';end if;
 insert into planner_private.student_links(student_id,token_hash,access_id_hash,access_id_label,issued_by,expires_at)
 values(s,extensions.digest(encode(extensions.gen_random_bytes(32),'hex'),'sha256'),extensions.digest(code,'sha256'),code,auth.uid(),now()+interval '180 days')
 on conflict(student_id) do update set token_hash=excluded.token_hash,access_id_hash=excluded.access_id_hash,access_id_label=excluded.access_id_label,issued_by=excluded.issued_by,expires_at=excluded.expires_at,created_at=now();
 insert into public.audit_logs(student_id,actor,entity,new_data) values(s,auth.uid(),'student_access_id',jsonb_build_object('action','set','expires_days',180));
 return code;
exception when unique_violation then raise exception '이미 다른 학생이 사용하는 ID입니다';
end$$;
create function public.list_student_access_ids() returns table(student_id uuid,access_id text,expires_at timestamptz)
language sql security definer set search_path='' as $$
 select l.student_id,l.access_id_label,l.expires_at from planner_private.student_links l
 where auth.uid() is not null and public.is_coach(l.student_id) and l.access_id_hash is not null
$$;
revoke all on function public.list_student_access_ids() from public,anon,authenticated;
grant execute on function public.list_student_access_ids() to authenticated;
