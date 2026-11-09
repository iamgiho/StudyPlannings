import {createClient} from '@supabase/supabase-js';
import {createReportPdf} from '@/lib/report-pdf';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
 const token=request.headers.get('authorization');
 if(!token?.startsWith('Bearer '))return Response.json({error:'로그인이 필요합니다.'},{status:401,headers});
 let id:unknown;try{({id}=await request.json())}catch{return Response.json({error:'잘못된 요청입니다.'},{status:400,headers})}
 if(typeof id!=='string'||!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id))return Response.json({error:'리포트 ID를 확인하세요.'},{status:400,headers});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token.slice(7));
 if(authError||!user)return Response.json({error:'다시 로그인해 주세요.'},{status:401,headers});
 // Only approved snapshots with current student consent and coach permission
 // can leave the database. No coaching-log table is queried by this endpoint.
 const {data,error}=await db.rpc('export_report',{r:id});
 if(error||typeof data!=='string')return Response.json({error:'승인 및 현재 공유 동의가 필요합니다.'},{status:403,headers});
 try{
  const bytes=await createReportPdf(data);
  return new Response(Buffer.from(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="onplan-report-${id}.pdf"`,'X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'},{status:500,headers})}
}
