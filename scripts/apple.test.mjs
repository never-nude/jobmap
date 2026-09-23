import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAppleHydration,appleDetailUrl,appleJobDetail,fetchApple} from './apple.mjs';
const now=Date.parse('2026-09-23T14:00:00Z');
const html=data=>`<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify({loaderData:data}))});</script>`;
const detail={jobNumber:'200685349-3401',postingTitle:'Mechanical Engineer',transformedPostingTitle:'mechanical-engineer',managedPipelineRole:false,postDateInGMT:'2026-09-23T13:00:00Z',description:'Design mechanical hardware.',minimumQualifications:'Degree in Mechanical Engineering.',locations:[{id:'CA',name:'Cupertino',stateProvince:'California',countryID:'iso-country-USA',active:true}],postingFooters:[{postLocationId:'CA',localizations:{en_US:[{name:'Pay & Benefits',content:'The base pay range is between $184,700 and $324,800.'}]}}]};
const listing={reqId:detail.jobNumber,postingTitle:detail.postingTitle,transformedPostingTitle:detail.transformedPostingTitle,managedPipelineRole:false,postDateInGMT:detail.postDateInGMT};
const page=(p,rows,total)=>html({search:{page:p,search:'mechanical',sort:'newest',queryParams:{location:'united-states-USA'},totalRecords:total,searchResults:rows}});
test('Apple hydration parses escaped JSON without evaluating scripts',()=>{assert.deepEqual(parseAppleHydration(html({search:{title:'a "quoted" job'}})),{search:{title:'a "quoted" job'}});assert.throws(()=>parseAppleHydration('<script>globalThis.bad=true</script>'));assert.throws(()=>parseAppleHydration('window.__staticRouterHydrationData=JSON.parse(process.env.X)'));});
test('Apple job identity and country are verified; pipeline pools excluded',()=>{assert.throws(()=>appleDetailUrl('../123','mechanical-engineer'));assert.throws(()=>appleDetailUrl('200685349-3401','../elsewhere'));assert.throws(()=>appleJobDetail(html({jobDetails:{jobsData:detail}}),'200000000'));assert.equal(appleJobDetail(html({jobDetails:{jobsData:{...detail,managedPipelineRole:true}}}),detail.jobNumber),null);assert.equal(appleJobDetail(html({jobDetails:{jobsData:{...detail,locations:[{countryID:'iso-country-CAN'}]}}}),detail.jobNumber),null);});
test('Apple detail preserves original posting date, qualifications, direct apply and base salary',()=>{const job=appleJobDetail(html({jobDetails:{jobsData:detail}}),detail.jobNumber);assert.equal(job.createdAt,detail.postDateInGMT);assert.match(job.content,/Degree in Mechanical Engineering/);assert.match(job.content,/\$184,700 and \$324,800/);assert.equal(job.country,'US');assert.equal(job.applyUrl,'https://jobs.apple.com/en-us/details/200685349-3401/mechanical-engineer');});
test('Apple pagination completes search and only fetches recent matching real roles',async()=>{const calls=[];const old={...listing,reqId:'200685348-3401',postDateInGMT:'2026-08-01T00:00:00Z'};const pool={...listing,reqId:'200685347-3401',managedPipelineRole:true};const fetchText=async url=>{calls.push(url);if(url.includes('/details/'))return html({jobDetails:{jobsData:detail}});return new URL(url).searchParams.get('page')==='1'?page(1,[old,listing],3):page(2,[pool],3);};const jobs=await fetchApple({slug:'apple'},fetchText,{now,isCandidate:t=>t==='Mechanical Engineer'});assert.equal(jobs.length,1);assert.equal(calls.filter(u=>u.includes('/details/')).length,1);assert.equal(calls.length,3);});
test('Apple fails closed for incomplete pagination, ignored query or mismatched detail',async()=>{await assert.rejects(fetchApple({slug:'apple'},async url=>new URL(url).searchParams.get('page')==='1'?page(1,[listing],2):page(2,[],2),{now}),/Incomplete/);await assert.rejects(fetchApple({slug:'apple'},async()=>page(1,[listing],1).replace('mechanical','software'),{now}),/Invalid/);await assert.rejects(fetchApple({slug:'apple'},async url=>url.includes('/details/')?html({jobDetails:{jobsData:{...detail,jobNumber:'200000000'}}}):page(1,[listing],1),{now}),/Invalid/);});

test('Apple employer base-pay wording normalizes without using equity or a fabricated date',async()=>{
 const {normalize}=await import('./normalize.mjs');
 const raw=appleJobDetail(html({jobDetails:{jobsData:detail}}),detail.jobNumber);
 const job=normalize(raw,{type:'apple',slug:'apple',company:'Apple'},[{name:'Cupertino',state:'CA',lat:37.32,lng:-122.03,population:60000}],new Date(now).toISOString());
 assert.equal(job.salary.min,184700);assert.equal(job.salary.max,324800);assert.equal(job.postedAt,'2026-09-23T13:00:00.000Z');assert.equal(job.geo.city,'Cupertino');
});

test('Apple ignores foreign pay footers and rejects pagination duplicates',async()=>{
 const mixed={...detail,postingFooters:[...detail.postingFooters,{postLocationId:'CA-CANADA',localizations:{en_US:[{name:'Pay & Benefits',content:'Base pay CAD $90000–$110000'}]}}]};
 assert.doesNotMatch(appleJobDetail(html({jobDetails:{jobsData:mixed}}),detail.jobNumber).content,/CAD/);
 await assert.rejects(fetchApple({slug:'apple'},async url=>page(Number(new URL(url).searchParams.get('page')),[listing],2),{now}),/repeated/);
});

test('Apple skips confirmed removed roles but propagates network/rate-limit failures',async()=>{
 for(const status of [404,410]){const jobs=await fetchApple({slug:'apple'},async url=>{if(url.includes('/details/'))throw Object.assign(Error('gone'),{status});return page(1,[listing],1);},{now});assert.deepEqual(jobs,[]);}
 await assert.rejects(fetchApple({slug:'apple'},async url=>{if(url.includes('/details/'))throw Object.assign(Error('rate limited'),{status:429});return page(1,[listing],1);},{now}),/rate limited/);
});

test('Apple counts one position across location variants, preserving locations, salary floors, and earliest date',async()=>{
 const {normalize}=await import('./normalize.mjs');
 const later={...detail,jobNumber:'200685349-3401',postDateInGMT:'2026-09-20T13:00:00Z'};
 const earlier={...detail,jobNumber:'200685349-0836',postDateInGMT:'2026-09-10T13:00:00Z',locations:[{id:'TX',name:'Austin',stateProvince:'Texas',countryID:'iso-country-USA',active:true}],postingFooters:[{postLocationId:'TX',localizations:{en_US:[{name:'Pay & Benefits',content:'The base pay range is between $120,000 and $210,000.'}]}}]};
 const rows=[later,earlier].map(d=>({...listing,reqId:d.jobNumber,positionId:'200685349',postDateInGMT:d.postDateInGMT}));
 const fetchText=async url=>url.includes('/search?')?page(1,rows,2):html({jobDetails:{jobsData:url.includes('-0836/')?earlier:later}});
 const jobs=await fetchApple({slug:'apple'},fetchText,{now});assert.equal(jobs.length,1);
 assert.equal(jobs[0].id,'200685349-0836');assert.match(jobs[0].applyUrl,/-0836\//);assert.match(jobs[0].location,/Austin/);assert.match(jobs[0].location,/Cupertino/);assert.equal(jobs[0].createdAt,'2026-09-10T13:00:00.000Z');
 const job=normalize(jobs[0],{type:'apple',slug:'apple',company:'Apple'},[],new Date(now).toISOString());
 assert.equal(job.salary.min,120000);assert.equal(job.salary.max,324800);assert.equal(job.locations.length,2);
});

test('Apple checks older variants so a new location does not refresh an old position',async()=>{
 const older={...detail,jobNumber:'200685349-0836',postDateInGMT:'2026-08-01T13:00:00Z'};
 const rows=[listing,{...listing,reqId:older.jobNumber,postDateInGMT:older.postDateInGMT}];let fetched=0;
 const jobs=await fetchApple({slug:'apple'},async url=>{if(url.includes('/search?'))return page(1,rows,2);fetched++;return html({jobDetails:{jobsData:url.includes('-0836/')?older:detail}});},{now});
 assert.equal(fetched,2);assert.deepEqual(jobs,[]);
});

test('Apple rejects conflicting employer position identities',async()=>{
 await assert.rejects(fetchApple({slug:'apple'},async()=>page(1,[{...listing,positionId:'200000000'}],1),{now}),/position identity/);
});
