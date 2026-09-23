import test from 'node:test';
import assert from 'node:assert/strict';
import {workdayJob,workdayEndpoint,workdayPath,fetchWorkday} from './workday.mjs';
import {normalize,candidateTitle} from './normalize.mjs';
const source={type:'workday',slug:'nvidia',company:'NVIDIA',host:'nvidia.wd5.myworkdayjobs.com',tenant:'nvidia',board:'NVIDIAExternalCareerSite'};
const url='https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Mechanical-Engineer_JR123';
const info={jobReqId:'JR123',title:'Senior Mechanical Engineer',jobDescription:'Published salary 152,000 USD - 253,000 USD',externalUrl:url,location:'US, CA, Santa Clara',additionalLocations:['US, TX, Austin'],country:{descriptor:'United States of America'},startDate:'2026-09-20',canApply:true,posted:true};
test('Workday retains authoritative posting dates, location alternatives and direct employer links',()=>{
 const job=workdayJob({jobPostingInfo:info},source);
 assert.equal(job.id,'JR123');assert.equal(job.createdAt,'2026-09-20');assert.equal(job.location,'US, CA, Santa Clara');assert.deepEqual(job.secondaryLocations,[{location:'US, TX, Austin',address:{addressCountry:'US'}}]);assert.equal(job.applyUrl,url);
 assert.equal(workdayJob({jobPostingInfo:{...info,canApply:false}},source),null);
 assert.throws(()=>workdayJob({jobPostingInfo:{...info,externalUrl:'https://example.com/job/x'}},source));
 assert.throws(()=>workdayEndpoint({...source,host:'127.0.0.1'}));
 assert.equal(workdayPath(url,source),'/job/US-CA-Santa-Clara/Mechanical-Engineer_JR123');
});
test('Workday deduplicates searches, checks details and skips old or irrelevant jobs',async()=>{
 const seen=[];
 const fetcher=async(url,init)=>{
  seen.push(url);
  if(url.endsWith('/jobs'))return {total:3,jobPostings:[{title:'Mechanical Engineer',externalPath:workdayPath(info.externalUrl,source),postedOn:'Posted 3 Days Ago'},{title:'Mechanical Engineer',externalPath:'/job/old',postedOn:'Posted 30+ Days Ago'},{title:'Software Engineer',externalPath:'/job/software',postedOn:'Posted Today'}]};
  return {jobPostingInfo:info};
 };
 const jobs=await fetchWorkday(source,fetcher,{isCandidate:title=>title.includes('Mechanical'),now:Date.parse('2026-09-23')});
 assert.equal(jobs.length,1);assert.equal(seen.filter(url=>!url.endsWith('/jobs')).length,1);
});
test('Workday applies the published US facet, follows later pages and rejects expired detail dates',async()=>{
 const searchBodies=[],detailCalls=[];
 const fetcher=async(url,init)=>{
  if(url.endsWith('/jobs')){
   const body=JSON.parse(init.body);searchBodies.push(body);
   if(!Object.keys(body.appliedFacets).length)return {total:3,jobPostings:[],facets:[{facetParameter:'locationCountry',values:[{descriptor:'United States of America',id:'usa'}]}]};
   return {total:2,jobPostings:[{title:'Mechanical Engineer',externalPath:body.offset===0?'/job/recent':'/job/expired',postedOn:'Posted Yesterday'}]};
  }
  detailCalls.push(url);
  return {jobPostingInfo:{...info,externalUrl:'https://'+source.host+'/'+source.board+url.slice(url.indexOf('/job/')),startDate:url.endsWith('/expired')?'2025-01-01':info.startDate}};
 };
 const jobs=await fetchWorkday(source,fetcher,{now:Date.parse('2026-09-23')});
 assert.equal(jobs.length,1);assert.equal(detailCalls.length,2);
 assert.ok(searchBodies.some(body=>body.offset===1));
 assert.ok(searchBodies.slice(1).every(body=>body.appliedFacets.locationCountry[0]==='usa'));
});
test('Workday rejects incomplete pages rather than publishing partial employer results',async()=>{
 await assert.rejects(()=>fetchWorkday(source,async()=>({total:1,jobPostings:[]})),/Incomplete/);
});
test('Workday keeps the first page total when subsequent populated pages report zero',async()=>{
 const offsets=[];
 const fetcher=async(url,init)=>{
  if(url.endsWith('/jobs')){
   const body=JSON.parse(init.body);if(body.searchText!=='mechanical')return {total:0,jobPostings:[]};
   offsets.push(body.offset);
   return {total:body.offset===0?3:0,jobPostings:[{title:'Mechanical Engineer',externalPath:`/job/page-${body.offset}`,postedOn:'Posted Today'}]};
  }
  const id=url.split('/').at(-1);
  return {jobPostingInfo:{...info,jobReqId:id,externalUrl:`https://${source.host}/${source.board}/job/${id}`}};
 };
 const jobs=await fetchWorkday(source,fetcher,{now:Date.parse('2026-09-23')});
 assert.deepEqual(offsets,[0,1,2]);assert.equal(jobs.length,3);
});
test('Workday rejects missing or repeated later pages instead of silently truncating a feed',async()=>{
 for(const repeated of [false,true]){
  const fetcher=async(url,init)=>{
   const {offset}=JSON.parse(init.body);
   return {total:offset===0?2:0,jobPostings:offset===0||repeated?[{title:'Mechanical Engineer',externalPath:'/job/repeated',postedOn:'Posted Today'}]:[]};
  };
  await assert.rejects(()=>fetchWorkday(source,fetcher),repeated?/Repeated/:/Incomplete/);
 }
});
test('Workday finds physical engineering roles outside mechanical searches while filtering unrelated titles',async()=>{
 const searches=[],details=[];
 const fetcher=async(url,init)=>{
  if(url.endsWith('/jobs')){
   const {searchText}=JSON.parse(init.body);searches.push(searchText);
   return ['thermal','fluids','propulsion','structural'].includes(searchText)?{total:2,jobPostings:[{title:`Senior ${searchText} Engineer`,externalPath:`/job/${searchText}`,postedOn:'Posted Today'},{title:'Software Engineer',externalPath:'/job/software',postedOn:'Posted Today'}]}:{total:0,jobPostings:[]};
  }
  details.push(url);const discipline=url.split('/').at(-1);
  return {jobPostingInfo:{...info,jobReqId:discipline,title:`Senior ${discipline} Engineer`,externalUrl:`https://${source.host}/${source.board}/job/${discipline}`}};
 };
 const jobs=await fetchWorkday(source,fetcher,{isCandidate:candidateTitle,now:Date.parse('2026-09-23')});
 assert.deepEqual(searches,['mechanical','mechatronic','mechanism','thermal','fluids','propulsion','structural']);
 assert.deepEqual(jobs.map(j=>j.id).sort(),['fluids','propulsion','structural','thermal']);
 assert.equal(details.length,4);
});

test('Workday does not apply a primary US country to ambiguous or foreign additional offices',()=>{
 const job=workdayJob({jobPostingInfo:{...info,additionalLocations:['Markham','Tokyo','Wilmington, NC','US, GA, Atlanta',{descriptor:'Austin',country:{descriptor:'United States of America'}},{descriptor:'London, UK',country:{descriptor:'United Kingdom'}}]}},source);
 assert.deepEqual(job.secondaryLocations.map(l=>l.location),['Wilmington, NC','US, GA, Atlanta','Austin']);
});
test('a multinational Workday role never maps the Canadian Markham office to Illinois',()=>{
 const job=workdayJob({jobPostingInfo:{...info,location:'Wilmington, NC',additionalLocations:['Markham','Atlanta, GA']}},source);
 const cities=[{name:'Wilmington',state:'NC',lat:34.2,lng:-77.9,population:100000},{name:'Markham',state:'IL',lat:41.59,lng:-87.69,population:11000},{name:'Atlanta',state:'GA',lat:33.75,lng:-84.39,population:500000}];
 const normalized=normalize(job,source,cities,'2026-09-23T12:00:00Z');
 assert.deepEqual(normalized.locations.map(l=>l.city),['Wilmington','Atlanta']);
 assert.equal(normalized.location,'Wilmington, NC; Atlanta, GA');
 assert.equal(normalize(workdayJob({jobPostingInfo:{...info,location:'Markham',country:undefined,additionalLocations:[]}},source),source,cities,'2026-09-23T12:00:00Z'),null);
});
