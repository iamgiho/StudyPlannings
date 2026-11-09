// Explicit test-only fixture setup. Does not change any student Auth password.
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
if(!process.argv.includes('--confirm-test'))throw Error('This sets test credentials. Pass --confirm-test only for the demo project.');
if(!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('jkpiuzlhvurbkbxyjdzh'))throw Error('Unexpected demo project');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
try{
 await must(db.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 const students=await must(db.from('profiles').select('id,name').eq('role','student').eq('name','가상학생 민준'));
 if(students.length!==1)throw Error('Expected exactly one fictional test student');
 await must(db.rpc('set_student_access_id',{s:students[0].id,access_id:'test123'}));
 await must(db.auth.updateUser({password:'test123'}));
 let env=await readFile('.env.demo.local','utf8');
 env=env.replace(/^DEMO_COACH_PASSWORD=.*\r?\n?/gm,'').trimEnd()+'\nDEMO_COACH_PASSWORD=test123\n';
 await writeFile('.env.demo.local',env);
 console.log('Configured test student ID and coach password. Student Auth passwords unchanged.');
}finally{await db.auth.signOut({scope:'local'})}
