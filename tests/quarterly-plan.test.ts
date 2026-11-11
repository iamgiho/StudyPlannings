import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {quarterStart,shiftQuarter,quarterLabel,quarterlyPlan} from '../web/quarterly-plan.js';

test('quarter navigation crosses years and renders subject tasks and any number of weeks safely',()=>{
 assert.equal(quarterStart('2026-11-11'),'2026-10-01');assert.equal(shiftQuarter('2026-10-01',1),'2027-01-01');assert.equal(shiftQuarter('2026-01-01',-1),'2025-10-01');assert.equal(quarterLabel('2026-10-01'),'2026년 4분기 · 10~12월');
 const data={core_tasks:[{subject:'영어 <script>',content:'복습 & 질문'}],week_goals:Array.from({length:25},(_,i)=>({content:`${i+1}주 내용`}))};
 const read=quarterlyPlan(data),edit=quarterlyPlan(data,{canEdit:true});assert.ok(read.includes('영어 &lt;script&gt;'));assert.ok(read.includes('복습 &amp; 질문'));assert.ok(!read.includes('<input'));assert.ok(!read.includes('분기계획표 저장'));assert.ok(edit.includes('분기계획표 저장'));assert.equal((edit.match(/class="quarter-week-row"/g)||[]).length,25);assert.ok(edit.includes('25주차 목표'));
});

test('quarter plans isolate students and quarters and allow only assigned coach or stage three to save',async()=>{
 const db=new PGlite(),sid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',q='2026-10-01';
 const core=[{subject:'영어',content:'핵심 단어 복습'}],weeks=[{content:'1주차 계획'},{content:'2주차 계획'}];
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema planner_private;grant usage on schema auth to anon,authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key,stage int);
 create table audit_logs(student_id uuid,actor uuid,entity text,old_data jsonb,new_data jsonb);
 create function is_coach(s uuid) returns boolean language sql as $$select auth.uid()='${cid}'::uuid and s='${sid}'::uuid$$;
 create function can_read(s uuid) returns boolean language sql as $$select auth.uid()=s or is_coach(s)$$;
 create function planner_private.resolve_student(token text) returns uuid language sql as $$select token::uuid$$;
 insert into profiles values('${sid}',1),('${other}',3);`);
 await db.exec(readFileSync('supabase/migrations/20261111061624_quarterly_plans.sql','utf8'));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[cid]);
 await db.query('select save_coach_quarter_plan($1,$2,$3,$4)',[sid,q,JSON.stringify(core),JSON.stringify(weeks)]);
 const read=async(token=sid,quarter=q)=>(await db.query<{plan:{core_tasks:unknown[];week_goals:unknown[]}}>('select read_student_quarter_plan($1,$2) as plan',[token,quarter])).rows[0].plan;
 assert.deepEqual(await read(),{core_tasks:core,week_goals:weeks});assert.deepEqual(await read(other),{core_tasks:[],week_goals:[]});assert.deepEqual(await read(sid,'2027-01-01'),{core_tasks:[],week_goals:[]});
 await assert.rejects(()=>db.query('select save_coach_quarter_plan($1,$2,$3,$4)',[other,q,'[]','[]']));
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 for(const stage of [1,2]){await db.query('update profiles set stage=$1 where id=$2',[stage,sid]);await assert.rejects(()=>db.query('select save_student_quarter_plan($1,$2,$3,$4)',[sid,q,'[]','[]']));assert.deepEqual(await read(),{core_tasks:core,week_goals:weeks});}
 await db.query('update profiles set stage=3 where id=$1',[sid]);
 const manyWeeks=Array.from({length:50},(_,i)=>({content:`${i+1}주차`}));
 await db.query('select save_student_quarter_plan($1,$2,$3,$4)',[sid,q,JSON.stringify(core),JSON.stringify(manyWeeks)]);assert.equal((await read()).week_goals.length,50);
 await db.query('select save_student_quarter_plan($1,$2,$3,$4)',[sid,'2027-01-01','[]',JSON.stringify([{content:'다음 분기'}])]);assert.equal((await read()).week_goals.length,50);
 for(const args of [[sid,q,JSON.stringify([{subject:'',content:'실패'}]),'[]'],[sid,q,'[]',JSON.stringify([{content:'a'.repeat(4001)}])],[sid,'2026-11-01','[]','[]']])await assert.rejects(()=>db.query('select save_student_quarter_plan($1,$2,$3,$4)',args));assert.equal((await read()).week_goals.length,50);
 await db.exec('set role anon');await assert.rejects(()=>db.query('select * from quarter_plans'));await assert.rejects(()=>db.query('select save_coach_quarter_plan($1,$2,$3,$4)',[sid,q,'[]','[]']));await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[cid]);await db.exec('set role authenticated');const visible=await db.query('select student_id from quarter_plans');assert.equal(visible.rows.length,2);await assert.rejects(()=>db.query('update quarter_plans set week_goals=\'[]\''));await db.exec('reset role');
 }finally{await db.close()}
});
