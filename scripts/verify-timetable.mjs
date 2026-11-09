import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const make=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const coach=make(),student=make();const must=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const w=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+7);const next=d.toISOString().slice(0,10);const token='id:test123';let before,after;
const read=week=>must(student.rpc('read_student_timetable',{token,w:week}));
const save=(week,cells)=>student.rpc('save_student_timetable',{token,w:week,cells});
try{
 await must(coach.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 before=await read(w);after=await read(next);
 const cells=[{day:0,hour:6,content:'일요일 아침 계획',span:1},{day:6,hour:5,content:'토요일 다음날 새벽 계획',span:1}];
 await must(save(w,cells));assert.deepEqual(await read(w),cells);
 await must(save(next,[{day:1,hour:7,content:'다음 주 학교'}]));assert.deepEqual(await read(w),cells);
 for(const invalid of [[{day:7,hour:6,content:'invalid'}],[{day:0,hour:24,content:'invalid'}],[{day:0,hour:6,content:'x'.repeat(161)}],Array.from({length:169},()=>({day:0,hour:6,content:'x'})),[{day:0,hour:6,content:'a'},{day:0,hour:6,content:'b'}]])assert.ok((await save(w,invalid)).error);
 assert.deepEqual(await read(w),cells,'invalid writes roll back atomically');
 assert.ok((await student.rpc('save_student_timetable',{token:'id:not-a-valid-student',w,cells})).error);
 assert.ok((await student.from('student_timetable_cells').select('*')).error);
 const portal=await must(student.rpc('student_portal_read',{token,w,m:date.slice(0,7)+'-01'}));
 const records=await must(coach.from('student_timetable_cells').select('*').eq('student_id',portal.profile.id).eq('week_start',w));assert.equal(records.length,2);
 const blocks=[{day:1,hour:23,span:3,content:'학원 · 복습'},{day:2,hour:6,span:2,content:''}];await must(save(w,blocks));assert.deepEqual(await read(w),blocks);
 for(const invalid of [[{day:1,hour:5,span:2,content:'범위 초과'}],[{day:1,hour:6,span:2,content:'a'},{day:1,hour:7,content:'겹침'}],[{day:1,hour:6,span:1.5,content:'소수'}],[{day:1,hour:6,span:0,content:'잘못된 길이'}]])assert.ok((await save(w,invalid)).error);
 assert.deepEqual(await read(w),blocks);await must(save(w,[{day:1,hour:23,span:1,content:'학원 · 복습'}]));assert.equal((await read(w))[0].span,1);
 console.log('PASS: merged blocks, empty blocks, split, overlap and span checks; timetable save/read, independent weeks, invalid input rejection and rollback, invalid student denial, direct anonymous reads denied, assigned coach visibility');
}finally{
 if(before)await must(save(w,before));if(after)await must(save(next,after));await coach.auth.signOut({scope:'local'});
}
