alter table public.tasks
 add column performance_date date,
 add column performance_status text not null default 'unreported'
  check(performance_status in ('unreported','done','incomplete','not_done'));

-- Reconstruct the last saved state strictly before the Korean 06:00 cutoff.
-- Missing historical evidence remains untouched rather than guessing completion.
update public.tasks t set performance_date=t.due_date,performance_status=
 case when clock_timestamp()<((t.due_date+1+time '06:00') at time zone 'Asia/Seoul') then t.status
 else coalesce((select a.new_data->>'status' from public.audit_logs a
  where a.entity='tasks' and a.new_data->>'id'=t.id::text
   and a.new_data->>'due_date'=t.due_date::text
   and a.created_at<((t.due_date+1+time '06:00') at time zone 'Asia/Seoul')
   and a.new_data->>'status' in ('unreported','done','incomplete','not_done')
  order by a.created_at desc,a.id desc limit 1),'unreported') end;
alter table public.tasks alter column performance_date set not null;

create function planner_private.freeze_task_performance() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.performance_date:=new.due_date;
  new.performance_status:=case when clock_timestamp()<((new.due_date+1+time '06:00') at time zone 'Asia/Seoul') then new.status else 'unreported' end;
 elsif clock_timestamp()<((old.performance_date+1+time '06:00') at time zone 'Asia/Seoul') then
  new.performance_date:=new.due_date;
  new.performance_status:=case when clock_timestamp()<((new.due_date+1+time '06:00') at time zone 'Asia/Seoul') then new.status else old.status end;
 else
  new.performance_date:=old.performance_date;
  new.performance_status:=old.performance_status;
 end if;
 return new;
end$$;
revoke all on function planner_private.freeze_task_performance() from public,anon,authenticated;
create trigger freeze_task_performance before insert or update on public.tasks
 for each row execute function planner_private.freeze_task_performance();

-- Portal reads include the original statistical date after a late reschedule.
create or replace function public.student_portal_read(token text,w date,m date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 sid:=planner_private.resolve_student(token);
 if w is null or m is null or extract(isodow from w)<>1 or extract(day from m)<>1 then raise exception '주·월 기준 날짜가 올바르지 않습니다';end if;
 return jsonb_build_object(
 'profile',(select jsonb_build_object('id',id,'name',name,'grade',grade,'stage',stage) from public.profiles where id=sid),
 'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.week_start) from public.weekly_plans p where p.student_id=sid and p.week_start in(w,w+7)),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.due_date,t.id) from public.tasks t where t.student_id=sid and not t.cancelled and ((t.due_date between w and w+13) or (t.due_date>=m and t.due_date<m+interval '1 month') or (t.performance_date between w and w+13) or (t.performance_date>=m and t.performance_date<m+interval '1 month'))),'[]'::jsonb),
 'feedback',coalesce((select jsonb_agg(to_jsonb(f)) from public.published_feedback f where f.student_id=sid and f.week_start between w-28 and w),'[]'::jsonb),
 'sharing',(select coalesce(p.student_agreed,false) from public.sharing_preferences p where p.student_id=sid)
 );
end$$;
