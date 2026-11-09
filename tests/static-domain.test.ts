import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stats,monthEnd,monday,today,escape} from '../web/domain.js';
test('standalone HTML stats use weighted performance and month boundaries',()=>{
 const rows=[{due_date:'2026-11-01',status:'done',cancelled:false},{due_date:'2026-11-02',status:'incomplete',cancelled:false},{due_date:'2026-11-03',status:'unreported',cancelled:false},{due_date:'2026-11-09',status:'done',cancelled:false},{due_date:'2026-12-01',status:'done',cancelled:false}];
 const s=stats(rows,'2026-11-01','2026-11-30','2026-11-09');assert.equal(s.rate,.75);assert.equal(s.checked,2);assert.equal(s.notDone,0);assert.equal(s.total,4);assert.equal(stats([],'2026-11-01','2026-11-30').rate,null);assert.equal(monthEnd('2028-02'),'2028-02-29');assert.equal(monday('2026-11-01'),'2026-10-26');assert.equal(today(new Date('2026-10-31T16:00:00Z')),'2026-11-01');
});
test('HTML text and attribute values are escaped',()=>{assert.equal(escape('<img src=x onerror="evil()">'), '&lt;img src=x onerror=&quot;evil()&quot;&gt;');assert.equal(escape("a'b&"),'a&#39;b&amp;')});

test('performance excludes untouched tasks and scores full, partial and not done independently',()=>{
 const row=(status:string,date='2026-11-08',cancelled=false)=>({status,due_date:date,cancelled});
 const a=stats([row('done'),row('incomplete'),row('not_done'),row('unreported'),row('done','2026-11-09'),row('done','2026-11-08',true)],'2026-11-01','2026-11-30','2026-11-09');
 assert.equal(a.rate,.5);assert.equal(a.checked,3);assert.equal(a.done,1);assert.equal(a.incomplete,1);assert.equal(a.notDone,1);
 assert.equal(stats([row('not_done')],'2026-11-01','2026-11-30','2026-11-09').rate,0);
 assert.equal(stats([row('incomplete')],'2026-11-01','2026-11-30','2026-11-09').rate,.5);
 assert.equal(stats([row('unreported')],'2026-11-01','2026-11-30','2026-11-09').rate,null);
});
