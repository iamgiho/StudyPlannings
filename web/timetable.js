import {escape as h} from './domain.js';
export const timetableDays=['월','화','수','목','금','토','일'];
export const timetableHours=Array.from({length:24},(_,i)=>(i+6)%24);
const row=hour=>(hour+18)%24;
const time=hour=>String(hour).padStart(2,'0')+':00';
export function readTimetable(form){return Array.from(form.querySelectorAll('textarea[data-day]')).map(el=>({day:Number(el.dataset.day),hour:Number(el.dataset.hour),span:Number(el.dataset.span||1),content:el.value.trim()})).filter(c=>c.content||c.span>1)}
export function changeTimetableBlock(cells,day,start,end,split=false){
 if(start>=end)throw Error('끝 시간은 시작 시간보다 뒤로 선택해 주세요.');
 const hits=cells.filter(c=>c.day===day&&row(c.hour)<end&&row(c.hour)+(c.span||1)>start);
 if(hits.some(c=>row(c.hour)<start||row(c.hour)+(c.span||1)>end))throw Error('기존 블록 전체를 포함해 선택하거나 먼저 선택 초기화로 병합을 풀어 주세요.');
 const rest=cells.filter(c=>!hits.includes(c));
 if(split)return [...rest,...hits.filter(c=>c.content).map(c=>({...c,span:1}))];
 const content=hits.sort((a,b)=>row(a.hour)-row(b.hour)).map(c=>c.content).filter(Boolean).join('\n');
 if(content.length>160)throw Error('합칠 내용이 160자를 넘어요. 내용을 줄인 뒤 병합해 주세요.');
 return [...rest,{day,hour:timetableHours[start],span:end-start,content}];
}
export function timetableSection(cells=[],{readOnly=false}={}){
 const values=new Map(cells.map(c=>[`${c.day}:${c.hour}`,c]));
 const covered=new Set();
 for(const c of cells)for(let i=1;i<(c.span||1);i++)covered.add(`${c.day}:${timetableHours[row(c.hour)+i]}`);
 const options=timetableHours.map((hour,i)=>`<option value="${i}">${time(hour)}</option>`).join('');
 return `<section class="panel timetable-section" aria-labelledby="timetable-title"><div class="section-heading"><div><span class="eyebrow">MY WEEKLY TIMETABLE</span><h2 id="timetable-title">나의 주간 시간표</h2><p class="muted">${readOnly?'학생이 저장한 이번 주 시간표입니다. 학생 화면과 같은 배치로 확인할 수 있어요.':'요일과 시간 범위를 선택해 일정 블록을 만드세요. 06:00부터 다음날 06:00까지, 수정 후 저장을 눌러 주세요.'}</p></div></div><form data-form="timetable">${readOnly?'':`<div class="timetable-tools"><label>요일<select name="blockDay">${timetableDays.map((day,i)=>`<option value="${(i+1)%7}">${day}</option>`).join('')}</select></label><label>시작<select name="blockStart">${options}</select></label><label>끝<select name="blockEnd">${timetableHours.slice(1).map((hour,i)=>`<option value="${i+1}">${hour<6?'다음날 ':''}${time(hour)}</option>`).join('')}<option value="24">다음날 06:00</option></select></label><button type="button" data-action="merge-timetable">블록 만들기 · 병합</button><button type="button" class="secondary" data-action="split-timetable" title="선택 범위의 병합을 풀고 내용은 첫 칸에 유지합니다">선택 초기화</button><button type="button" class="secondary" data-action="reset-timetable-day">요일 초기화</button><button type="button" class="secondary" data-action="reset-timetable-all">전체 초기화</button></div>`}<div class="timetable-scroll" tabindex="0" role="region" aria-label="주간 시간표"><table class="timetable"><thead><tr><th scope="col">시간</th>${timetableDays.map(day=>`<th scope="col">${day}</th>`).join('')}</tr></thead><tbody>${timetableHours.map(hour=>`<tr><th scope="row">${time(hour)}</th>${timetableDays.map((day,column)=>{const index=(column+1)%7,key=`${index}:${hour}`;if(covered.has(key))return '';const c=values.get(key),span=c?.span||1;return `<td rowspan="${span}" class="${span>1?'timetable-block':''}"><div class="timetable-cell" style="height:calc(var(--timetable-row) * ${span} - 1px)"><textarea name="cell-${index}-${hour}" data-day="${index}" data-hour="${hour}" data-span="${span}" maxlength="160"${readOnly?' readonly':''} aria-label="${day}요일 ${time(hour)}${span>1?' '+span+'시간 블록':''}" rows="1">${h(c?.content||'')}</textarea></div></td>`}).join('')}</tr>`).join('')}</tbody></table></div>${readOnly?'<p class="muted">학생이 저장한 내용은 자동으로 갱신됩니다.</p>':`<div class="timetable-actions"><small>블록 안에 일정을 적으세요. 선택 초기화는 병합만 풉니다. 요일·전체 초기화는 내용도 지웁니다. 변경 후 ‘시간표 저장’을 눌러 주세요.</small><button type="submit">시간표 저장</button></div>`}</form></section>`;
}

export function resetTimetable(cells,day){return day===undefined?[]:cells.filter(c=>c.day!==day)}
export function fitTimetable(root=document){for(const el of root.querySelectorAll('.timetable-cell textarea')){const scroll=el.scrollTop;el.style.height='0px';el.style.height=Math.min(el.scrollHeight,el.parentElement.clientHeight)+'px';el.scrollTop=scroll}}
