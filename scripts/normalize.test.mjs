import test from 'node:test';
import assert from 'node:assert/strict';
import {salary,plain,workMode,relevant,candidateTitle,locate,normalize,reconcile,facts} from './normalize.mjs';
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
test('published USD ranges survive employer formatting and CAD design requirements',()=>{
 assert.equal(salary({},'workday','The base salary range is 152,000 USD - 253,000 USD.').min,152000);
 assert.equal(salary({},'greenhouse','Annual base salary $154,000 USD - $193,000 USD.').max,193000);
 assert.equal(salary({},'greenhouse','Strong 2D CAD capability in AutoCAD.\nUS Salary Range\n$166,000 — $220,000 USD\nThe salary range includes base salary only.').min,166000);
 assert.equal(salary({},'greenhouse','Base Compensation Range: $110,000 - $160,000').min,110000);
 assert.equal(salary({},'greenhouse','Compensation Components: Competitive base salaries, stock option grants, and annual bonuses\nTeam Growth: 300 employees\n$233k-292k\nThe stated compensation range reflects only the targeted base compensation range and excludes additional earnings such as bonus, equity, and benefits.').min,233000);
 assert.equal(salary({},'greenhouse','$198-248k\nThe stated compensation range reflects only the targeted base compensation range.').min,198000);
 assert.equal(salary({},'workday','Base salary: Level 2 95,000 USD - 145,000 USD. Level 3 140,000 USD - 190,000 USD.'),null);
 for(const text of ['Annual salary CAD $120,000 - $150,000','Annual salary $120,000 - $150,000 CAD','Annual salary 120,000 - 150,000','Annual salary EUR 120,000 - 150,000'])assert.equal(salary({},'workday',text),null);
});
test('total compensation and bonuses cannot masquerade as base salary',()=>{
 const text='The expected total compensation range is $100,000 - $140,000 including performance-based bonuses.';
 assert.equal(salary({},'greenhouse',text),null);
 assert.equal(salary({compensation:{min:100000,max:140000,currency:'USD',period:'YEARLY'}},'smartrecruiters',text),null);
 assert.equal(salary({},'greenhouse','Base salary $150,000 - $200,000. Annual bonus $30,000 - $40,000. Equity $100,000 - $150,000.').min,150000);
 assert.equal(salary({},'greenhouse','We offer competitive salaries ranging from $115K to $225K OTE, which includes base salary and bonus.\nUS Salary Range\n$115,000 - $225,000 USD'),null);
 assert.equal(salary({},'greenhouse','Annual salary $115,000 - $225,000 (OTE, including bonuses).'),null);
 assert.equal(salary({},'greenhouse','Base salary $150,000 - $200,000.\nTotal compensation $200,000 - $250,000 OTE.').max,200000);
});
test('adjacent engineering titles require mechanical qualifications or ownership',()=>{
 // Representative wording from the live Zoox, Anduril, and Lucid listings.
 for(const [title,text] of [
  ['Body Structures Engineer','B.S. in mechanical engineering equivalent or higher'],
  ['Staff Manufacturing Engineer, Manufacturing Automation','Specify, design, procure, and validate tooling, fixtures, and manufacturing equipment. Bachelor’s degree in Mechanical Engineering, Manufacturing Engineering, or related field'],
  ['Staff Engineer, Powertrain Reliability','Bachelor’s or Master’s degree in Mechanical Engineering, Electrical Engineering, or a related field.'],
  ['Senior Fuel Systems Engineer, Air Vehicles','The Mechanical Engineering Team is responsible for designing and integrating advanced hardware.'],
  ['Director of DFX, Design for Manufacturing Mechanical','Bachelor’s degree in Mechanical Engineering.'],
  ['Senior Thermal Engineer','BSME or equivalent experience'],
 ])assert.equal(relevant(title,text),true,title);
 assert.equal(candidateTitle('Senior Thermal Engineer'),true);
 assert.equal(relevant('Senior Thermal Engineer'),false);
 assert.equal(relevant('Hardware Engineer','Work closely with the mechanical engineering team.'),false);
 assert.equal(relevant('Product Design Engineer','Degree in computer science. Collaborate with mechanical engineering teams.'),false);
 assert.equal(relevant('Software Engineer, Manufacturing','Bachelor’s degree in Mechanical Engineering'),false);
 assert.equal(relevant('Manufacturing Engineer Intern','Bachelor’s degree in Mechanical Engineering'),false);
 assert.equal(relevant('Mechanical Engineer Co-op','Mechanical engineering experience'),false);
 assert.equal(relevant('RF Test Engineer','Bachelor’s degree in Mechanical Engineering'),false);
 assert.equal(relevant('Head of Mechanical Strategic Supply Chain','Bachelor’s degree in Mechanical Engineering'),false);
 for(const title of ['Mechanical Engineering Talent Pool','Mechanical Engineer - Talent Pipeline','Mechanical Engineer Talent Community','Mechanical Engineer - Expression of Interest','Future Opportunities - Mechanical Engineer'])assert.equal(candidateTitle(title),false);
 assert.equal(candidateTitle('Mechanical Engineer - Pipeline Systems'),true);
});
test('core mechanical disciplines accept demonstrated physical work with broader engineering degrees',()=>{
 for(const [title,text] of [
  ['Senior Thermal Engineer','Bachelor’s degree in Engineering. Perform thermal analysis and heat transfer calculations.'],
  ['Propulsion Engineer III','Bachelor’s degree in Aerospace Engineering. Design fluid controls and pressurized systems.'],
  ['Principal Engineer Structural Analysis','Bachelor’s degree in Mechanical, Structural, Aerospace, or Civil Engineering.'],
  ['Fluids Operations Integrator Engineer III','Minimum of a B.S. degree in engineering (Mechanical, Aerospace, or related field).'],
  ['Manager, GSE & Tooling','Manage mechanical design engineers responsible for aerospace tooling. Bachelor’s degree or higher in mechanical, structural, aerospace, electrical, manufacturing, or a related engineering field.'],
  ['Senior MEP Engineer','BS degree in Mechanical Engineering. Plan liquid cooling infrastructure.'],
  ['Staff Engineer Manufacturing Systems','Master’s degree in Mechanical, Manufacturing, or Aeronautical Engineering. Experience with machining.'],
  ['Senior Package Modeling Engineer','MS or PhD in Mechanical Engineering. Conduct finite element analysis for packaging.'],
 ])assert.equal(relevant(title,text),true,title);
 assert.equal(relevant('Structural Engineer','Civil engineering degree. Perform structural analysis of concrete buildings and bridges.'),false);
 assert.equal(relevant('Thermal Software Engineer','Develop software for thermal analysis.'),false);
 assert.equal(relevant('Manufacturing Engineer','Mechanical engineering degree. Collaborate with mechanical design teams.'),false);
 assert.equal(relevant('Materials Engineer','Mechanical engineering degree. Develop semiconductor chemistry.'),false);
 assert.equal(relevant('Process Engineer','Bachelor’s degree in Chemistry. Work with mechanical engineering teams.'),false);
 const companyIntro='Johnson Controls, a global leader in thermal management, mission-critical building systems, energy efficiency, and decarbonization.';
 assert.equal(relevant('Metro General Manager (MGM) HVAC',`${companyIntro}\nOwn the P&L, budgeting, forecasting, and resource planning. Bachelor’s degree in Business, Engineering, Operations Management, or a related field.`),false);
 assert.equal(relevant('HVAC Project Manager',`${companyIntro}\nManage project budgets, forecasts, billings, cash flow, and profitability. Bachelor’s degree in construction management, Engineering, Project Management, or related field required.`),false);
});
test('Intuitive verified base-salary region fields use every published region conservatively',()=>{
 const source={type:'smartrecruiters',slug:'Intuitive',company:'Intuitive'};
 const fields=[{fieldLabel:'Req Type',valueLabel:'Professional'},
  {fieldLabel:'Min. Salary Region 1',valueLabel:'162800 USD'}, {fieldLabel:'Max. Salary Region 1',valueLabel:'234200 USD'},
  {fieldLabel:'Min. Salary Region 2',valueLabel:'138400 USD'}, {fieldLabel:'Max. Salary Region 2',valueLabel:'199100 USD'}];
 const base={id:'744000151099028',name:'Senior Mechanical Engineer (Vision Equipment)',active:true,visibility:'PUBLIC',company:{identifier:'Intuitive'},
  location:{city:'Boston',region:'MA',country:'us'},typeOfEmployment:{label:'Full-time'},releasedDate:'2026-09-22',postingUrl:'https://jobs.smartrecruiters.com/Intuitive/744000151099028',customField:fields};
 const actual=normalize(base,source,cities,now);
 assert.equal(actual.salary.min,138400);assert.equal(actual.salary.max,234200);assert.equal(actual.salary.period,'year');
 for(const customField of [fields.map(f=>f.fieldLabel==='Min. Salary Region 2'?{...f,valueLabel:'98400 USD'}:f),fields.filter(f=>f.fieldLabel!=='Max. Salary Region 2'),fields.map(f=>f.fieldLabel==='Min. Salary Region 2'?{...f,valueLabel:'138400 CAD'}:f)])assert.equal(normalize({...base,customField},source,cities,now),null);
 assert.equal(normalize(base,{...source,slug:'UnverifiedEmployer'},cities,now),null);
 assert.equal(normalize({...base,typeOfEmployment:{label:'Part-time'}},source,cities,now),null);
});
test('description evidence reaches normalization and SmartRecruiters team objects are safe',()=>{
 const source={type:'greenhouse',slug:'test',company:'Test'};
 const job={id:7,title:'Body Structures Engineer',location:{name:'Boston, MA'},absolute_url:'https://example.com/job/7',first_published:'2026-09-22',content:'B.S. in Mechanical Engineering. Annual salary $170,000 - $204,000.'};
 assert.equal(normalize(job,source,cities,now).salary.min,170000);
 assert.equal(normalize({...job,content:'Collaborate with mechanical engineering. Annual salary $170,000 - $204,000.'},source,cities,now),null);
 assert.deepEqual(facts('Design machinery.',{label:'Mechanical'}),['Team: Mechanical']);
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
 for(const [days,key] of [[0,'green'],[7,'green'],[7.001,'yellow'],[8,'yellow'],[14,'yellow'],[14.001,'red'],[15,'red'],[30,'red']])assert.equal(jobAge(new Date(Date.parse(now)-days*86400000).toISOString(),Date.parse(now)).key,key);
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
test('Workday work mode uses retained US secondary locations and excludes foreign remote options',()=>{
 const base={id:'R123',title:'Mechanical Engineer',location:'Boston, MA',country:'United States of America',createdAt:'2026-09-22',content:'Annual base salary $110,000 - $150,000',absolute_url:'https://employer.wd5.myworkdayjobs.com/External/job/Boston/Engineer_R123'};
 const source={type:'workday',slug:'employer',company:'Employer'};
 const remote=normalize({...base,secondaryLocations:[{location:'Remote - USA',address:{addressCountry:'United States of America'}}]},source,cities,now);
 assert.equal(remote.workMode,'Remote');assert.equal(remote.location,'Boston, MA; Remote - USA');assert.equal(remote.locations.length,2);
 const foreign=normalize({...base,secondaryLocations:[{location:'Remote - Canada',address:{addressCountry:'Canada'}}]},source,cities,now);
 assert.equal(foreign.workMode,'Not specified');assert.equal(foreign.location,'Boston, MA');assert.equal(foreign.locations.length,1);
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
test('URL deduplication preserves job query identities while removing tracking variants',()=>{
 const result=reconcile(null,feed([
  observedJob('first',{url:'https://www.agilityrobotics.com/careers?gh_jid=111&locale=en'}),
  observedJob('second',{url:'https://www.agilityrobotics.com/careers?locale=en&gh_jid=222'}),
  observedJob('first',{url:'https://www.agilityrobotics.com/careers?locale=en&gh_jid=111&utm_source=map&utm_campaign=jobs&gclid=ad&fbclid=social&gh_src=board#apply'}),
 ]),now);
 assert.equal(result.jobs.length,2);
 assert.deepEqual(new Set(result.jobs.map(j=>j.id)),new Set(['first','second']));
 assert.deepEqual(new Set(result.jobs.map(j=>new URL(j.url).searchParams.get('gh_jid'))),new Set(['111','222']));
});
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
