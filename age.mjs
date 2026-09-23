export function jobAge(postedAt,now=Date.now()){
 if(!postedAt||!Number.isFinite(Date.parse(postedAt)))return {key:'unknown',color:'#7c8996',label:'Date unavailable',days:null};
 const days=Math.max(0,Math.floor((now-Date.parse(postedAt))/86400000));
 return {key:days<=7?'blue':days<=14?'green':days<=30?'yellow':'red',color:days<=7?'#2278d0':days<=14?'#20916b':days<=30?'#d4a600':'#d24c4c',label:days===0?'Listed today':`${days}d ago`,days};
}

export const AGE_BANDS=[
 {key:'blue',label:'0–7 days',color:'#2278d0'},
 {key:'green',label:'8–14 days',color:'#20916b'},
 {key:'yellow',label:'15–30 days',color:'#d4a600'},
 {key:'red',label:'31+ days',color:'#d24c4c'},
 {key:'unknown',label:'No date',color:'#7c8996'}
];
const postedTime=job=>Number.isFinite(Date.parse(job?.postedAt))?Date.parse(job.postedAt):-Infinity;
export function compareNewest(a,b){const aTime=postedTime(a),bTime=postedTime(b);return aTime===bTime?0:bTime-aTime;}
export function ageBreakdown(jobs,now=Date.now()){
 const counts=new Map(AGE_BANDS.map(b=>[b.key,0]));
 for(const job of jobs){const key=jobAge(job.postedAt,now).key;counts.set(key,counts.get(key)+1);}
 return AGE_BANDS.map(b=>({...b,count:counts.get(b.key)})).filter(b=>b.count);
}
