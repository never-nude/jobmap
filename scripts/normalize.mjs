// All normalization is conservative: unknown is preferable to an invented fact.
export const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
export function decode(value=''){let t=String(value);for(let i=0;i<3;i++)t=t.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp|ndash|mdash));/gi,(_,n,h,k)=>n?String.fromCodePoint(Number(n)):h?String.fromCodePoint(parseInt(h,16)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—'})[k.toLowerCase()]);return t;}
export function plain(value){return decode(value).replace(/<\/(?:p|li|div|h\d)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/[ \t\u00a0]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
const engineeringTitle=/\b(engineer(?:ing)?|engineers)\b/i;
const mechanicalTitle=/\b(mechanical|electro[- ]?mechanical|opto[- ]?mechanical|mechatronics?|mechanisms?)\b/i;
const excludedTitle=/\b(intern(?:ship)?|co[- ]?op|technician|technologist|recruiter|sales|supply chain|procurement|sourcing)\b/i;
const candidatePoolTitle=/\b(talent (?:pool|pipeline|community|network)|expressions? of interest|future (?:career |job |employment )?opportunities)\b/i;
const unrelatedTitle=/\b(software|firmware|embedded|electrical|electronics|avionics|harness|rf|network|security|frontend|backend|machine learning|data science)\b/i;
const coreMechanicalTitle=/\b(thermal|thermodynamics?|heat transfer|fluids?|propulsion|structures?|structural|stress|aerodynamics?|turbomachinery|actuators?|gears?|tooling|body|chassis|powertrain|fuel|piping|hvac|mep)\b/i;
const physicalTitle=/\b(thermal|thermodynamics?|heat transfer|fluids?|propulsion|structures?|structural|stress|aerodynamics?|turbomachinery|manufacturing|actuators?|gears?|tooling|weld(?:ing)?|materials?|process|package|packaging|body|chassis|powertrain|product design|environmental test|crash test|fuel|piping|hvac|mep|equipment|automation|robotics)\b/i;
const relatedTitle=/\b(hardware|test|systems|integration|reliability|design)\b/i;
const physicalWork=/\b(mechanical (?:design|testing|systems|hardware|components|assemblies|assembly)|thermal (?:analysis|design|management)|fluid (?:systems|dynamics|handling)|structural analysis|heat transfer|thermodynamics|CFD|FEA|finite[- ]element|computational fluid|fluid controls|pressurized systems|pressure systems|machining|metal fabrication|GD&T|SolidWorks|CATIA|3D CAD|manufacturing equipment|production equipment|factory automation|automated manufacturing)\b/i;
const hasPhysicalWork=text=>text.split(/\n|[.!?]\s+/).some(line=>physicalWork.test(line)&&!/\b(collaborat\w*|partner\w*|interfac\w*|work(?:ing)?\s+with)\b/i.test(line));
// Listing APIs may omit descriptions. This broad prefilter only selects details
// to fetch; relevant() still requires mechanical evidence for adjacent titles.
export function candidateTitle(title){const professional=engineeringTitle.test(title)||(/\b(director|head|chief|manager)\b/i.test(title)&&(mechanicalTitle.test(title)||coreMechanicalTitle.test(title)));return professional&&!excludedTitle.test(title)&&!candidatePoolTitle.test(title)&&(mechanicalTitle.test(title)||(!unrelatedTitle.test(title)&&(physicalTitle.test(title)||relatedTitle.test(title))));}
function mechanicalQualification(line){
 const leads=[...line.matchAll(/\b(?:degree|bachelor[’'s]*|master[’'s]*|B\.?S\.?|M\.?S\.?|Ph\.?D\.?|background|education|experience)\b/gi)];
 const allowedMajorWords=new Set('aerospace aeronautical structural civil electrical manufacturing nuclear materials chemical industrial computer mechatronics controls robotics systems power mechanical engineering science related relevant other equivalent engineering field fields discipline disciplines or and a'.split(' '));
 return leads.some(lead=>{
  const part=line.slice(lead.index,lead.index+250);
  const major=part.match(/\bmechanical\b([^.;:\n]{0,120}?)\bengineering\b/i);
  if(major){const through=part.slice(0,major.index+major[0].length);return !/\b(collaborat\w*|partner\w*|interfac\w*|cross[- ]functional|work(?:ing)?\s+with)\b/i.test(through)&&((major[1].match(/[a-z]+/gi)||[]).every(word=>allowedMajorWords.has(word.toLowerCase())));}
  // Some employers put the disciplines after a generic engineering degree.
  return /\b(?:degree|B\.?S\.?|M\.?S\.?|bachelor[’'s]*|master[’'s]*)\b[^.;:\n]{0,100}\bengineering\s*\([^)]{0,100}\bmechanical\b/i.test(part);
 });
}
export function relevant(title,text=''){
 if(!candidateTitle(title))return false;
 if(mechanicalTitle.test(title)&&engineeringTitle.test(title))return true;
 const evidence=text.split(/\n/).some(line=>{
  return mechanicalQualification(line)||
   /\bmechanical engineering\s+(?:degree|experience)\b/i.test(line)||
   /\bmechanical engineering team\s+(?:is|are|owns?|designs?|develops?|builds?)\b/i.test(line)||/\bBSME\b/i.test(line);
 });
 // Core mechanical disciplines often accept a general engineering/aerospace
 // degree. Their actual engineering work is stronger evidence than the degree's wording.
 if(coreMechanicalTitle.test(title)&&hasPhysicalWork(text)&&(engineeringTitle.test(title)||evidence)){
  const civilOnly=/\b(?:structur(?:e|es|al)|stress)\b/i.test(title)&&/\b(civil engineering|concrete|bridges|building design|seismic)\b/i.test(text)&&!/\b(mechanical|aircraft|airframe|spacecraft|propulsion|turbine|pressure vessel)\b/i.test(text);
  if(!civilOnly)return true;
 }
 if(!evidence)return false;
 // Generic hardware/test/systems titles need actual physical engineering work,
 // beyond a degree option or collaboration with a mechanical engineering team.
 return mechanicalTitle.test(title)||coreMechanicalTitle.test(title)||hasPhysicalWork(text);
}
function range(min,max,evidence){min=Number(min);max=Number(max??min);return Number.isFinite(min)&&Number.isFinite(max)&&min>=100000&&max>=min&&max<=1000000?{min,max,currency:'USD',period:'year',evidence}:null;}
function publishedRanges(text){
 // Employers use both "$154,000 USD - $193,000 USD" and
 // "152,000 USD - 253,000 USD". A currency marker must be attached to a range.
 const amount='((?:\\d{1,3}(?:,\\d{3})+|\\d{2,7})(?:\\.\\d+)?\\s*[kK]?)';
 const re=new RegExp(`(\\$|USD)?\\s*${amount}\\s*(USD)?\\s*(?:[-–—]|to|and)\\s*(\\$|USD)?\\s*${amount}\\s*(USD)?`,'gi');
 const result=[];
 for(const m of text.matchAll(re)){
  if(!(m[1]||m[3]||m[4]||m[6]))continue;
  if(/\band\b/i.test(m[0])&&!/\bbetween\s*$/i.test(text.slice(Math.max(0,m.index-20),m.index)))continue;
  const before=text.slice(Math.max(0,m.index-500),m.index),after=text.slice(m.index+m[0].length,m.index+m[0].length+500),context=before+m[0]+after;
  // CAD in qualifications means computer-aided design, not Canadian dollars.
  // Reject foreign currencies only when attached to the amount or explicitly named.
  const foreign=/\b(?:CAD|AUD|NZD|SGD|HKD|MXN|TWD|EUR|GBP)\s*$/i.test(before)||/^\s*(?:CAD|AUD|NZD|SGD|HKD|MXN|TWD|EUR|GBP)\b/i.test(after)||/canadian dollars|australian dollars|new zealand dollars/i.test(before.slice(-100)+after.slice(0,100));
  const prefix=before.trimEnd().split('\n').at(-1).slice(-160),baseIndex=[...prefix.matchAll(/(?:base\s+)?salar(?:y|ies)|base (?:pay|compensation)|annual pay/gi)].at(-1)?.index??-1;
  const exclusions=[...prefix.matchAll(/total (?:cash )?compensation|on[- ]target earnings|\bOTE\b|bonus(?:es)?|equity|stock (?:award|grant)/gi)];
  const nonBase=(exclusions.length>0&&exclusions.at(-1).index>baseIndex)||/^\s*(?:USD)?\s*(?:,\s*)?(?:\(?OTE\b|on[- ]target earnings\b|(?:including|inclusive of)\s+(?:performance[- ]based\s+)?(?:bonuses|bonus|equity))/i.test(after);
  const hourly=/^\s*(?:USD)?\s*(?:\/\s*h(?:ou)?r|per hour|hourly|per month|monthly)/i.test(after);
  const parse=v=>Number(v.replace(/[,\sKk]/g,''))*(/[kK]/.test(v)?1000:1);
  let min=parse(m[2]);const max=parse(m[5]);
  if(min<1000&&/[kK]/.test(m[5])&&!/[kK,]/.test(m[2]))min*=1000;
  if(min>=20000&&max>=min)result.push({min,max,nonBase,valid:!foreign&&!hourly&&!nonBase&&/salar(?:y|ies)|base (?:pay|compensation)|annual|per year|\/year|yearly/i.test(context)});
 }
 return result;
}
export function salary(job,type,text,source){
 const published=publishedRanges(text);
 if(type==='smartrecruiters'&&job.compensation?.min!=null){const s=job.compensation;if(s.currency!=='USD'||s.period!=='YEARLY'||published.some(r=>r.nonBase&&r.min===s.min&&r.max===(s.max??s.min)))return null;return range(s.min,s.max,'Employer salary field');}
 if(type==='smartrecruiters'&&source?.slug==='Intuitive'&&job.company?.identifier==='Intuitive'&&/^(?:US|USA|United States(?: of America)?)$/i.test(job.country||'')&&/^Full[- ]time$/i.test(job.employmentType||'')){
  // Intuitive's official careers pages label these exact fields "Base
  // Compensation Range Region 1/2" (formerly "Base Salary Range"). They are
  // salary bands for full-time U.S. professional roles; never annualize hourly pay.
  // https://careers.intuitive.com/bg/jobs/744000151099028/JOB218999/senior-mechanical-engineer-vision-equipment/
  const professional=(job.customField||[]).some(f=>f.fieldLabel==='Req Type'&&f.valueLabel==='Professional');
  const fields=(job.customField||[]).filter(f=>/^(?:Min|Max)\. Salary Region \d+$/.test(f.fieldLabel));
  if(professional&&fields.length){
   const regions=new Map();
   for(const f of fields){const [,side,region]=f.fieldLabel.match(/^(Min|Max)\. Salary Region (\d+)$/),value=String(f.valueLabel||'').match(/^(\d+(?:\.\d+)?) USD$/);if(!value)return null;const band=regions.get(region)||{};if(band[side]!==undefined)return null;band[side]=Number(value[1]);regions.set(region,band);}
   const bands=[...regions.values()];
   if(bands.some(b=>!Number.isFinite(b.Min)||!Number.isFinite(b.Max)||b.Min<100000||b.Max<b.Min))return null;
   return range(Math.min(...bands.map(b=>b.Min)),Math.max(...bands.map(b=>b.Max)),'Employer base salary fields (all published regions)');
  }
 }
 if(type==='lever'&&job.salaryRange){const s=job.salaryRange;if(s.currency!=='USD'||s.interval!=='per-year-salary')return null;return range(s.min,s.max,'Employer salary field');}
 if(type==='ashby'){
 const all=[...(job.compensation?.summaryComponents||[]),...(job.compensation?.compensationTiers||[]).flatMap(t=>t.components||[])].filter(c=>c.compensationType==='Salary');
 if(all.length){if(all.some(c=>c.currencyCode!=='USD'||c.interval!=='1 YEAR'||!Number.isFinite(c.minValue)||c.minValue<100000))return null;return range(Math.min(...all.map(c=>c.minValue)),Math.max(...all.map(c=>c.maxValue??c.minValue)),'Employer salary field');}
 }
 // Some boards repeat an OTE range in a generic salary widget. Repetition
 // cannot turn the same explicitly bonus-inclusive amount into base salary.
 const nonBaseRanges=new Set(published.filter(r=>r.nonBase).map(r=>`${r.min}:${r.max}`));
 const ranges=published.filter(r=>r.valid&&!nonBaseRanges.has(`${r.min}:${r.max}`));
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
 department=typeof department==='string'?department:department?.label||department?.name||'';
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
 const title=String(job.title||job.text||'').trim();if(!candidateTitle(title)||job.isListed===false)return null;
 if(job.application_deadline&&new Date(job.application_deadline)<new Date(now))return null;
 const text=plain([job.content||job.descriptionPlain||job.description||'',...(job.lists||[]).map(l=>l.content),job.additionalPlain||''].join('\n'));
 if(!relevant(title,text)||/does not represent (?:a )?(?:current|active) (?:job |position |employment )?opening|not (?:a |an )?(?:current|active) (?:job )?opening|for future (?:career |employment )?opportunities only/i.test(text))return null;
 const pay=salary(job,source.type,text,source);if(!pay)return null;
 const location=job.location?.name||job.location||job.categories?.location||'';
 const address=job.address?.postalAddress||{};
 const primary=String(location).split(/\s*;\s*/).map(label=>({label,country:job.country||address.addressCountry,address:{...address,addressLocality:String(location).includes(';')?undefined:address.addressLocality}}));
 const secondary=['ashby','workday'].includes(source.type)?(job.secondaryLocations||[]).map(l=>({label:l.location,country:l.address?.addressCountry,address:l.address||{}})):(job.categories?.allLocations||[]).map(label=>({label,country:job.country,address:{}}));
 const locations=[...new Map([...primary,...secondary].map(l=>[l.label,l])).values()].map(l=>({...l,geo:locate(l.label,l.country,cities,l.address)})).filter(l=>l.geo);
 if(!locations.length)return null;const geo=locations.find(l=>Number.isFinite(l.geo.lat))?.geo||locations[0].geo;
 const displayLocation=source.type==='workday'?locations.map(l=>l.label).join('; '):location;
 const posted=source.type==='greenhouse'?job.first_published:['ashby','smartrecruiters'].includes(source.type)?job.publishedAt:job.createdAt;
 const postedAt=posted&&Number.isFinite(new Date(posted).getTime())&&new Date(posted)<=new Date(now)?new Date(posted).toISOString():null;
 const url=job.absolute_url||job.jobUrl||job.hostedUrl;const applyUrl=job.applyUrl||url;
 if(!/^https:\/\//.test(url||'')||!/^https:\/\//.test(applyUrl||''))return null;
 return {id:`${source.type}:${source.slug}:${job.id}`,sourceId:source.slug,title,company:source.company,location:displayLocation,geo,locations:locations.map(l=>({label:l.label,...l.geo})),salary:pay,workMode:workMode(job,displayLocation,text),facts:facts(text,job.department||job.departments?.[0]?.name||job.categories?.team),employmentType:job.employmentType||job.categories?.commitment||(job.metadata||[]).find(m=>/employment type/i.test(m.name))?.value||null,postedAt,postedLabel:['ashby','smartrecruiters','workday'].includes(source.type)?'Published / republished':source.type==='lever'?'First listed':'First published',updatedAt:job.updated_at||null,checkedAt:now,url,applyUrl,stale:false};
}
export function canonicalJobURL(url){
 try{
  const parsed=new URL(url);parsed.hash='';
  for(const key of [...parsed.searchParams.keys()])if(/^utm_|^(?:gclid|fbclid|gh_src)$/i.test(key))parsed.searchParams.delete(key);
  parsed.searchParams.sort();
  return parsed.href;
 }catch{return url;}
}
export function reconcile(previous,results,now){
 // Keep the first observation even after a job leaves the active snapshot.
 // Employer posting dates can change on a repost and are a separate clock.
 const validSeen=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.parse(now)?new Date(value).toISOString():null;
 const firstSeen=new Map(Object.entries(previous?.firstSeenById||{}).map(([id,date])=>[id,validSeen(date)]).filter(([,date])=>date));
 for(const job of previous?.jobs||[]){
 const known=validSeen(job.firstSeenAt)||firstSeen.get(job.id);
 const baseline=[validSeen(previous.generatedAt),validSeen(job.checkedAt)].filter(Boolean).sort()[0];
 if(known||baseline)firstSeen.set(job.id,known||baseline);
 }
 const jobs=[],sources=[];
 for(const r of results){if(r.ok){jobs.push(...r.jobs);sources.push({...r.source,ok:true,checkedAt:now,total:r.total,matches:r.jobs.length});}
 else {const old=(previous?.jobs||[]).filter(j=>j.sourceId===r.source.slug&&new Date(now)-new Date(j.checkedAt)<24*3600000);jobs.push(...old.map(j=>({...j,stale:true})));sources.push({...r.source,ok:false,checkedAt:previous?.sources?.find(s=>s.slug===r.source.slug)?.checkedAt||null,matches:old.length,error:r.error});}}
 const observed=jobs.map(job=>{const firstSeenAt=firstSeen.get(job.id)||new Date(now).toISOString();firstSeen.set(job.id,firstSeenAt);return {...job,firstSeenAt};});
 const unique=[...new Map(observed.map(j=>[canonicalJobURL(j.url),j])).values()];unique.sort((a,b)=>(b.postedAt||'').localeCompare(a.postedAt||''));
 return {schemaVersion:1,generatedAt:now,refreshMinutes:30,salaryMinimum:100000,firstSeenById:Object.fromEntries(firstSeen),sources,jobs:unique};
}
