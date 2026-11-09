export type Task={id:string;student_id:string;plan_id:string;title:string;description:string;subject:string;due_date:string;status:'unreported'|'done'|'incomplete';cancelled:boolean};
export const subjects=['국어','영어','수학','과학','사회','역사','기타'];
export function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function addDays(date:string,n:number){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function monday(date:string){const d=new Date(date+'T00:00:00Z');return addDays(date,-((d.getUTCDay()+6)%7))}
export function stats(tasks:Task[],start:string,end:string,asOf=today()) {const all=tasks.filter(t=>!t.cancelled&&t.due_date>=start&&t.due_date<=end);const past=all.filter(t=>t.due_date<asOf);const done=past.filter(t=>t.status==='done').length;const incomplete=past.filter(t=>t.status==='incomplete').length;const unreported=past.length-done-incomplete;return {total:all.length,due:past.length,done,incomplete,unreported,rate:done+incomplete?done/(done+incomplete):null,reporting:past.length?(done+incomplete)/past.length:null}}
export const percent=(n:number|null)=>n===null?'데이터 없음':Math.round(n*100)+'%';
