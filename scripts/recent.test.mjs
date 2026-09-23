import test from 'node:test';
import assert from 'node:assert/strict';
import {restrictToRecent} from './recent.mjs';
const now=Date.parse('2026-09-23T12:00:00Z'),day=86400000;
test('30-day publication window also expires fallback jobs without deleting discovery history',()=>{
 const at=days=>new Date(now-days*day).toISOString();
 const jobs=[{id:'lever:employer:fresh',postedAt:at(7)},{id:'lever:employer:boundary',postedAt:at(30),stale:true},{id:'lever:employer:old',postedAt:at(30+1/86400000),stale:true},{id:'lever:employer:unknown',postedAt:null},{id:'lever:employer:future',postedAt:at(-1)}];
 const firstSeenById=Object.fromEntries(jobs.map(j=>[j.id,at(60)]));
 const snapshot=restrictToRecent({jobs,firstSeenById,sources:[{type:'lever',slug:'employer',ok:false,matches:5}]},now);
 assert.deepEqual(snapshot.jobs.map(j=>j.id),['lever:employer:fresh','lever:employer:boundary']);
 assert.equal(snapshot.sources[0].matches,2);assert.equal(snapshot.sources[0].ok,false);
 assert.equal(snapshot.maxPostingAgeDays,30);assert.deepEqual(snapshot.firstSeenById,firstSeenById);
});
