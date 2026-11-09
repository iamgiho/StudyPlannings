import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stats,monthEnd,monday,today,escape} from '../web/domain.js';
test('standalone HTML stats preserve reporting semantics and month boundaries',()=>{
 const rows=[{due_date:'2026-11-01',status:'done',cancelled:false},{due_date:'2026-11-02',status:'incomplete',cancelled:false},{due_date:'2026-11-03',status:'unreported',cancelled:false},{due_date:'2026-11-09',status:'done',cancelled:false},{due_date:'2026-12-01',status:'done',cancelled:false}];
 const s=stats(rows,'2026-11-01','2026-11-30','2026-11-09');assert.equal(s.rate,.5);assert.equal(s.reporting,2/3);assert.equal(s.unreported,1);assert.equal(s.total,4);assert.equal(stats([],'2026-11-01','2026-11-30').rate,null);assert.equal(monthEnd('2028-02'),'2028-02-29');assert.equal(monday('2026-11-01'),'2026-10-26');assert.equal(today(new Date('2026-10-31T16:00:00Z')),'2026-11-01');
});
test('HTML text and attribute values are escaped',()=>{assert.equal(escape('<img src=x onerror="evil()">'), '&lt;img src=x onerror=&quot;evil()&quot;&gt;');assert.equal(escape("a'b&"),'a&#39;b&amp;')});
