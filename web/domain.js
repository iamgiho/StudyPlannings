export const subjects=['국어','영어','수학','과학','사회','역사','기타'];
export function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function addDays(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function monday(date){return addDays(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7))}
export function monthEnd(month){return addDays(new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10),-1)}
export const performanceDate=t=>t.performance_date||t.due_date;
export const performanceCutoff=t=>Date.parse(addDays(performanceDate(t),1)+'T08:00:00+09:00');
/** @param {Date|string} [asOf] */
export function stats(tasks,start,end,asOf=new Date()){
 // A date-only testing reference denotes that morning's cutoff; runtime uses exact time.
 const at=typeof asOf==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(asOf)?Date.parse(asOf+'T08:00:00+09:00'):new Date(asOf).getTime();
 const all=tasks.filter(t=>!t.cancelled&&performanceDate(t)>=start&&performanceDate(t)<=end);
 const past=all.filter(t=>performanceCutoff(t)<=at);
 const saved=t=>t.performance_status??t.status;
 const done=past.filter(t=>saved(t)==='done').length,incomplete=past.filter(t=>saved(t)==='incomplete').length,notDone=past.filter(t=>saved(t)==='not_done').length;
 const checked=done+incomplete+notDone;
 return {total:all.length,due:past.length,done,incomplete,notDone,checked,rate:checked?(done+incomplete*.5)/checked:null};
}
export const percent=n=>n===null?'데이터 없음':Math.round(n*100)+'%';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const reviewPolicy={lookbackDays:14,incompleteThreshold:3};
