export const subjects=['국어','영어','수학','과학','사회','역사','기타'];
export function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function addDays(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function monday(date){return addDays(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7))}
export function monthEnd(month){return addDays(new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10),-1)}
export function stats(tasks,start,end,asOf=today()){const all=tasks.filter(t=>!t.cancelled&&t.due_date>=start&&t.due_date<=end);const past=all.filter(t=>t.due_date<asOf);const done=past.filter(t=>t.status==='done').length,incomplete=past.filter(t=>t.status==='incomplete').length;return {total:all.length,due:past.length,done,incomplete,unreported:past.length-done-incomplete,rate:done+incomplete?done/(done+incomplete):null,reporting:past.length?(done+incomplete)/past.length:null}}
export const percent=n=>n===null?'데이터 없음':Math.round(n*100)+'%';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const reviewPolicy={lookbackDays:14,incompleteThreshold:3};
