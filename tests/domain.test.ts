import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stats,today,monday,addDays,type Task} from '../lib/domain';
const task=(due_date:string,status:Task['status']='unreported',cancelled=false):Task=>({id:'1',student_id:'s',plan_id:'p',title:'가상 과제',description:'',subject:'수학',due_date,status,cancelled});
test('Seoul date and Monday handle UTC/month boundaries',()=>{assert.equal(today(new Date('2026-10-31T16:00:00Z')),'2026-11-01');assert.equal(monday('2026-11-01'),'2026-10-26');assert.equal(addDays('2026-12-31',1),'2027-01-01')});
test('unreported, incomplete, today, future and cancelled remain distinct',()=>{const s=stats([task('2026-11-01','done'),task('2026-11-02','incomplete'),task('2026-11-03'),task('2026-11-09','done'),task('2026-11-10'),task('2026-11-02','done',true)],'2026-11-01','2026-11-30','2026-11-09');assert.deepEqual(s,{total:5,due:3,done:1,incomplete:1,unreported:1,rate:.5,reporting:2/3})});
test('monthly range does not count neighboring months',()=>{const s=stats([task('2026-10-31','done'),task('2026-11-01','incomplete'),task('2026-12-01','done')],'2026-11-01','2026-11-30','2026-12-02');assert.equal(s.total,1);assert.equal(s.rate,0)});
test('empty denominators are no data, not zero percent',()=>{assert.equal(stats([],'2026-11-01','2026-11-30').rate,null);assert.equal(stats([task('2026-11-01')],'2026-11-01','2026-11-30','2026-11-02').rate,null)});
