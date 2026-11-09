import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]||process.env.APP_URL||'http://127.0.0.1:3000';
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const coach=client(),student=client(),other=client();
const must=async p=>{const r=await p;if(r.error)throw r.error;return r.data};
try{
 const cs=await must(coach.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 const ss=await must(student.auth.signInWithPassword({email:process.env.DEMO_STUDENT_EMAIL,password:process.env.DEMO_PASSWORD}));
 const os=await must(other.auth.signInWithPassword({email:process.env.DEMO_OTHER_STUDENT_EMAIL,password:process.env.DEMO_PASSWORD}));
 const reports=await must(coach.from('reports').select('*').eq('student_id',ss.user.id).eq('approved',true).order('created_at',{ascending:false}));
 assert.ok(reports.length);const id=reports[0].id;
 const request=token=>fetch(base+'/api/reports/pdf',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({id})});
 assert.equal((await request()).status,401);
 assert.equal((await request(os.session.access_token)).status,403);
 await must(student.rpc('set_sharing',{s:ss.user.id,w:false,m:false,agreed:true,legal:false}));
 let response=await request(cs.session.access_token);
 if(!response.ok)throw Error('PDF generation failed: '+response.status+' '+await response.text());
 assert.match(response.headers.get('content-type'),/application\/pdf/);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/onplan-demo-report.pdf',bytes);
 await must(student.rpc('set_sharing',{s:ss.user.id,w:false,m:false,agreed:false,legal:false}));
 assert.equal((await request(cs.session.access_token)).status,403);
 await must(student.rpc('set_sharing',{s:ss.user.id,w:false,m:false,agreed:true,legal:false}));
 console.log('PASS: PDF route rejects anonymous/other student/revoked consent; approved Korean PDF saved ('+bytes.length+' bytes)');
}finally{await Promise.all([coach,student,other].map(c=>c.auth.signOut({scope:'local'})))}


