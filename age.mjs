export function isRecentPosting(postedAt,now=Date.now()){
 const posted=typeof postedAt==='string'?Date.parse(postedAt):NaN;
 return Number.isFinite(now)&&Number.isFinite(posted)&&posted<=now&&now-posted<=30*86400000;
}

export function jobAge(postedAt,now=Date.now()){
 const posted=Date.parse(postedAt);
 if(!postedAt||!Number.isFinite(posted)||posted>now)return {key:'unknown',color:'#7c8996',label:'Date unavailable',days:null};
 const elapsed=now-posted,days=Math.floor(elapsed/86400000);
 return {key:elapsed<=7*86400000?'green':elapsed<=14*86400000?'yellow':'red',color:elapsed<=7*86400000?'#20916b':elapsed<=14*86400000?'#d4a600':'#d24c4c',label:days===0?'Listed today':`${days}d ago`,days};
}

export const AGE_BANDS=[
 {key:'green',label:'Past week',color:'#20916b'},
 {key:'yellow',label:'8–14 days',color:'#d4a600'},
 {key:'red',label:'15–30 days',color:'#d24c4c'}
];
const postedTime=job=>Number.isFinite(Date.parse(job?.postedAt))?Date.parse(job.postedAt):-Infinity;
export function compareNewest(a,b){const aTime=postedTime(a),bTime=postedTime(b);return aTime===bTime?0:bTime-aTime;}
export function recentPostedCount(jobs,now=Date.now()){
 const cutoff=now-7*86400000;
 return jobs.reduce((count,job)=>{
  const posted=postedTime(job);
  return count+(Number.isFinite(posted)&&posted>=cutoff&&posted<=now?1:0);
 },0);
}
export function ageBreakdown(jobs,now=Date.now()){
 const counts=new Map(AGE_BANDS.map(b=>[b.key,0]));
 for(const job of jobs){if(!isRecentPosting(job.postedAt,now))continue;const key=jobAge(job.postedAt,now).key;counts.set(key,counts.get(key)+1);}
 return AGE_BANDS.map(b=>({...b,count:counts.get(b.key)})).filter(b=>b.count);
}

export function agePie(jobs,now=Date.now()){
 const bands=ageBreakdown(jobs,now),total=bands.reduce((sum,band)=>sum+band.count,0);
 if(!total)return {bands,gradient:'none'};
 let counted=0;
 const stops=bands.map(band=>{
  const start=counted/total*100;
  counted+=band.count;
  const end=counted/total*100;
  return `${band.color} ${start}% ${end}%`;
 });
 // CSS's zero-degree origin is 12 o'clock; paired stops keep wedges sharp.
 return {bands,gradient:`conic-gradient(from 0deg, ${stops.join(', ')})`};
}
