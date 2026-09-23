import {isRecentPosting} from '../age.mjs';

// Apply the same window after reconciliation so an outage cannot retain an
// expired listing. Keep first-seen history when jobs age out of the map.
export function restrictToRecent(snapshot,now=Date.now()){
 const jobs=snapshot.jobs.filter(job=>isRecentPosting(job.postedAt,now));
 const counts=new Map();
 for(const job of jobs){const key=job.id.split(':').slice(0,2).join(':');counts.set(key,(counts.get(key)||0)+1);}
 return {...snapshot,maxPostingAgeDays:30,jobs,sources:snapshot.sources.map(source=>({...source,matches:counts.get(`${source.type}:${source.slug}`)||0}))};
}
