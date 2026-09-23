import test from 'node:test';
import assert from 'node:assert/strict';
import {salary,plain,workMode,relevant,locate,normalize,reconcile} from './normalize.mjs';
import {jobAge} from '../age.mjs';
const now='2026-09-23T12:00:00Z';
const cities=[{name:'Boston',state:'MA',lat:42.36,lng:-71.06,population:600000},{name:'London',state:'OH',lat:39.89,lng:-83.44,population:10000}];
test('salary excludes sub-threshold bands, equity, hourly and non-USD pay',()=>{
 assert.equal(salary({},'greenhouse','Base salary $90,000 - $160,000 per year'),null);
 assert.equal(salary({},'greenhouse','Bonus $100,000 - $150,000'),null);
 assert.equal(salary({},'greenhouse','Base pay $120 - $150 per hour'),null);
 assert.equal(salary({},'greenhouse','Annual salary CAD $120,000 - $150,000'),null);
 assert.equal(salary({salaryRange:{min:120000,max:150000,currency:'CAD',interval:'per-year-salary'}},'lever',''),null);
 assert.equal(salary({compensation:{summaryComponents:[{compensationType:'EquityPercentage',minValue:100000,maxValue:200000}]}},'ashby',''),null);
});
test('salary decodes employer HTML and uses the minimum across levels',()=>{
 const text=plain('US Salary Range&lt;div&gt;&lt;span&gt;$100,000&lt;/span&gt;&amp;mdash;&lt;span&gt;$120,000 USD&lt;/span&gt;&lt;/div&gt;');
 assert.equal(salary({},'greenhouse',text).min,100000);
 assert.equal(salary({},'greenhouse','Compensation: Level 2 $110,000 - $145,000. Level 3 $140,000 - $190,000. Your base salary depends on level.').min,110000);
 assert.equal(salary({},'greenhouse','Base salary $95,000 - $145,000. Senior $140,000 - $190,000.'),null);
 assert.equal(salary({},'greenhouse','Annual salary $100k–$150k').max,150000);
 assert.equal(salary({},'greenhouse','Annual base salary $130000 - $190000').min,130000);
});
test('work setting requires evidence; hybrid hardware and onsite benefits do not qualify',()=>{
 assert.equal(workMode({},'Boston, MA','Develop hybrid electric vehicles. On-site gym.'),'Not specified');
 assert.equal(workMode({workplaceType:'Hybrid'},'Boston, MA',''),'Hybrid');
 assert.equal(workMode({},'Remote - United States',''),'Remote');
 assert.equal(workMode({},'Boston, MA','This position is on-site in Boston.'),'On-site');
 assert.equal(workMode({},'Boston, MA','This is not a fully remote role.'),'Not specified');
});
test('foreign jobs, technicians, internships, and missing salary are excluded',()=>{
 assert.equal(locate('London, United Kingdom','GB',cities),null);
 assert.equal(locate('Boston, MA','US',cities).state,'MA');
 assert.equal(locate('Remote - United States','US',cities).lat,null);
 assert.equal(relevant('Mechanical Engineering Intern'),false);
 assert.equal(relevant('Mechanical Technician'),false);
 assert.equal(relevant('Senior Engineer, Mechanical'),true);
 assert.equal(normalize({id:1,title:'Mechanical Engineer',location:{name:'Boston, MA'},absolute_url:'https://example.com/job'}, {type:'greenhouse',slug:'test',company:'Test'},cities,now),null);
});
test('age boundaries and missing dates match the legend',()=>{
 for(const [days,key] of [[0,'green'],[7,'green'],[7.001,'yellow'],[8,'yellow'],[14,'yellow'],[15,'yellow'],[30,'yellow'],[30.001,'red'],[31,'red']])assert.equal(jobAge(new Date(Date.parse(now)-days*86400000).toISOString(),Date.parse(now)).key,key);
 assert.equal(jobAge(null).key,'unknown');
});
test('closed jobs disappear; outages retain flagged results for at most 24 hours',()=>{
 const previous={jobs:[{id:'1',url:'https://example.com/1',sourceId:'test',checkedAt:now}],sources:[{slug:'test',checkedAt:now}]};
 assert.equal(reconcile(previous,[{ok:true,source:{slug:'test'},total:0,jobs:[]}],now).jobs.length,0);
 assert.equal(reconcile(previous,[{ok:false,source:{slug:'test'},error:'timeout'}],now).jobs[0].stale,true);
 assert.equal(reconcile(previous,[{ok:false,source:{slug:'test'}}],'2026-09-24T13:00:00Z').jobs.length,0);
});
test('negated hybrid and remote wording is not a hybrid classification',()=>{
 assert.equal(workMode({},'Hawthorne, CA','This is not a remote or hybrid position and will require relocation.'),'On-site');
});
test('multiple US posting locations are retained',()=>{
 const job=normalize({id:1,title:'Mechanical Engineer',location:{name:'Boston, MA; London, OH'},first_published:'2026-09-22',content:'Annual salary $110,000 - $150,000',absolute_url:'https://example.com/1'},{type:'greenhouse',slug:'test',company:'Test'},cities,now);
 assert.equal(job.locations.length,2);assert.equal(job.locations[1].state,'OH');
});
test('SmartRecruiters requires a public active posting and annual USD pay',()=>{
 const base={id:99,name:'Senior Mechanical Engineer',active:true,visibility:'PUBLIC',location:{city:'Boston',region:'MA',country:'us',hybrid:true,fullLocation:'Boston, MA, United States'},compensation:{min:120000,max:145000,currency:'USD',period:'YEARLY'},releasedDate:'2026-09-22',postingUrl:'https://jobs.smartrecruiters.com/Test/99',applyUrl:'https://jobs.smartrecruiters.com/Test/99?oga=true',jobAd:{sections:{qualifications:{text:'5 years of experience in CAD.'}}}};
 const source={type:'smartrecruiters',slug:'Test',company:'Test'};
 assert.equal(normalize(base,source,cities,now).workMode,'Hybrid');
 assert.equal(normalize({...base,visibility:'INTERNAL'},source,cities,now),null);
 assert.equal(normalize({...base,active:false},source,cities,now),null);
 assert.equal(normalize({...base,compensation:{...base.compensation,period:'HOURLY'}},source,cities,now),null);
});
const observedJob=(id,extra={})=>({id,sourceId:'test',url:`https://example.com/${id}`,checkedAt:now,...extra});
const feed=jobs=>[{ok:true,source:{slug:'test'},total:jobs.length,jobs}];
test('first discovery stays stable through employer updates and does not use the posting date',()=>{
 const original='2026-09-01T12:00:00.000Z';
 const previous={generatedAt:'2026-09-22T12:00:00Z',jobs:[observedJob('existing',{firstSeenAt:original})]};
 const result=reconcile(previous,feed([
 observedJob('existing',{postedAt:now,title:'Updated title'}),
 observedJob('new',{postedAt:'2025-01-01T00:00:00Z'}),
 ]),now);
 assert.equal(result.jobs.find(j=>j.id==='existing').firstSeenAt,original);
 assert.equal(result.jobs.find(j=>j.id==='new').firstSeenAt,new Date(now).toISOString());
 assert.deepEqual(result.firstSeenById,{existing:original,new:new Date(now).toISOString()});
});
test('first-discovery history survives an empty feed and a later reappearance',()=>{
 const first=reconcile(null,feed([observedJob('returning')]),now);
 const empty=reconcile(first,feed([]),'2026-09-24T12:00:00Z');
 assert.equal(empty.jobs.length,0);
 assert.deepEqual(empty.firstSeenById,first.firstSeenById);
 const later=reconcile(empty,feed([observedJob('returning',{checkedAt:'2026-10-01T12:00:00Z'})]),'2026-10-01T12:00:00Z');
 assert.equal(later.jobs[0].firstSeenAt,new Date(now).toISOString());
});
test('legacy snapshots migrate from valid observation dates, including disappearing jobs',()=>{
 const generatedAt='2026-09-20T12:00:00Z',checkedAt='2026-09-19T12:00:00Z';
 const previous={generatedAt,jobs:[observedJob('present',{checkedAt,postedAt:'2025-01-01T00:00:00Z'}),observedJob('gone',{checkedAt:'invalid'})]};
 const result=reconcile(previous,feed([observedJob('present')]),now);
 assert.equal(result.jobs[0].firstSeenAt,new Date(checkedAt).toISOString());
 assert.equal(result.firstSeenById.gone,new Date(generatedAt).toISOString());
 const fallback=reconcile({generatedAt:'invalid',jobs:[observedJob('checked',{checkedAt})]},feed([observedJob('checked')]),now);
 assert.equal(fallback.jobs[0].firstSeenAt,new Date(checkedAt).toISOString());
});
test('invalid and future first-discovery timestamps fall back to known observations',()=>{
 const previous={generatedAt:'invalid',firstSeenById:{invalid:'bad date',future:'2099-01-01T00:00:00Z',saved:'2026-09-01T12:00:00Z'},jobs:[observedJob('saved',{firstSeenAt:'2099-01-01T00:00:00Z'})]};
 const result=reconcile(previous,feed([observedJob('invalid'),observedJob('future'),observedJob('saved')]),now);
 assert.equal(result.firstSeenById.invalid,new Date(now).toISOString());
 assert.equal(result.firstSeenById.future,new Date(now).toISOString());
 assert.equal(result.firstSeenById.saved,'2026-09-01T12:00:00.000Z');
});
test('failed feeds retain first-discovery dates, including after stale jobs expire',()=>{
 const first=reconcile(null,feed([observedJob('outage')]),now);
 const failed=[{ok:false,source:{slug:'test'},error:'timeout'}];
 const stale=reconcile(first,failed,'2026-09-23T13:00:00Z');
 assert.equal(stale.jobs[0].stale,true);
 assert.equal(stale.jobs[0].firstSeenAt,first.jobs[0].firstSeenAt);
 const expired=reconcile(stale,failed,'2026-09-25T12:00:00Z');
 assert.equal(expired.jobs.length,0);
 assert.deepEqual(expired.firstSeenById,first.firstSeenById);
});
