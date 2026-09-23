import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {normalize,reconcile,relevant} from './normalize.mjs';
const root=new URL('../',import.meta.url);
const sources=JSON.parse(await readFile(new URL('data/sources.json',root),'utf8'));
const cities=JSON.parse(await readFile(new URL('data/us-cities.json',root),'utf8')).map(([name,state,lat,lng,population])=>({name,state,lat,lng,population}));
let previous=null;try{previous=JSON.parse(await readFile(new URL('data/jobs.json',root),'utf8'));}catch{}
const now=new Date().toISOString();let cursor=0;const results=[];
async function fetchJSON(url){for(let attempt=0;attempt<3;attempt++){try{let r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Jobmap/1.0 (public employer job listings)'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json();}catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}}}
await Promise.all(Array.from({length:4},async()=>{while(cursor<sources.length){let source=sources[cursor++];try{
 let jobs;
 if(process.env.JOBMAP_FIXTURES){const data=JSON.parse(await readFile(`${process.env.JOBMAP_FIXTURES}/${source.slug}.json`,'utf8'));jobs=source.type==='lever'?data:data.jobs;}
 else if(source.type==='smartrecruiters'){
 const postings=new Map();
 for(const q of ['mechanical','mechanisms','mechatronic']){let offset=0,total=Infinity;while(offset<total){const data=await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${source.slug}/postings?q=${q}&country=us&limit=100&offset=${offset}`);if(!Array.isArray(data.content)||!Number.isFinite(data.totalFound))throw Error('Invalid SmartRecruiters payload');total=data.totalFound;if(total>10000)throw Error('Unexpected pagination size');if(!data.content.length&&offset<total)throw Error('Incomplete postings response');data.content.filter(j=>j.visibility==='PUBLIC'&&relevant(j.name)).forEach(j=>postings.set(j.id,j));offset+=100;}}
 const pending=[...postings.values()];jobs=[];let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<pending.length){const p=pending[index++];jobs.push(await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${source.slug}/postings/${p.id}`));}}));
 }
 else if(source.type==='lever'){jobs=[];for(let offset=0;offset<20000;offset+=100){const batch=await fetchJSON(`https://api.lever.co/v0/postings/${source.slug}?mode=json&limit=100&skip=${offset}`);if(!Array.isArray(batch))throw Error('Invalid Lever payload');jobs.push(...batch);if(batch.length<100)break;if(offset===19900)throw Error('Pagination limit reached');}}
 else {const url=source.type==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${source.slug}/jobs?content=true`:`https://api.ashbyhq.com/posting-api/job-board/${source.slug}?includeCompensation=true`;const data=await fetchJSON(url);if(!Array.isArray(data.jobs))throw Error('Invalid job board payload');jobs=data.jobs;if(source.type==='greenhouse'&&data.meta?.total>jobs.length)throw Error('Incomplete job board response');}
 const filtered=jobs.map(j=>normalize(j,source,cities,now)).filter(Boolean);results.push({ok:true,source,total:jobs.length,jobs:filtered});console.log(`${source.company}: ${filtered.length} qualifying / ${jobs.length} open`);
 }catch(e){console.error(`${source.company}: ${e.message}`);results.push({ok:false,source,error:e.message});}}}));
if(!results.some(r=>r.ok))throw Error('All employer feeds failed; preserving last published dataset');
const data=reconcile(previous,results,now);await mkdir(new URL('data/',root),{recursive:true});const target=new URL('data/jobs.json',root),temp=new URL('data/jobs.json.tmp',root);await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,target);
console.log(JSON.stringify({jobs:data.jobs.length,employers:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,mapped:data.jobs.filter(j=>j.geo.lat!==null).length,unmapped:[...new Set(data.jobs.filter(j=>j.geo.lat===null).map(j=>j.location))],modes:Object.fromEntries(['On-site','Hybrid','Remote','Not specified'].map(m=>[m,data.jobs.filter(j=>j.workMode===m).length]))},null,2));
