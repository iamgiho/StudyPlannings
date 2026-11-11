import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {weeklyGoals} from '../web/weekly-goals.js';

test('weekly goal cards escape content and keep editing separate from performance marking',()=>{
 const items=[{id:'one',title:'영어 <복습>',status:'incomplete'},{id:'two',title:'수학',status:'unreported'}];
 const student=weeklyGoals(items);assert.equal((student.match(/class="weekly-goal-card"/g)||[]).length,2);assert.ok(student.includes('영어 &lt;복습&gt;'));assert.ok(!student.includes('data-form="plan"'));assert.equal((student.match(/data-goal-check=/g)||[]).length,6);assert.equal((student.match(/aria-pressed="true"/g)||[]).length,1);assert.ok(weeklyGoals(items,{canEdit:true}).includes('data-form="plan"'));assert.ok(!weeklyGoals(items,{canCheck:false}).includes('data-goal-check='));
});

test('weekly goal RPCs preserve individual status, enforce stages and support legacy text edits',async()=>{
 const db=new PGlite();
 const sid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',one='33333333-3333-4333-8333-333333333333',two='44444444-4444-4444-8444-444444444444';
 try{
 await db.exec(`create role anon;create role authenticated;create schema planner_private;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key,stage int);
 create table weekly_plans(id uuid primary key default gen_random_uuid(),student_id uuid,week_start date,goal text not null default '',unique(student_id,week_start));
 create table tasks(id uuid);create table audit_logs(student_id uuid,entity text,new_data jsonb);
 create function public.is_coach(s uuid) returns boolean language sql as $$select auth.uid()='${cid}'::uuid and s='${sid}'::uuid$$;
 create function planner_private.resolve_student(token text) returns uuid language sql as $$select token::uuid$$;
 insert into profiles values('${sid}',1);
 insert into weekly_plans(student_id,week_start,goal) values('${sid}',date_trunc('week',now())::date,'기존 목표');`);
 await db.exec(readFileSync('supabase/migrations/20261111055740_weekly_goal_items.sql','utf8'));
 const result=await db.query<{goal_items:Array<{title:string}>}>('select goal_items from weekly_plans');assert.equal(result.rows[0].goal_items[0].title,'기존 목표');
 const week=(await db.query<{w:string}>(`select date_trunc('week',now())::date::text as w`)).rows[0].w;
 const items=[{id:one,title:'영어',status:'done'},{id:two,title:'수학',status:'done'}];
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[cid]);
 await db.query('select save_weekly_goals($1,$2,$3)',[sid,week,JSON.stringify(items)]);
 const get=async()=> (await db.query<{goal_items:Array<{id:string;title:string;status:string}>}>('select goal_items from weekly_plans')).rows[0].goal_items;
 assert.deepEqual((await get()).map(g=>g.status),['unreported','unreported']);
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 await db.query("select student_portal_update($1,'weekly_goal_check',$2)",[sid,JSON.stringify({week,id:one,status:'incomplete'})]);
 assert.equal((await get())[0].status,'incomplete');assert.equal((await get())[1].status,'unreported');
 await assert.rejects(()=>db.query("select student_portal_update($1,'weekly_goals',$2)",[sid,JSON.stringify({week,items})]));
 await db.exec(`update profiles set stage=2 where id='${sid}'`);
 await assert.rejects(()=>db.query("select student_portal_update($1,'weekly_goals',$2)",[sid,JSON.stringify({week,items})]));
 await db.exec(`update profiles set stage=3 where id='${sid}'`);
 await db.query("select student_portal_update($1,'weekly_goals',$2)",[sid,JSON.stringify({week,items:[{...items[0],title:'영어 새 목표',status:'done'}]})]);
 assert.equal((await get()).length,1);assert.equal((await get())[0].status,'incomplete');assert.equal((await get())[0].title,'영어 새 목표');
 await assert.rejects(()=>db.query('select save_weekly_goals($1,$2,$3)',[sid,week,JSON.stringify(items)]));
 await assert.rejects(()=>db.query("select student_portal_update($1,'weekly_goal_check',$2)",[sid,JSON.stringify({week,id:two,status:'done'})]));
 await db.query('update weekly_plans set goal=$1',['옛 화면에서 편집한 목표']);assert.equal((await get())[0].title,'옛 화면에서 편집한 목표');assert.equal((await get())[0].status,'incomplete');
 }finally{await db.close()}
});
