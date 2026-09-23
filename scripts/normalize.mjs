// All normalization is conservative: unknown is preferable to an invented fact.
export const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
export function decode(value=''){let t=String(value);for(let i=0;i<3;i++)t=t.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp|ndash|mdash));/gi,(_,n,h,k)=>n?String.fromCodePoint(Number(n)):h?String.fromCodePoint(parseInt(h,16)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—'})[k.toLowerCase()]);return t;}
export function plain(value){return decode(value).replace(/<\/(?:p|li|div|h\d)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
export function relevant(title){return /\b(engineer(?:ing)?|engineers)\b/i.test(title)&&/\b(mechanical|electro[- ]?mechanical|mechatronics?|mechanisms?)\b/i.test(title)&&!/\b(intern(?:ship)?|technician|technologist|recruiter|sales)\b/i.test(title);}
function range(min,max,evidence){min=Number(min);max=Number(max??min);return Number.isFinite(min)&&Number.isFinite(max)&&min>=100000&&max>=min&&max<=1000000?{min,max,currency:'USD',period:'year',evidence}:null;}
export function salary(job,type,text){
 if(type==='smartrecruiters'&&job.compensation?.min!=null){const s=job.compensation;if(s.currency!=='USD'||s.period!=='YEARLY')return null;return range(s.min,s.max,'Employer salary field');}
 if(type==='lever'&&job.salaryRange){const s=job.salaryRange;if(s.currency!=='USD'||s.interval!=='per-year-salary')return null;return range(s.min,s.max,'Employer salary field');}
 if(type==='ashby'){
 const all=[...(job.compensation?.summaryComponents||[]),...(job.compensation?.compensationTiers||[]).flatMap(t=>t.components||[])].filter(c=>c.compensationType==='Salary');
 if(all.length){if(all.some(c=>c.currencyCode!=='USD'||c.interval!=='1 YEAR'||!Number.isFinite(c.minValue)||c.minValue<100000))return null;return range(Math.min(...all.map(c=>c.minValue)),Math.max(...all.map(c=>c.maxValue??c.minValue)),'Employer salary field');}
 }
 // Only dollar ranges near explicit annual/base salary language. Never annualize hourly rates.
 const re=/\$\s*((?:\d{1,3}(?:,\d{3})+|\d{2,7})(?:\.\d+)?\s*[kK]?)\s*(?:[-–—]|to)\s*\$?\s*((?:\d{1,3}(?:,\d{3})+|\d{2,7})(?:\.\d+)?\s*[kK]?)/g;
 const ranges=[];
 for(const m of text.matchAll(re)){
 const context=text.slice(Math.max(0,m.index-500),m.index+m[0].length+500);
 if(!/salary|base pay|annual|per year|\/year|yearly/i.test(context)||/\b(CAD|AUD|NZD|SGD|HKD|MXN|TWD)\b|canadian dollars/i.test(context))continue;
 const after=text.slice(m.index+m[0].length,m.index+m[0].length+35);if(/^\s*(?:USD)?\s*(?:\/\s*h(?:ou)?r|per hour|hourly)/i.test(after))continue;
 const parse=v=>Number(v.replace(/[,\sKk]/g,''))*(/[kK]/.test(v)?1000:1);
 const min=parse(m[1]),max=parse(m[2]);if(min>=20000&&max>=min)ranges.push({min,max});
 }
 if(!ranges.length||ranges.some(r=>r.min<100000))return null;
 return range(Math.min(...ranges.map(r=>r.min)),Math.max(...ranges.map(r=>r.max)),'Published salary range in employer description');
}
export function workMode(job,location,text){
 const raw=String(job.workplaceType||'').toLowerCase().replace(/[-_ ]/g,'');
 if(raw==='hybrid')return 'Hybrid';if(raw==='remote'||job.isRemote===true)return 'Remote';if(raw==='onsite')return 'On-site';
 const fields=(job.metadata||[]).filter(m=>/workplace|work.*(mode|type|arrangement)|remote|hybrid/i.test(m.name)).map(m=>m.value).join(' ');
 const explicit=location+' '+fields;
 if(/\bhybrid\b/i.test(explicit))return 'Hybrid';if(/\bremote\b/i.test(explicit))return 'Remote';if(/\bon[- ]?site\b/i.test(explicit))return 'On-site';
 if(/\bnot\s+(?:a\s+)?(?:remote\s+or\s+hybrid|hybrid\s+or\s+remote)\s+(?:position|role)|\bno remote or hybrid/i.test(text))return 'On-site';
 const workText=text.replace(/[^.!?\n]*\b(?:not|no|isn.t|cannot)[^.!?\n]*\b(?:remote|hybrid)[^.!?\n]*/gi,'');
 if(/\bhybrid (?:work|role|position|schedule|arrangement|model)|\b(?:role|position) (?:is|will be) hybrid\b/i.test(workText))return 'Hybrid';
 if(/\b(?:fully|100%) remote\b|\b(?:role|position) is (?:a )?remote\b/i.test(text)&&!/not (?:a )?(?:fully )?remote|no remote/i.test(text))return 'Remote';
 if(/\b(?:work|working|based|located|position|role|required|presence).{0,40}\b(?:on[- ]?site|in[- ]person)\b|\b(?:on[- ]?site|in[- ]person) (?:position|role|work|requirement)|\b(?:five|5) days (?:a|per) week (?:in|at) (?:the )?office/i.test(text))return 'On-site';
 return 'Not specified';
}
const normalized=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function locate(location,country,cities,address={}){
 if(country&&!/^(US|USA|United States|United States of America)$/i.test(country))return null;
 if(/\b(Canada|Australia|New Zealand|United Kingdom|Germany|India|Singapore|Mexico|France|Ireland)\b/i.test(location))return null;
 const stateByName=Object.entries(STATES).find(([,name])=>new RegExp(`\\b${name}\\b`,'i').test(address.addressRegion||location))?.[0];
 const tokens=location.match(/\b[A-Z]{2}\b/g)||[];
 const state=Object.hasOwn(STATES,address.addressRegion||'')?address.addressRegion:stateByName||tokens.find(t=>STATES[t]&&t!=='US');
 const loc=normalized(address.addressLocality||location);
 const matches=cities.filter(c=>(!state||c.state===state)&&[c.name,...(c.aliases||[]),...(c.name==='New York City'?['New York','NYC']:[])].some(n=>new RegExp(`(?:^| )${normalized(n)}(?: |$)`).test(loc))).sort((a,b)=>b.name.length-a.name.length||b.population-a.population);
 const city=matches[0];
 // Without a country or state, accept only unambiguous exact U.S. city names.
 const us=Boolean(country||state||/\b(?:United States|USA|U\.S\.|US)\b/.test(location));
 if(!us&&(!city||normalized(city.name)!==loc||matches.filter(c=>normalized(c.name)===loc).length>1))return null;
 if(city)return {lat:city.lat,lng:city.lng,city:city.name,state:city.state,precision:'city'};
 if(us)return {state:state||null,lat:null,lng:null,precision:'unmapped'};
 return null;
}
export function facts(text,department){
 const result=[];
 const years=[...text.matchAll(/\b(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\+?\s*(?:years|yrs)\s*(?:of )?(?:relevant |professional |industry |engineering |hands-on |mechanical )?(?:experience|work)/gi)].map(m=>m[0]);
 if(years.length)result.push('Experience: '+years[0].replace(/\s+/g,' '));
 const skills=['SolidWorks','CATIA','NX','Creo','CAD','GD&T','FEA','ANSYS','MATLAB','Python','DFM','CNC','AutoCAD','Revit'].filter(s=>new RegExp('\\b'+s.replace('&','&')+'\\b','i').test(text));
 if(skills.length)result.push('Skills: '+skills.slice(0,5).join(', '));
 if(!result.length&&department)result.push('Team: '+department.trim());
 if(result.length<2&&/\b(?:active|obtain|eligible for|maintain).{0,45}(?:security clearance|secret clearance)\b/i.test(text))result.push('Security clearance mentioned; see employer requirements.');
 if(result.length<2&&/\bbachelor(?:’s|'s|s)?\b/i.test(text))result.push("Bachelor’s degree mentioned; see full requirements.");
 return result.slice(0,2);
}
export function normalize(job,source,cities,now){
 if(source.type==='smartrecruiters'){
 if(job.active===false||job.visibility!=='PUBLIC')return null;
 const loc=job.location||{};
 job={...job,title:job.name,location:loc.fullLocation||[loc.city,loc.region,loc.country].filter(Boolean).join(', '),country:loc.country,content:Object.values(job.jobAd?.sections||{}).map(s=>s.text||'').join('\n'),workplaceType:loc.hybrid?'Hybrid':loc.remote?'Remote':(job.customField||[]).find(f=>/work.*(model|type|setting)/i.test(f.fieldLabel))?.valueLabel,employmentType:job.typeOfEmployment?.label,jobUrl:job.postingUrl,publishedAt:job.releasedDate,address:{postalAddress:{addressLocality:loc.city,addressRegion:loc.region,addressCountry:loc.country}}};
 }
 const title=String(job.title||job.text||'').trim();if(!relevant(title)||job.isListed===false)return null;
 if(job.application_deadline&&new Date(job.application_deadline)<new Date(now))return null;
 const text=plain([job.content||job.descriptionPlain||job.description||'',...(job.lists||[]).map(l=>l.content),job.additionalPlain||''].join('\n'));
 const pay=salary(job,source.type,text);if(!pay)return null;
 const location=job.location?.name||job.location||job.categories?.location||'';
 const address=job.address?.postalAddress||{};
 const primary=String(location).split(/\s*;\s*/).map(label=>({label,country:job.country||address.addressCountry,address:{...address,addressLocality:String(location).includes(';')?undefined:address.addressLocality}}));
 const secondary=source.type==='ashby'?(job.secondaryLocations||[]).map(l=>({label:l.location,country:l.address?.addressCountry,address:l.address||{}})):(job.categories?.allLocations||[]).map(label=>({label,country:job.country,address:{}}));
 const locations=[...new Map([...primary,...secondary].map(l=>[l.label,l])).values()].map(l=>({...l,geo:locate(l.label,l.country,cities,l.address)})).filter(l=>l.geo);
 if(!locations.length)return null;const geo=locations.find(l=>Number.isFinite(l.geo.lat))?.geo||locations[0].geo;
 const posted=source.type==='greenhouse'?job.first_published:['ashby','smartrecruiters'].includes(source.type)?job.publishedAt:job.createdAt;
 const postedAt=posted&&Number.isFinite(new Date(posted).getTime())&&new Date(posted)<=new Date(now)?new Date(posted).toISOString():null;
 const url=job.absolute_url||job.jobUrl||job.hostedUrl;const applyUrl=job.applyUrl||url;
 if(!/^https:\/\//.test(url||'')||!/^https:\/\//.test(applyUrl||''))return null;
 return {id:`${source.type}:${source.slug}:${job.id}`,sourceId:source.slug,title,company:source.company,location,geo,locations:locations.map(l=>({label:l.label,...l.geo})),salary:pay,workMode:workMode(job,location,text),facts:facts(text,job.department||job.departments?.[0]?.name||job.categories?.team),employmentType:job.employmentType||job.categories?.commitment||(job.metadata||[]).find(m=>/employment type/i.test(m.name))?.value||null,postedAt,postedLabel:['ashby','smartrecruiters'].includes(source.type)?'Published / republished':source.type==='lever'?'First listed':'First published',updatedAt:job.updated_at||null,checkedAt:now,url,applyUrl,stale:false};
}
export function reconcile(previous,results,now){
 const jobs=[],sources=[];
 for(const r of results){if(r.ok){jobs.push(...r.jobs);sources.push({...r.source,ok:true,checkedAt:now,total:r.total,matches:r.jobs.length});}
 else {const old=(previous?.jobs||[]).filter(j=>j.sourceId===r.source.slug&&new Date(now)-new Date(j.checkedAt)<24*3600000);jobs.push(...old.map(j=>({...j,stale:true})));sources.push({...r.source,ok:false,checkedAt:previous?.sources?.find(s=>s.slug===r.source.slug)?.checkedAt||null,matches:old.length,error:r.error});}}
 const unique=[...new Map(jobs.map(j=>[j.url.replace(/\?.*/,''),j])).values()];unique.sort((a,b)=>(b.postedAt||'').localeCompare(a.postedAt||''));
 return {schemaVersion:1,generatedAt:now,refreshMinutes:30,salaryMinimum:100000,sources,jobs:unique};
}
