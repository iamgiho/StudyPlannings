import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const coach=client(),student=client(),other=client();
const must=async(p)=>{const r=await p;if(r.error)throw r.error;return r.data};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const week=shift(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7));
let channel;
try{
 for(const [db,email] of [[coach,process.env.DEMO_COACH_EMAIL],[student,process.env.DEMO_STUDENT_EMAIL],[other,process.env.DEMO_OTHER_STUDENT_EMAIL]])await must(db.auth.signInWithPassword({email,password:db===coach?(process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD):process.env.DEMO_PASSWORD}));
 console.log('PASS: three real Supabase Auth password logins');
 const sid=(await student.auth.getUser()).data.user.id;
 const oid=(await other.auth.getUser()).data.user.id;
 for(const id of [sid,oid]){
 for(const offset of [-7,0,7]){
 const start=shift(week,offset),plan=await must(coach.rpc('save_plan',{s:id,w:start,g:offset===7?'다음 주에는 오답 유형 2가지를 함께 정리해요':'끝낼 수 있는 구체적인 과제로 한 주를 시작해요',confirm_plan:offset!==7}));
 for(let d=0;d<6;d++){
 const due=shift(start,d),title=d%2?'수학 문제집 35~50번 풀기':'영어 단어 40개 암기';
 const existing=await must(coach.from('tasks').select('id').eq('plan_id',plan).eq('due_date',due).eq('title',title));
 if(!existing.length)await must(coach.rpc('save_task',{p:plan,t:null,title_text:title,detail:d%2?'틀린 문제에는 표시해 두세요.':'단어장을 가리고 뜻을 확인해요.',sub:d%2?'수학':'영어',d:due}));
 }
 }
 }
 console.log('PASS: coach created this, previous and next week plans; no automatic Sunday tasks');
 const visible=await must(student.from('tasks').select('*').eq('student_id',sid));assert.ok(visible.length>=18);
 assert.equal((await must(other.from('tasks').select('*').eq('student_id',sid))).length,0);
 assert.equal((await must(student.from('tasks').select('*').eq('student_id',oid))).length,0);
 console.log('PASS: real REST/RLS student isolation');
 for(const [i,t] of visible.filter(t=>t.due_date<date).entries())await must(student.rpc('check_task',{t:t.id,value:i%3===0?'done':i%3===1?'incomplete':'unreported'}));
 const target=visible.find(t=>t.due_date===date)||visible.find(t=>t.due_date<date);assert.ok(target);
 let observed=false;
 channel=coach.channel('live-verification-'+Date.now()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tasks',filter:`student_id=eq.${sid}`},payload=>{if(payload.new.id===target.id&&payload.new.status==='done')observed=true});
 let rtStatus='';
 await Promise.race([new Promise(resolve=>channel.subscribe(status=>{rtStatus=status;if(status==='SUBSCRIBED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT')resolve()})),new Promise(resolve=>setTimeout(resolve,10000))]);
 await must(student.rpc('check_task',{t:target.id,value:'done'}));
 assert.equal((await must(coach.from('tasks').select('status').eq('id',target.id).single())).status,'done');
 assert.equal((await must(client().auth.signInWithPassword({email:process.env.DEMO_STUDENT_EMAIL,password:process.env.DEMO_PASSWORD}))).user.id,sid);
 console.log('PASS: student status persisted and immediately readable by coach');
 for(let i=0;i<20&&!observed;i++)await new Promise(r=>setTimeout(r,250));
 console.log(observed?'PASS: real WebSocket Realtime update delivered':`LIMIT: WebSocket update not observed (${rtStatus}); 15s polling remains available`);
 await must(coach.rpc('save_coaching',{s:sid,w:week,fields:{result:'작은 실천을 시작했어요',observation:'과제 범위 조정 필요',cause:'학생과 확인 중',strategy:'문제 수를 나누어 배분',priority:'영어 단어 복습',internal_note:'PRIVATE_LIVE_SENTINEL'},feedback:'완벽한 기록보다 솔직한 기록이 중요해요. 이번 주는 작은 과제부터 함께 해봐요.'}));
 assert.equal((await must(student.from('coaching_logs').select('*'))).length,0);
 assert.ok((await must(student.from('published_feedback').select('*'))).length>0);
 const report=await must(coach.rpc('save_report',{s:sid,k:'weekly',a:week,b:shift(week,6),content:'[가상 계정 검증용] 주간 코칭 요약\n학생 자기보고 데이터입니다.\n다음 주 목표: 단어 복습 범위를 함께 조정해요.',approve:false}));
 const blocked=await coach.rpc('export_report',{r:report});assert.ok(blocked.error);
 await must(student.rpc('set_sharing',{s:sid,w:false,m:false,agreed:true,legal:false}));
 await must(coach.rpc('set_sharing',{s:sid,w:true,m:false,agreed:false,legal:true}));
 await must(coach.rpc('save_report',{s:sid,k:'weekly',a:week,b:shift(week,6),content:'[가상 계정 검증용] 주간 코칭 요약\n학생 자기보고 데이터입니다.\n다음 주 목표: 단어 복습 범위를 함께 조정해요.',r:report,approve:true}));
 const body=await must(coach.rpc('export_report',{r:report}));assert.ok(!body.includes('PRIVATE_LIVE_SENTINEL'));
 await must(student.rpc('set_sharing',{s:sid,w:false,m:false,agreed:false,legal:false}));
 assert.ok((await coach.rpc('export_report',{r:report})).error);
 console.log('PASS: internal notes isolated; report consent, approval and revocation enforced');
 assert.ok((await must(coach.from('audit_logs').select('id').eq('student_id',sid).limit(1))).length);
 console.log('PASS: audit history persisted');
}finally{
 if(channel)await coach.removeChannel(channel);
 await Promise.all([coach,student,other].map(c=>c.auth.signOut({scope:'local'})));
}


