import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const make=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const coach=make(),guest=make();const must=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const date=new Date(d+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));const w=date.toISOString().slice(0,10),m=d.slice(0,7)+'-01';
const read=id=>guest.rpc('student_portal_read',{token:'id:'+id,w,m});let sid;
try{
 assert.ok((await coach.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:'intentionally-wrong-demo-password'})).error);
 await must(coach.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 const data=await must(read('test123'));sid=data.profile.id;assert.equal(data.profile.name,'가상학생 민준');assert.ok(data.tasks.every(t=>t.student_id===sid));
 assert.ok((await read('does_not_exist_123')).error);assert.ok((await guest.rpc('set_student_access_id',{s:sid,access_id:'changed123'})).error);
 const t=data.tasks.find(t=>t.due_date<=d);assert.ok(t);
 await must(guest.rpc('student_portal_update',{token:'id:test123',action:'check',payload:{id:t.id,status:'incomplete'}}));
 assert.equal((await must(coach.from('tasks').select('status').eq('id',t.id).single())).status,'incomplete');
 await must(guest.rpc('student_portal_update',{token:'id:test123',action:'check',payload:{id:t.id,status:t.status}}));
 const other=(await must(coach.from('profiles').select('id').eq('role','student'))).find(p=>p.id!==sid);
 assert.ok((await coach.rpc('set_student_access_id',{s:other.id,access_id:'test123'})).error);
 await must(coach.rpc('set_student_access_id',{s:sid,access_id:'verify_temporary_123'}));assert.ok((await read('test123')).error);
 await must(coach.rpc('set_student_access_id',{s:sid,access_id:'test123'}));await must(read('test123'));
 const audit=await must(coach.from('audit_logs').select('new_data').eq('entity','student_access_id'));assert.ok(!JSON.stringify(audit).includes('test123'));
 console.log('PASS: administrator password authentication; wrong password denied; student ID login; check persistence; unknown/duplicate ID rejected; reissue invalidation; raw ID absent from audit');
}finally{if(sid)await coach.rpc('set_student_access_id',{s:sid,access_id:'test123'});await coach.auth.signOut({scope:'local'})}
