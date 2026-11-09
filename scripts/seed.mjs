// Run only in an isolated demo Supabase project. Never use real student data.
import {createClient} from '@supabase/supabase-js';
if(process.env.DEMO_SEED_CONFIRM!=='isolated-demo-project')throw Error('Set DEMO_SEED_CONFIRM=isolated-demo-project');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const password=process.env.DEMO_PASSWORD;
if(!password||password.length<12)throw Error('DEMO_PASSWORD must be at least 12 characters');
const ids=[];
for(const [i,name] of ['김서연','이도윤','박지우','최하준','정수아','윤지호'].entries()){
const role=i===0?'coach':'student';const {data,error}=await db.auth.admin.createUser({email:`demo${i}@example.com`,password,email_confirm:true});if(error)throw error;const id=data.user.id;ids.push(id);
const p=await db.from('profiles').insert({id,auth_user_id:id,name,role,grade:i===0?'':i%2?'중학교 3학년':'고등학교 1학년'});if(p.error)throw p.error;
if(i){const a=await db.from('coach_student_assignments').insert({coach_id:ids[0],student_id:id});if(a.error)throw a.error;const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const week=d.toISOString().slice(0,10);const {data:plan,error:pe}=await db.from('weekly_plans').insert({student_id:id,week_start:week,goal:'무리하지 않고, 구체적인 과제부터 실천하기',confirmed:true}).select().single();if(pe)throw pe;for(let n=0;n<6;n++){const due=new Date(d);due.setUTCDate(due.getUTCDate()+n);const day=due.toISOString().slice(0,10);const r=await db.from('tasks').insert({student_id:id,plan_id:plan.id,title:n%2?'수학 문제집 35~50번 풀기':'영어 단어 40개 암기',subject:n%2?'수학':'영어',due_date:day,status:day>=date?'unreported':(n+i)%3===0?'unreported':(n+i)%3===1?'done':'incomplete'});if(r.error)throw r.error}}
}
console.log('Created six fictional accounts, demo0@example.com (coach), demo1–5@example.com (students). Sunday remains empty.');

