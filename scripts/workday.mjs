const DAY=86400000;
const SEARCH_TERMS=['mechanical','mechatronic','mechanism','thermal','fluids','propulsion','structural'];
const US_COUNTRY=/^(?:US|USA|United States(?: of America)?)$/i;
const US_MARKER=/\b(?:US|USA|United States(?: of America)?)\b/;
const US_STATE_SUFFIX=/,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)(?:\s+\d{5})?$/;
export const isWorkdayHost=host=>/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/.test(host);
export function workdayEndpoint(source){
 if(!isWorkdayHost(source.host)||!/^[a-zA-Z0-9_-]+$/.test(source.tenant)||!/^[a-zA-Z0-9_-]+$/.test(source.board))throw Error('Invalid Workday board configuration');
 return `https://${source.host}/wday/cxs/${source.tenant}/${source.board}`;
}
export function workdayPath(url,source){
 const parsed=new URL(url);const marker=parsed.pathname.indexOf('/job/');
 if(parsed.protocol!=='https:'||parsed.hostname!==source.host||parsed.port||parsed.username||parsed.password||marker<0||!parsed.pathname.slice(0,marker).toLowerCase().endsWith('/'+source.board.toLowerCase()))throw Error('Invalid Workday posting URL');
 return parsed.pathname.slice(marker);
}
export function workdayJob(data,source){
 const job=data?.jobPostingInfo;
 if(!job||typeof job.jobDescription!=='string'||!job.jobReqId||!job.externalUrl)throw Error('Incomplete Workday posting');
 if(job.canApply===false||job.posted===false)return null;
 workdayPath(job.externalUrl,source);
 // The primary country does not apply to additional offices. For example,
 // GE's U.S. role also lists Markham, Canada; never pin that in Illinois.
 const secondaryLocations=(job.additionalLocations||[]).flatMap(value=>{
  const location=typeof value==='string'?value:value.descriptor,country=typeof value==='object'?value.country?.descriptor:null;
  if(!location||(country&&!US_COUNTRY.test(country))||(!country&&!US_MARKER.test(location)&&!US_STATE_SUFFIX.test(location)))return [];
  return [{location,address:{addressCountry:'US'}}];
 });
 return {id:job.jobReqId,title:job.title,content:job.jobDescription,location:job.location,country:job.country?.descriptor||(US_MARKER.test(job.location)||US_STATE_SUFFIX.test(job.location)?'US':'Unverified'),secondaryLocations,
  createdAt:job.startDate,application_deadline:job.endDate,employmentType:job.timeType,workplaceType:job.remoteType?.descriptor,
  absolute_url:job.externalUrl,applyUrl:job.externalUrl};
}
function usFacet(facets){
 for(const facet of facets||[]){
  const value=facet.values?.find(v=>/^(?:United States(?: of America)?|USA|US)$/.test(v.descriptor||''));
  if(value&&facet.facetParameter)return {[facet.facetParameter]:[value.id]};
  const nested=usFacet(facet.values);if(nested)return nested;
 }
 return null;
}
export async function fetchWorkday(source,fetchJSON,{isCandidate=()=>true,now=Date.now()}={}){
 const base=workdayEndpoint(source),postings=new Map();
 let facets=null;
 for(const query of SEARCH_TERMS){
  let offset=0,total=Infinity;const seenPaths=new Set();
  while(offset<total){
   const payload={appliedFacets:facets||{},limit:20,offset,searchText:query};
   let data=await fetchJSON(base+'/jobs',{method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json'}});
   if(!Array.isArray(data.jobPostings)||!Number.isFinite(data.total))throw Error('Invalid Workday search response');
   if(facets===null){facets=usFacet(data.facets)||{};if(Object.keys(facets).length){data=await fetchJSON(base+'/jobs',{method:'POST',body:JSON.stringify({...payload,appliedFacets:facets}),headers:{'Content-Type':'application/json'}});if(!Array.isArray(data.jobPostings)||!Number.isFinite(data.total))throw Error('Invalid Workday filtered response');}}
   // Some Workday boards (including NVIDIA) return total: 0 on later
   // pages even when jobPostings is populated. Only page one supplies the total.
   if(offset===0){total=data.total;if(total<0||total>5000)throw Error('Unexpected Workday search size');}
   if(!data.jobPostings.length&&offset<total)throw Error('Incomplete Workday pagination');
   for(const job of data.jobPostings){
    if(typeof job.externalPath!=='string'||!job.externalPath.startsWith('/job/')||job.externalPath.includes('..'))throw Error('Invalid Workday job path');
    if(seenPaths.has(job.externalPath))throw Error('Repeated Workday pagination result');
    seenPaths.add(job.externalPath);
    // The public listing already marks these as older than the requested window.
    if(!isCandidate(job.title)||/30\+\s+Days Ago/i.test(job.postedOn||''))continue;
    postings.set(job.externalPath,job);
   }
   offset+=data.jobPostings.length;if(!data.jobPostings.length)break;
  }
 }
 const pending=[...postings.keys()],jobs=[];let cursor=0;
 await Promise.all(Array.from({length:2},async()=>{while(cursor<pending.length){
  const path=pending[cursor++];let data;
  try{data=await fetchJSON(base+path);}catch(error){if(error.status===404||error.status===410)continue;throw error;}
  const job=workdayJob(data,source);if(!job)continue;
  const posted=Date.parse(job.createdAt);
  if(!Number.isFinite(posted)||posted>now||now-posted>30*DAY)continue;
  jobs.push(job);
 }}));
 return jobs;
}
