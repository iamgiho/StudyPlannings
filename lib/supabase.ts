import {createClient} from '@supabase/supabase-js';
export const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const supabase=configured?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!):null;

// Supabase caps each response. Page all RLS-visible rows so month totals never
// silently use a truncated response. Audit history is deliberately separate.
export async function readAll(table:string){
 const rows:Record<string,unknown>[]=[];
 for(let offset=0;;offset+=500){
  const key=table==='sharing_preferences'?'student_id':table==='published_feedback'?'student_id,week_start':table==='coach_student_assignments'?'coach_id,student_id':'id';
  let query=supabase!.from(table).select('*');
  for(const column of key.split(','))query=query.order(column);
  const result=await query.range(offset,offset+499);
  if(result.error)return {data:null,error:result.error};
  rows.push(...result.data);
  if(result.data.length<500)return {data:rows,error:null};
 }
}
