import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const make=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const coach=make(),guest=make();const must=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const w=d.toISOString().slice(0,10),m=date.slice(0,7)+'-01';
try{
 await must(coach.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 assert.ok((await guest.rpc('list_student_access_ids')).error);
 if(process.argv.includes('--prepare')){
  const p=await must(coach.from('profiles').select('id').eq('name','박지우').eq('role','student').single());
  const tasks=await must(coach.from('tasks').select('id').eq('student_id',p.id));
  await must(coach.rpc('set_student_access_id',{s:p.id,access_id:'test456'}));
  const ids=await must(coach.rpc('list_student_access_ids'));assert.ok(ids.some(row=>row.student_id===p.id&&row.access_id==='test456'));
  const portal=await must(guest.rpc('student_portal_read',{token:'id:test456',w,m}));assert.equal(portal.profile.id,p.id);
  await mkdir('tmp',{recursive:true});await writeFile('tmp/id-management-check.json',JSON.stringify({id:p.id,count:tasks.length}));
  console.log('PASS: administrator creates and lists ID; ID login works; guest cannot list IDs');
 }else{
  const saved=JSON.parse(await readFile('tmp/id-management-check.json','utf8'));
  const ids=await must(coach.rpc('list_student_access_ids'));assert.ok(!ids.some(row=>row.student_id===saved.id));
  assert.ok((await guest.rpc('student_portal_read',{token:'id:test456',w,m})).error);
  assert.equal((await must(coach.from('tasks').select('id').eq('student_id',saved.id))).length,saved.count);
  assert.ok((await must(coach.from('profiles').select('id').eq('id',saved.id).single())).id);
  const demo=await must(guest.rpc('student_portal_read',{token:'id:test123',w,m}));assert.equal(demo.profile.name,'가상학생 민준');
  console.log('PASS: UI-deleted ID no longer appears and cannot log in; student and all task records preserved; test123 still works');
 }
}finally{await coach.auth.signOut({scope:'local'})}
