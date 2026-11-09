-- Coaches remain Auth users. Student roster identities do not require Auth.
alter table public.profiles add column auth_user_id uuid unique references auth.users(id);
update public.profiles set auth_user_id=id;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint coach_auth_identity check(role<>'coach' or (auth_user_id is not null and auth_user_id=id));
create function public.register_student(student_name text,student_grade text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='coach') then raise exception '코치만 학생을 등록할 수 있습니다';end if;
 if student_name is null or length(trim(student_name)) not between 1 and 80 or student_grade is null or length(trim(student_grade)) not between 1 and 80 then raise exception '이름과 학년을 확인하세요';end if;
 insert into public.profiles(id,name,role,grade,stage) values(sid,trim(student_name),'student',trim(student_grade),1);
 insert into public.coach_student_assignments(coach_id,student_id) values(auth.uid(),sid);
 insert into public.sharing_preferences(student_id) values(sid);
 insert into public.audit_logs(student_id,actor,entity,new_data) values(sid,auth.uid(),'student_registered',jsonb_build_object('name',trim(student_name),'grade',trim(student_grade)));
 return sid;
end$$;
revoke all on function public.register_student(text,text) from public,anon,authenticated;
grant execute on function public.register_student(text,text) to authenticated;
