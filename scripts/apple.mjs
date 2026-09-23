import {isRecentPosting} from '../age.mjs';
const ORIGIN='https://jobs.apple.com';
export function parseAppleHydration(html){
 if(typeof html!=='string'||html.length>8000000)throw Error('Invalid Apple page');
 const match=html.match(/window\.__staticRouterHydrationData\s*=\s*JSON\.parse\(("(?:\\.|[^"\\])*")\)/);
 if(!match)throw Error('Apple page data unavailable');
 const data=JSON.parse(JSON.parse(match[1]));
 if(!data?.loaderData)throw Error('Invalid Apple page data');
 return data.loaderData;
}
export function appleDetailUrl(id,slug){
 if(!/^\d{9,12}(?:-\d{1,8})?$/.test(id)||!/^[-a-z0-9]+$/.test(slug))throw Error('Invalid Apple job identity');
 return `${ORIGIN}/en-us/details/${id}/${slug}`;
}
export function appleJobDetail(html,expectedId){
 const job=parseAppleHydration(html).jobDetails?.jobsData;
 if(!job||job.jobNumber!==expectedId||typeof job.postingTitle!=='string'||typeof job.postDateInGMT!=='string'||!Number.isFinite(Date.parse(job.postDateInGMT))||!Array.isArray(job.locations))throw Error('Invalid Apple job detail');
 if(job.managedPipelineRole===true)return null;
 const locations=job.locations.filter(l=>l.countryID==='iso-country-USA'&&l.active!==false);
 if(!locations.length)return null;
 const locationIds=new Set(locations.map(l=>l.id));
 const pay=(job.postingFooters||[]).filter(f=>locationIds.has(f.postLocationId)).flatMap(f=>f.localizations?.en_US||[]).filter(f=>/pay|compensation/i.test(f.name||'')).map(f=>f.content||'');
 const content=[job.jobSummary,job.description,job.responsibilities,job.minimumQualifications,job.preferredQualifications,job.educationAndExperience,...pay].filter(v=>typeof v==='string').join('\n');
 if(!content)throw Error('Missing Apple job description');
 const url=appleDetailUrl(job.jobNumber,job.transformedPostingTitle);
 return {id:job.jobNumber,title:job.postingTitle,content,location:locations.map(l=>[l.name,l.stateProvince,'United States'].filter(Boolean).join(', ')).join('; '),country:'US',createdAt:job.postDateInGMT,publishedAt:job.postDateInGMT,jobUrl:url,applyUrl:url,department:(job.teamNames||[]).join(', '),employmentType:job.standardWeeklyHours>=35?'Full-time':null};
}
export async function fetchApple(source,fetchText,{isCandidate=()=>true,now=Date.now()}={}){
 if(source.slug!=='apple')throw Error('Invalid Apple source');
 const listings=new Map();let total=null,seen=0;
 for(let page=1;page<=100;page++){
  const url=`${ORIGIN}/en-us/search?search=mechanical&sort=newest&location=united-states-USA&page=${page}`;
  const data=parseAppleHydration(await fetchText(url)).search;
  if(!data||data.page!==page||data.search!=='mechanical'||data.sort!=='newest'||data.queryParams?.location!=='united-states-USA'||!Number.isSafeInteger(data.totalRecords)||data.totalRecords<0||data.totalRecords>2000||!Array.isArray(data.searchResults))throw Error('Invalid Apple search page');
  if(total===null)total=data.totalRecords;
  if(data.totalRecords!==total||(!data.searchResults.length&&seen<total))throw Error('Incomplete Apple search results');
  for(const job of data.searchResults){
   if(typeof job.reqId!=='string'||typeof job.postingTitle!=='string'||listings.has(job.reqId))throw Error('Invalid or repeated Apple listing');
   listings.set(job.reqId,job);
  }
  seen+=data.searchResults.length;
  if(seen>=total){if(seen!==total)throw Error('Unexpected Apple search count');break;}
  if(page===100)throw Error('Apple pagination limit reached');
 }
 // Apple's positionId identifies the role; the reqId suffix identifies a location.
 // Inspect every active variant of a recent candidate before deciding its age/pay.
 // A newly dated location must not turn an older role into a new opening.
 const positionId=job=>job.reqId.split('-')[0];
 for(const listing of listings.values())if(listing.positionId&&listing.positionId!==positionId(listing))throw Error('Inconsistent Apple position identity');
 const recentPositions=new Set([...listings.values()].filter(j=>j.managedPipelineRole!==true&&isRecentPosting(j.postDateInGMT,now)&&isCandidate(j.postingTitle)).map(positionId));
 const pending=[...listings.values()].filter(j=>j.managedPipelineRole!==true&&recentPositions.has(positionId(j)));
 const jobs=[];let index=0;
 await Promise.all(Array.from({length:3},async()=>{while(index<pending.length){const listing=pending[index++];let html;try{html=await fetchText(appleDetailUrl(listing.reqId,listing.transformedPostingTitle));}catch(error){if(error.status===404||error.status===410)continue;throw error;}
  const job=appleJobDetail(html,listing.reqId);if(job&&Date.parse(job.createdAt)<=now)jobs.push(job);
 }}));
 const positions=new Map();
 for(const job of jobs){const key=job.id.split('-')[0];if(!positions.has(key))positions.set(key,[]);positions.get(key).push(job);}
 return [...positions.values()].map(variants=>{
  variants.sort((a,b)=>a.id.localeCompare(b.id));
  const canonical=variants[0],postedAt=new Date(Math.min(...variants.map(j=>Date.parse(j.createdAt)))).toISOString();
  // Keep every published regional pay range so normalization uses the lowest
  // salary floor across the role, plus the union of its available US locations.
  return {...canonical,location:[...new Set(variants.flatMap(j=>j.location.split('; ')))].join('; '),content:[...new Set(variants.map(j=>j.content))].join('\n\n'),createdAt:postedAt,publishedAt:postedAt};
 }).filter(job=>isRecentPosting(job.createdAt,now));
}
