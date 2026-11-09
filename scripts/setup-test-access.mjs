// Explicit test-only student ID fixture setup. Does not change Auth passwords.
import {createClient} from '@supabase/supabase-js';
if(!process.argv.includes('--confirm-test'))throw Error('This sets a test student ID. Pass --confirm-test only for the demo project.');
if(!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('jkpiuzlhvurbkbxyjdzh'))throw Error('Unexpected demo project');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=async p=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
try{
 await must(db.auth.signInWithPassword({email:process.env.DEMO_COACH_EMAIL,password:process.env.DEMO_COACH_PASSWORD||process.env.DEMO_PASSWORD}));
 const students=await must(db.from('profiles').select('id,name').eq('role','student').eq('name','가상학생 민준'));
 if(students.length!==1)throw Error('Expected exactly one fictional test student');
 await must(db.rpc('set_student_access_id',{s:students[0].id,access_id:'test123'}));
 console.log('Configured test student ID. Auth passwords unchanged.');
}finally{await db.auth.signOut({scope:'local'})}
