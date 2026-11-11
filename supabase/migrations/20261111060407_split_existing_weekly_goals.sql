-- Preserve marked items. Split only unmarked, legacy multiline goals.
with candidates as (
 select p.id,p.goal_items as previous,
 (select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'title',trim(line),'status','unreported') order by n)
  from regexp_split_to_table(p.goal_items->0->>'title',E'\r?\n') with ordinality as x(line,n) where length(trim(line))>0) as items
 from public.weekly_plans p where jsonb_array_length(p.goal_items)=1 and p.goal_items->0->>'status'='unreported'
)
update public.weekly_plans p set goal_items=c.items from candidates c
 where p.id=c.id and p.goal_items=c.previous and jsonb_array_length(c.items) between 2 and 30;
