import {createClient} from '@supabase/supabase-js';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const coach=client(),guest=client(),student=client();
const must=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const w=shift(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)),m=date.slice(0,7)+'-01';
try{
 await must(coach.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 const me=await must(student.auth.signInWithPassword({email:process.env.DEMO_STUDENT_EMAIL,password:process.env.DEMO_PASSWORD}));const sid=me.user.id;
 const people=await must(coach.from('profiles').select('*').eq('role','student'));const other=people.find(p=>p.id!==sid);assert.ok(other);
 assert.ok((await guest.rpc('register_student',{student_name:'차단 검증',student_grade:'중1'})).error);assert.ok((await student.rpc('register_student',{student_name:'차단 검증',student_grade:'중1'})).error);
 assert.ok((await guest.rpc('issue_student_link',{s:sid})).error);
 assert.ok((await student.rpc('issue_student_link',{s:sid})).error);
 let token=await must(coach.rpc('issue_student_link',{s:sid}));assert.match(token,/^[a-f0-9]{64}$/);
 const read=key=>guest.rpc('student_portal_read',{token:key,w,m});
 const update=(key,action,payload)=>guest.rpc('student_portal_update',{token:key,action,payload});
 let data=await must(read(token));assert.equal(data.profile.id,sid);assert.ok(data.tasks.length);assert.ok(data.tasks.every(t=>t.student_id===sid));assert.ok(!JSON.stringify(data).includes('PRIVATE_LIVE_SENTINEL'));assert.ok(!('coaching_logs' in data));
 assert.ok((await guest.from('tasks').select('*')).error);assert.ok((await read('f'.repeat(64))).error);
 console.log('PASS: coach-only issuance; student portal works without Auth; direct table access denied; only own data and public feedback returned');
 const t=data.tasks.find(t=>t.due_date===date)||data.tasks.find(t=>t.due_date<date);assert.ok(t);
 for(const status of ['done','incomplete','unreported']){await must(update(token,'check',{id:t.id,status}));assert.equal((await must(coach.from('tasks').select('status').eq('id',t.id).single())).status,status)}
 await must(update(token,'check',{id:t.id,status:t.status}));
 const otherTask=(await must(coach.from('tasks').select('*').eq('student_id',other.id).limit(1)))[0];assert.ok((await update(token,'check',{id:otherTask.id,status:'done'})).error);
 const future=data.tasks.find(t=>t.due_date>date);if(future)assert.ok((await update(token,'check',{id:future.id,status:'done'})).error);
 assert.ok((await update(token,'check',{id:t.id,status:'invalid'})).error);
 assert.ok((await update(token,'role',{role:'coach'})).error);
 console.log('PASS: completion/incompletion/unreported saved and visible to coach; other student, future task and arbitrary actions denied');
 await must(coach.rpc('set_stage',{s:sid,n:1}));
 const p=data.plans.find(p=>p.week_start===w);assert.ok(p);
 assert.ok((await update(token,'task',{id:t.id,plan:t.plan_id,date:t.due_date})).error);
 await must(coach.rpc('set_stage',{s:sid,n:2}));
 await must(update(token,'task',{id:t.id,plan:t.plan_id,date:t.due_date,title:'MUST_NOT_CHANGE',subject:'기타'}));
 assert.equal((await must(coach.from('tasks').select('title').eq('id',t.id).single())).title,t.title);
 await must(coach.rpc('set_stage',{s:sid,n:3}));
 const next=shift(w,7),nextPlan=(await must(coach.from('weekly_plans').select('*').eq('student_id',sid).eq('week_start',next).single()));
 await must(update(token,'plan',{week:next,goal:'학생 링크 초안 검증'}));
 await must(coach.rpc('save_plan',{s:sid,w:next,g:nextPlan.goal,confirm_plan:nextPlan.confirmed}));
 await must(coach.rpc('save_plan',{s:sid,w,g:p.goal,confirm_plan:true}));
 assert.ok((await update(token,'plan',{week:w,goal:'확정 계획 변경 시도'})).error);
 await must(coach.rpc('set_stage',{s:sid,n:1}));
 const oldSharing=(await must(coach.from('sharing_preferences').select('*').eq('student_id',sid).maybeSingle()))?.student_agreed||false;
 await must(update(token,'sharing',{agreed:!oldSharing}));assert.equal((await must(read(token))).sharing,!oldSharing);
 await must(update(token,'sharing',{agreed:oldSharing}));
 const old=token;token=await must(coach.rpc('issue_student_link',{s:sid}));assert.notEqual(token,old);assert.ok((await read(old)).error);
 await must(coach.rpc('revoke_student_link',{s:sid}));assert.ok((await read(token)).error);assert.ok((await update(token,'check',{id:t.id,status:'done'})).error);
 token=await must(coach.rpc('issue_student_link',{s:sid}));await must(read(token));
 const second=await must(coach.rpc('issue_student_link',{s:other.id}));
 const audit=await must(coach.from('audit_logs').select('entity,new_data').eq('student_id',sid).eq('entity','student_link'));assert.ok(!JSON.stringify(audit).includes(token));
 await writeFile('.env.portal.local',`DEMO_STUDENT_TOKEN=${token}\nDEMO_OTHER_TOKEN=${second}\n`);
 console.log('PASS: growth-stage restrictions; sharing choice; rotated/revoked links denied; raw token absent from audit; private demo links saved');
}finally{await coach.auth.signOut({scope:'local'});await student.auth.signOut({scope:'local'})}


