import test from 'node:test';
import assert from 'node:assert/strict';
import {compareNewest,ageBreakdown} from '../age.mjs';

test('newest order uses posting time regardless of sector, discovery date or timezone',()=>{
 const jobs=[
  {id:'older-energy',sourceId:'cfsenergy',postedAt:'2026-09-20T12:00:00Z',firstSeenAt:'2026-09-23T00:00:00Z'},
  {id:'newest',postedAt:'2026-09-22T08:00:00-04:00',firstSeenAt:'2026-09-22T12:00:00Z'},
  {id:'one-hour-older',postedAt:'2026-09-22T11:00:00Z'},
  {id:'unknown',postedAt:null},
  {id:'invalid',postedAt:'invalid'},
 ];
 assert.deepEqual(jobs.sort(compareNewest).map(j=>j.id),['newest','one-hour-older','older-energy','unknown','invalid']);
});

test('city breakdown reports every age including missing dates without recoloring a total',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const jobs=[0,7,8,14,15,30,31,90,null].map(days=>({postedAt:days===null?null:new Date(now-days*86400000).toISOString(),firstSeenAt:new Date(now).toISOString()}));
 const bands=ageBreakdown(jobs,now);
 assert.deepEqual(bands.map(({key,count})=>[key,count]),[['blue',2],['green',2],['yellow',2],['red',2],['unknown',1]]);
 assert.equal(bands.reduce((n,b)=>n+b.count,0),jobs.length);
 assert.deepEqual(ageBreakdown([],now),[]);
});
