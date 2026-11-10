-- Rebuild historical snapshots at the updated 08:00 Korean cutoff atomically.
lock table public.tasks in share row exclusive mode;
drop trigger freeze_task_performance on public.tasks;
update public.tasks t set performance_status=
 case when clock_timestamp()<((t.performance_date+1+time '08:00') at time zone 'Asia/Seoul') then t.status
 else coalesce((select a.new_data->>'status' from public.audit_logs a
  where a.entity='tasks' and a.new_data->>'id'=t.id::text
   and a.new_data->>'due_date'=t.performance_date::text
   and a.created_at<((t.performance_date+1+time '08:00') at time zone 'Asia/Seoul')
   and a.new_data->>'status' in ('unreported','done','incomplete','not_done')
  order by a.created_at desc,a.id desc limit 1),'unreported') end;
create or replace function planner_private.freeze_task_performance() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.performance_date:=new.due_date;
  new.performance_status:=case when clock_timestamp()<((new.due_date+1+time '08:00') at time zone 'Asia/Seoul') then new.status else 'unreported' end;
 elsif clock_timestamp()<((old.performance_date+1+time '08:00') at time zone 'Asia/Seoul') then
  new.performance_date:=new.due_date;
  new.performance_status:=case when clock_timestamp()<((new.due_date+1+time '08:00') at time zone 'Asia/Seoul') then new.status else old.status end;
 else
  new.performance_date:=old.performance_date;
  new.performance_status:=old.performance_status;
 end if;
 return new;
end$$;
revoke all on function planner_private.freeze_task_performance() from public,anon,authenticated;
create trigger freeze_task_performance before insert or update on public.tasks
 for each row execute function planner_private.freeze_task_performance();

