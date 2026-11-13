import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutosaver} from '../web/autosave.js';
const tick=()=>new Promise(r=>setTimeout(r,15));
test('autosave serializes edits and keeps each student/week target captured',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r),writes:Array<{key:string;cells:unknown}>=[];
 const a=createAutosaver({delay:0,onState:()=>{},onSaved:()=>{},save:async(c:{key:string},cells:unknown)=>{writes.push({key:c.key,cells});if(writes.length===1)await gate}});
 a.queue({key:'student-a:week-1'},[{content:'old'}]);await tick();a.queue({key:'student-a:week-1'},[{content:'latest'}]);a.queue({key:'student-b:week-2'},[]);await tick();release();await tick();assert.deepEqual(writes.filter(x=>x.key==='student-a:week-1').map(x=>x.cells),[[{content:'old'}],[{content:'latest'}]]);assert.deepEqual(writes.find(x=>x.key==='student-b:week-2')?.cells,[]);
});
test('failed saves retain the payload and can be retried',async()=>{let attempts=0;const states:string[]=[];const a=createAutosaver({delay:0,onState:(_:unknown,s:string)=>states.push(s),onSaved:()=>{},save:async()=>{if(++attempts===1)throw Error('offline')}});a.queue({key:'a'},[]);await tick();assert.ok(states.includes('error'));a.flush();await tick();assert.equal(attempts,2);assert.equal(states.at(-1),'saved')});
