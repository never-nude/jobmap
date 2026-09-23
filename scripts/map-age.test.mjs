import test from 'node:test';
import assert from 'node:assert/strict';
import {jobAge,AGE_BANDS,compareNewest,ageBreakdown,agePie,recentPostedCount,isRecentPosting} from '../age.mjs';

test('posting colors use exact elapsed week and month boundaries',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z'),day=86400000;
 const cases=[[0,'green'],[7*day,'green'],[7*day+1,'yellow'],[7.9*day,'yellow'],[14*day,'yellow'],[14*day+1,'red'],[30*day,'red']];
 for(const [elapsed,key] of cases){
  const age=jobAge(new Date(now-elapsed).toISOString(),now);
  assert.equal(age.key,key,`Age at ${elapsed} milliseconds`);
  assert.equal(age.color,{green:'#20916b',yellow:'#d4a600',red:'#d24c4c'}[key]);
 }
 assert.equal(jobAge(new Date(now-7.9*day).toISOString(),now).label,'7d ago');
 assert.deepEqual(AGE_BANDS.map(({key,label})=>[key,label]),[['green','Past week'],['yellow','8–14 days'],['red','15–30 days']]);
});

test('future and invalid posting dates have unknown age rather than appearing recent',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 for(const postedAt of [new Date(now+1).toISOString(),'invalid',null,undefined,'']){
  assert.deepEqual(jobAge(postedAt,now),{key:'unknown',color:'#7c8996',label:'Date unavailable',days:null});
 }
});

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

test('city breakdown includes only postings within thirty days and preserves all three age bands',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const jobs=[0,7,8,14,15,30,31,90,null].map(days=>({postedAt:days===null?null:new Date(now-days*86400000).toISOString(),firstSeenAt:new Date(now).toISOString()}));
 const bands=ageBreakdown(jobs,now);
 assert.deepEqual(bands.map(({key,count})=>[key,count]),[['green',2],['yellow',2],['red',2]]);
 assert.equal(bands.reduce((n,b)=>n+b.count,0),6);
 assert.deepEqual(ageBreakdown([],now),[]);
});

test('city pie proportions represent each job in posting-age order from twelve o’clock',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const jobs=[0,1,8,9,14,15,16,20,30,5].map(days=>({postedAt:days===null?null:new Date(now-days*86400000).toISOString()}));
 const {bands,gradient}=agePie(jobs,now);
 assert.deepEqual(bands.map(({key,count})=>[key,count]),[['green',3],['yellow',3],['red',4]]);
 assert.equal(gradient,'conic-gradient(from 0deg, #20916b 0% 30%, #d4a600 30% 60%, #d24c4c 60% 100%)');
});

test('city pie excludes missing, invalid, future and expired postings',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const jobs=[{postedAt:'2026-09-23T00:00:00Z'},{postedAt:null},{postedAt:'invalid'},{},{postedAt:new Date(now+1).toISOString()}];
 jobs.push({postedAt:'2026-08-01'});
 const {bands,gradient}=agePie(jobs,now);
 assert.deepEqual(bands.map(({key,count})=>[key,count]),[['green',1]]);
 assert.equal(gradient,'conic-gradient(from 0deg, #20916b 0% 100%)');
});

test('city pie uses a complete circle when all jobs share one age band',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const {bands,gradient}=agePie([{postedAt:'2026-09-01'},{postedAt:'2026-09-02'}],now);
 assert.deepEqual(bands.map(({key,count})=>[key,count]),[['red',2]]);
 assert.equal(gradient,'conic-gradient(from 0deg, #d24c4c 0% 100%)');
});

test('city pie retains fractional wedges without gaps or rounding whole-job proportions',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const {gradient}=agePie([{postedAt:'2026-09-23'},{postedAt:'2026-09-01'},{postedAt:'2026-09-02'}],now);
 const stops=[...gradient.matchAll(/#[a-f0-9]+ ([\d.]+)% ([\d.]+)%/g)].map(match=>[Number(match[1]),Number(match[2])]);
 assert.equal(stops.length,2);
 assert.equal(stops[0][0],0);
 assert(Math.abs(stops[0][1]-100/3)<1e-10);
 assert.equal(stops[1][0],stops[0][1]);
 assert.equal(stops[1][1],100);
});

test('empty city pie has no gradient or age bands',()=>{
 assert.deepEqual(agePie([]),{bands:[],gradient:'none'});
});

test('recent postings include the exact seven-day cutoff and now, excluding future and unknown dates',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z'),cutoff=now-7*86400000;
 const jobs=[now,cutoff,now-12*3600000,cutoff-1,now+1].map(time=>({postedAt:new Date(time).toISOString()}));
 jobs.push({postedAt:null},{postedAt:'invalid'},{postedAt:''},{});
 assert.equal(recentPostedCount(jobs,now),3);
 assert.equal(ageBreakdown(jobs,now).find(band=>band.key==='green').count,recentPostedCount(jobs,now));
});

test('recent posting count uses employer dates rather than discovery dates',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 const jobs=[
  {postedAt:'2026-09-20T12:00:00Z',firstSeenAt:'2026-08-01T12:00:00Z'},
  {postedAt:'2026-08-01T12:00:00Z',firstSeenAt:'2026-09-23T12:00:00Z'},
  {postedAt:null,firstSeenAt:'2026-09-23T12:00:00Z'},
 ];
 assert.equal(recentPostedCount(jobs,now),1);
});

test('recent posting boundary compares actual times across timezone offsets',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z');
 assert.equal(recentPostedCount([
  {postedAt:'2026-09-16T08:00:00-04:00'},
  {postedAt:'2026-09-16T07:59:59-04:00'},
 ],now),1);
 assert.equal(recentPostedCount([],now),0);
});


test('only finite employer posting dates within thirty days are eligible, including exact boundaries',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z'),cutoff=now-30*86400000;
 for(const time of [now,now-1,cutoff+1,cutoff])assert.equal(isRecentPosting(new Date(time).toISOString(),now),true);
 for(const postedAt of [new Date(now+1).toISOString(),new Date(cutoff-1).toISOString(),'invalid','',null,undefined,Infinity,now])assert.equal(isRecentPosting(postedAt,now),false);
 for(const invalidNow of [NaN,Infinity,-Infinity])assert.equal(isRecentPosting('2026-09-23T12:00:00Z',invalidNow),false);
});

test('recency follows elapsed time across timezone offsets and expires without a new feed',()=>{
 const now=Date.parse('2026-09-23T12:00:00Z'),postedAt='2026-08-24T08:00:00-04:00';
 assert.equal(isRecentPosting(postedAt,now),true);
 assert.equal(isRecentPosting(postedAt,now+1),false);
 assert.equal(isRecentPosting('2026-08-24T07:59:59-04:00',now),false);
 const cached=[{postedAt,firstSeenAt:'2026-09-23T12:00:00Z',updatedAt:'2026-09-23T12:00:00Z'},{postedAt:null,firstSeenAt:'2026-09-23T12:00:00Z'}];
 assert.equal(cached.filter(job=>isRecentPosting(job.postedAt,now)).length,1);
 assert.equal(cached.filter(job=>isRecentPosting(job.postedAt,now+1)).length,0);
 assert.deepEqual(agePie(cached,now+1),{bands:[],gradient:'none'});
});
