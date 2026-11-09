import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timetableDays,timetableHours,timetableSection,changeTimetableBlock,resetTimetable} from '../web/timetable.js';
test('timetable has Monday to Sunday, 24 rows from 06:00 to 05:00 and 168 editable cells',()=>{
 assert.deepEqual(timetableDays,['월','화','수','목','금','토','일']);assert.equal(timetableHours.length,24);assert.equal(timetableHours[0],6);assert.equal(timetableHours[23],5);assert.equal(new Set(timetableHours).size,24);
 const html=timetableSection();assert.equal((html.match(/<textarea /g)||[]).length,168);assert.equal((html.match(/scope="row"/g)||[]).length,24);assert.ok(html.indexOf('>06:00</th>')<html.indexOf('>05:00</th>'));assert.ok(html.includes('aria-label="일요일 06:00"'));assert.ok(html.includes('aria-label="토요일 05:00"'));
});
test('timetable restores a cell and escapes user content',()=>{
 const html=timetableSection([{day:1,hour:6,content:'학교 & <과제>'}]);assert.ok(html.includes('학교 &amp; &lt;과제&gt;'));assert.ok(!html.includes('학교 & <과제>'));assert.ok(html.includes('data-day="1" data-hour="6" data-span="1"'));assert.ok(html.indexOf('>월</th>')<html.indexOf('>일</th>'));
});

test('merge and split preserve text and weekday identities across midnight',()=>{
 const cells=[{day:1,hour:23,content:'학원'},{day:1,hour:0,content:'복습'},{day:0,hour:23,content:'일요일'}];
 const merged=changeTimetableBlock(cells,1,17,19);assert.deepEqual(merged.find(c=>c.day===1),{day:1,hour:23,span:2,content:'학원\n복습'});
 const html=timetableSection(merged);assert.ok(html.includes('rowspan="2"'));assert.equal((html.match(/<textarea /g)||[]).length,167);assert.ok(!html.includes('aria-label="월요일 00:00"'));
 assert.throws(()=>changeTimetableBlock(merged,1,18,20));
 const split=changeTimetableBlock(merged,1,17,19,true);assert.equal(split.find(c=>c.day===1).span,1);assert.equal(split.find(c=>c.day===1).content,'학원\n복습');assert.equal(split.find(c=>c.day===0).content,'일요일');
 assert.throws(()=>changeTimetableBlock(cells,1,2,1));assert.throws(()=>changeTimetableBlock([{day:1,hour:6,content:'a'.repeat(100)},{day:1,hour:7,content:'b'.repeat(100)}],1,0,2));
});
test('empty merged blocks survive rendering',()=>{const merged=changeTimetableBlock([],2,0,3);assert.equal(merged[0].span,3);assert.ok(timetableSection(merged).includes('화요일 06:00 3시간 블록'))});

test('day reset removes that weekday and all reset clears only the supplied week draft',()=>{
 const cells=[{day:0,hour:6,span:2,content:'일요일'},{day:1,hour:23,span:3,content:'월요일 밤'},{day:1,hour:8,content:'학교'}];
 assert.deepEqual(resetTimetable(cells,1),[cells[0]]);assert.deepEqual(resetTimetable(cells,0),cells.slice(1));assert.deepEqual(resetTimetable(cells),[]);assert.equal(cells.length,3);
 const html=timetableSection();assert.ok(html.includes('>선택 초기화</button>'));assert.ok(html.includes('>요일 초기화</button>'));assert.ok(html.includes('>전체 초기화</button>'));assert.ok(!html.includes('>블록 나누기</button>'));
});

test('coach view shares the grid and blocks while disabling student editing controls',()=>{const cells=[{day:1,hour:9,span:3,content:'영어 학원'}];const student=timetableSection(cells),coach=timetableSection(cells,{readOnly:true});assert.ok(student.includes('>시간표 저장</button>'));assert.ok(!coach.includes('data-action="merge-timetable"'));assert.ok(!coach.includes('>시간표 저장</button>'));assert.equal((coach.match(/readonly/g)||[]).length,166);assert.ok(coach.includes('rowspan="3"'));assert.ok(coach.includes('영어 학원'));assert.equal(coach.match(/<table[\s\S]*?<\/table>/)?.[0].replaceAll(' readonly',''),student.match(/<table[\s\S]*?<\/table>/)?.[0]);});
