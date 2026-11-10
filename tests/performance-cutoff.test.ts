import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {stats} from '../web/domain.js';

test('08:00 Seoul cutoff uses frozen partial status despite later full completion',()=>{
 const task={due_date:'2026-11-09',performance_date:'2026-11-09',status:'done',performance_status:'incomplete',cancelled:false};
 assert.equal(stats([task],'2026-11-09','2026-11-15','2026-11-10T07:59:59+09:00').checked,0);
 assert.equal(stats([task],'2026-11-09','2026-11-15','2026-11-10T08:00:00+09:00').rate,.5);
 assert.equal(stats([task],'2026-11-09','2026-11-15','2026-11-10T17:00:00+09:00').rate,.5);
 assert.equal(stats([{...task,performance_status:'unreported'}],'2026-11-09','2026-11-15','2026-11-10T17:00:00+09:00').checked,0);
 assert.equal(stats([{...task,due_date:'2026-11-12'}],'2026-11-09','2026-11-09','2026-11-10T17:00:00+09:00').rate,.5);
 assert.equal(stats([{...task,cancelled:true}],'2026-11-09','2026-11-15','2026-11-10T17:00:00+09:00').rate,null);
});

test('Postgres backfills cutoff history and prevents late status or date changes from rewriting statistics',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema planner_private;
 create table public.tasks(id int primary key,due_date date,status text not null default 'unreported',cancelled boolean default false,student_note text default '');
 create table public.audit_logs(id bigint generated always as identity primary key,entity text,new_data jsonb,created_at timestamptz);
 insert into tasks(id,due_date,status) values(1,(now() at time zone 'Asia/Seoul')::date-2,'done'),(2,(now() at time zone 'Asia/Seoul')::date-2,'done'),(3,(now() at time zone 'Asia/Seoul')::date-2,'done');
 insert into audit_logs(entity,new_data,created_at)
 select 'tasks',jsonb_build_object('id',id,'due_date',due_date,'status','incomplete'),((due_date+1+time '07:59:59') at time zone 'Asia/Seoul') from tasks where id in(1,3);
 insert into audit_logs(entity,new_data,created_at)
 select 'tasks',jsonb_build_object('id',id,'due_date',due_date,'status','done'),((due_date+1+case when id=3 then time '08:00:00' else time '17:00:00' end) at time zone 'Asia/Seoul') from tasks where id in(1,3);`);
 const migration=readFileSync('supabase/migrations/20261110020040_performance_cutoff_snapshot.sql','utf8').split('-- Portal reads')[0];
 await db.exec(migration);
 await db.exec(readFileSync('supabase/migrations/20261110020540_performance_cutoff_eight_am.sql','utf8'));
 const rows=await db.query<{id:number;performance_status:string}>('select id,performance_status from tasks order by id');
 assert.deepEqual(rows.rows.map(r=>r.performance_status),['incomplete','unreported','incomplete']);
 await db.exec(`update tasks set status='not_done',student_note='늦게 바꾼 메모',due_date=(now() at time zone 'Asia/Seoul')::date+1,performance_status='done',performance_date=(now() at time zone 'Asia/Seoul')::date+1 where id=1;`);
 const closed=await db.query<{status:string;performance_status:string;days:number}>(`select status,performance_status,((now() at time zone 'Asia/Seoul')::date-performance_date) as days from tasks where id=1`);
 assert.equal(closed.rows[0].status,'not_done');assert.equal(closed.rows[0].performance_status,'incomplete');assert.equal(closed.rows[0].days,2);
 await db.exec(`insert into tasks(id,due_date,status) values(4,(now() at time zone 'Asia/Seoul')::date,'incomplete');update tasks set status='done' where id=4;
 insert into tasks(id,due_date,status) values(5,(now() at time zone 'Asia/Seoul')::date-2,'done');`);
 const open=await db.query<{performance_status:string}>('select performance_status from tasks where id in(4,5) order by id');
 assert.deepEqual(open.rows.map(r=>r.performance_status),['done','unreported']);
 const permissions=await db.query<{allowed:boolean}>(`select has_function_privilege('authenticated','planner_private.freeze_task_performance()','execute') as allowed`);
 assert.equal(permissions.rows[0].allowed,false);
 }finally{await db.close()}
});
