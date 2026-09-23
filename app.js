import {jobAge,compareNewest,ageBreakdown,agePie,recentPostedCount,isRecentPosting} from './age.mjs';
import US_STATES from './us-states.mjs';
import {layoutMarkers} from './marker-layout.mjs';
import {energyFocus} from './energy.mjs';
import {configureApplications,openApplication} from './application.js';
import {API_BASE_URL} from './backend-config.js';
configureApplications({endpoint:API_BASE_URL});
const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=n=>'$'+(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+'k';
const pay=j=>short(j.salary.min)+(j.salary.max>j.salary.min?' – '+short(j.salary.max):'');
const modeClass=m=>m==='Hybrid'?'hybrid':m==='Remote'?'remote':m==='Not specified'?'unknown':'onsite';
const allLocations=j=>j.locations?.length?j.locations:[j.geo];
const date=d=>d?new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Not provided';
const stamp=d=>new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
let dataset=null,filtered=[],selectedId=null,map=null,layer=null,leaders=null,pinEntries=[],layoutFrame=0,mapNote='',markers=new Map(),busy=false,lastLoaded=0,lastRendered=0,networkError=false,weekOnly=false,overview=true,fittingUS=false;
try {
 if(!window.L)throw Error('Map library did not load');
 map=L.map('map',{zoomControl:false,minZoom:1,maxZoom:13,zoomSnap:.25,zoomDelta:.5,scrollWheelZoom:true});
 L.control.zoom({position:'bottomleft'}).addTo(map);
 // Bundled vectors render without waiting for an external tile service.
 L.geoJSON(US_STATES,{
  style:{color:'#587484',weight:.8,fillColor:'#29414f',fillOpacity:1},
  onEachFeature(feature,state){const label=document.createElement('span');label.textContent=feature.properties.name;state.bindTooltip(label,{sticky:true});},
  attribution:'<a href="https://github.com/topojson/us-atlas">U.S. Census / us-atlas</a>'
 }).addTo(map);
 const leaderPane=map.createPane('pin-leaders');leaderPane.style.zIndex='450';leaderPane.style.pointerEvents='none';
 leaders=L.layerGroup().addTo(map);
 layer=L.layerGroup().addTo(map);
 map.on('zoomend moveend resize',schedulePinLayout);
 map.on('movestart zoomstart',()=>{if(!fittingUS)overview=false;});
 fitUS();
 if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(overview)fitUS();else map.invalidateSize({pan:true,animate:false});}).observe($('map'));
}catch(e){map=null;$('map').innerHTML='<div class="map-error">The map couldn’t load. You can still explore all openings in the list.</div>';}
// Fit the contiguous 48 states even when the map pane is phone-sized.
function fitUS(){if(!map)return;overview=true;fittingUS=true;try{document.querySelector('.map-area').classList.remove('map-regional');map.invalidateSize({pan:false});map.fitBounds([[24.4,-125],[49.8,-66]],{paddingTopLeft:[20,52],paddingBottomRight:[20,132],animate:false});}finally{fittingUS=false;}}
// Keep Aleutian locations in the same map copy as the Alaska state outline.
const mapPosition=geo=>[geo.lat,geo.state==='AK'&&geo.lng>0?geo.lng-360:geo.lng];
function validData(d){return d&&Array.isArray(d.jobs)&&Array.isArray(d.sources)&&Number.isFinite(Date.parse(d.generatedAt))&&d.jobs.every(j=>j.id&&j.title&&j.company&&j.geo&&j.salary?.min>=100000&&/^https:\/\//.test(j.applyUrl));}
async function load(){if(busy)return;busy=true;$('refresh').disabled=true;try{const response=await fetch(`data/jobs.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Feed unavailable');const next=await response.json();if(!validData(next))throw Error('Feed format invalid');dataset=next;lastLoaded=Date.now();networkError=false;render();updateStatus();}catch(e){networkError=true;$('refresh-status').textContent=dataset?'Refresh failed · showing saved results':'Feed temporarily unavailable';$('live-dot').classList.add('stale');$('freshness').textContent='Could not check for updates. Use ↻ to retry.';if(!dataset)$('job-list').innerHTML='<div class="empty">The job feed couldn’t load. Check your connection, then press the refresh button above to try again.</div>';}finally{busy=false;$('refresh').disabled=false;}}
function updateStatus(){if(!dataset||networkError)return;const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(dataset.generatedAt))/60000));const failed=dataset.sources.filter(s=>!s.ok).length;const stale=minutes>75||failed>0;const age=minutes<1?'just now':minutes<60?`${minutes}m ago`:`${Math.floor(minutes/60)}h ${minutes%60}m ago`;$('refresh-status').textContent=minutes>75?`Feed delayed · ${age}`:`Checked ${age} · every 30m`;$('live-dot').classList.toggle('stale',stale);$('freshness').textContent=`Last feed check ${stamp(dataset.generatedAt)} · ${dataset.sources.length-failed}/${dataset.sources.length} employer feeds available${failed?` · ${failed} feed${failed>1?'s':''} unavailable; saved listings labeled`:''}`;$('freshness').classList.toggle('stale-message',stale);}
function render(){
 // A city breakdown must never outlive the set of jobs represented by its pin.
 if($('detail').querySelector('.group-list'))closeDetail();
 const q=$('search').value.trim().toLowerCase(),mode=$('mode').value,sort=$('sort').value,energyOnly=$('energy-only').checked,minSalary=Number($('min-salary').value),now=Date.now();lastRendered=now;
 // Apply the posting-date limit even to cached feeds and failed-source fallbacks.
 const active=dataset.jobs.filter(j=>isRecentPosting(j.postedAt,now)&&(!j.stale||now-Date.parse(j.checkedAt)<86400000));
 const weekly=active.filter(j=>j.salary.min>=minSalary&&Date.parse(j.firstSeenAt)>now-7*86400000&&Date.parse(j.firstSeenAt)<=now).sort((a,b)=>Date.parse(b.firstSeenAt)-Date.parse(a.firstSeenAt)||compareNewest(a,b)),weeklyIds=new Set(weekly.map(j=>j.id));
 filtered=active.filter(j=>j.salary.min>=minSalary&&(mode==='all'||j.workMode===mode)&&(!weekOnly||weeklyIds.has(j.id))&&(!energyOnly||energyFocus(j))&&`${j.title} ${j.company} ${j.location} ${energyFocus(j)?.label||''}`.toLowerCase().includes(q));
 filtered.sort(sort==='salary'?(a,b)=>b.salary.min-a.salary.min:sort==='company'?(a,b)=>a.company.localeCompare(b.company):compareNewest);
 $('total-stat').textContent=active.length.toLocaleString();$('companies-stat').textContent=new Set(active.map(j=>j.company)).size;$('states-stat').textContent=new Set(active.flatMap(j=>allLocations(j).map(l=>l.state)).filter(Boolean)).size;
 $('result-count').textContent=`${filtered.length} position${filtered.length===1?'':'s'}${weekOnly?' added this week':q||mode!=='all'||energyOnly||minSalary>100000?' found':''}`;$('clear').hidden=!q&&mode==='all'&&!energyOnly&&!weekOnly&&minSalary===100000;
 $('energy-count').textContent=active.filter(j=>energyFocus(j)).length;
 $('job-list').innerHTML=filtered.length?filtered.map(j=>{const a=jobAge(j.postedAt);return `<button class="job-card${selectedId===j.id?' selected':''}" data-id="${escape(j.id)}" style="--age-color:${a.color}" aria-label="${escape(j.title+' at '+j.company+', '+pay(j)+', '+j.workMode+', '+a.label)}"><div class="card-top"><span class="company">${escape(j.company)}</span><span class="badge ${modeClass(j.workMode)}">${escape(j.workMode)}</span></div><h2>${escape(j.title)}</h2><div class="location">${escape(j.location)}</div><div class="card-bottom"><span class="salary">${pay(j)} <span>/ yr</span></span><span class="age"><i style="background:${a.color}"></i>${escape(a.label)}</span></div>${j.stale?'<div class="stale-message age">Employer feed unavailable · saved listing</div>':''}</button>`;}).join(''):'<div class="empty">No positions match these filters. Try a lower salary minimum, another location, or clear the filters.</div>';
 $('job-list').querySelectorAll('[data-id]').forEach(el=>el.addEventListener('click',()=>selectJob(el.dataset.id)));
 if(selectedId&&!filtered.some(j=>j.id===selectedId)){selectedId=null;$('detail').hidden=true;}
 renderWeekly(weekly);
 drawPins(now);
 $('source-status').innerHTML=dataset.sources.map(s=>`<div>${escape(s.company)} · ${s.ok?`${active.filter(j=>j.sourceId===s.slug).length} recent jobs`:'feed unavailable'}</div>`).join('');
}
function renderWeekly(jobs){
 $('weekly-count').textContent=jobs.length;
 $('weekly-list').innerHTML=jobs.length?jobs.slice(0,6).map(j=>`<button data-weekly-id="${escape(j.id)}"><span>${escape(j.title)}</span><small>${escape(j.company)}</small><time datetime="${escape(j.firstSeenAt)}">Added ${date(j.firstSeenAt)}</time></button>`).join(''):'<p class="weekly-empty">No new additions in the past 7 days. Current openings are still on the map.</p>';
 $('week-show-all').hidden=!jobs.length&&!weekOnly;$('week-show-all').textContent=weekOnly?'Show all recent jobs':`View all ${jobs.length} in results`;
 $('weekly-list').querySelectorAll('[data-weekly-id]').forEach(button=>button.onclick=()=>{const id=button.dataset.weeklyId;if(!filtered.some(j=>j.id===id)){clearFilters();render();}selectJob(id);});
}
function clearFilters(){$('search').value='';$('mode').value='all';$('min-salary').value='100000';$('energy-only').checked=false;weekOnly=false;}
function drawPins(now=Date.now()){if(!map)return;layer.clearLayers();leaders.clearLayers();pinEntries=[];markers.clear();const groups=new Map();for(const j of filtered){for(const geo of allLocations(j)){if(!Number.isFinite(geo.lat)||!Number.isFinite(geo.lng))continue;const key=`${geo.lat},${geo.lng}`;if(!groups.has(key))groups.set(key,[]);if(!groups.get(key).some(x=>x.id===j.id))groups.get(key).push({...j,geo});}}
 for(const jobs of groups.values()){
 const newest=[...jobs].sort(compareNewest)[0],age=jobAge(newest.postedAt,now),grouped=jobs.length>1,size=grouped?32:16,pie=grouped?agePie(jobs,now):null,recent=recentPostedCount(jobs,now);
 const location=newest.geo.city||newest.location,breakdown=pie?.bands.map(b=>`${b.count} ${{green:'posted in the past week',yellow:'posted 8–14 days ago',red:'posted 15–30 days ago'}[b.key]}`).join('; ');
 const title=grouped?`${location}: ${jobs.length} jobs. ${breakdown}.${recent?` ${recent} posted in the past 7 days.`:''} Newest jobs first.`:`${location}: 1 job; ${age.label}`;
 const html=grouped?`<span class="pin-pie" style="background:${pie.gradient}" aria-hidden="true"><span class="pin-total">${jobs.length}</span></span>`:`<span class="pin-single" style="background:${age.color}" aria-hidden="true"></span>`;
 const anchor=L.latLng(mapPosition(newest.geo));
 const marker=L.marker(anchor,{autoPanOnFocus:false,icon:L.divIcon({className:`pin${grouped?' pin-group':''}${recent?' pin-recent':''}`,html,iconSize:[size,size],iconAnchor:[size/2,size/2]}),title,alt:title,keyboard:true,zIndexOffset:(grouped?1000:0)+(recent?2000:0)}).addTo(layer);
 const element=marker.getElement();element?.setAttribute('aria-label',title);
 element?.addEventListener('focus',()=>{if(element.matches(':focus-visible')&&!map.getBounds().contains(anchor))map.panTo(anchor,{animate:false});});
 pinEntries.push({id:`${newest.geo.lat},${newest.geo.lng}`,anchor,marker,radius:grouped?26:18});
 const tip=document.createElement('span');tip.textContent=title;marker.bindTooltip(tip,{direction:'top'});marker.on('click',()=>grouped?showGroup(jobs):selectJob(jobs[0].id,false));jobs.forEach(j=>markers.set(j.id,marker));
 }
 const unmapped=filtered.filter(j=>!allLocations(j).some(l=>Number.isFinite(l.lat))).length;mapNote=`Slices = age · number = total · glow = posted in past 7 days.${unmapped?` ${unmapped} without a precise city (in list)`:''}`;
 updatePinLayout();
}
function schedulePinLayout(){if(layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;updatePinLayout();});}
function updatePinLayout(){
 if(!map||!leaders)return;
 leaders.clearLayers();
 const zoom=map.getZoom(),phone=matchMedia('(max-width: 760px)').matches,regional=phone&&!overview&&zoom>=4.5,mapArea=document.querySelector('.map-area');
 if(mapArea.classList.contains('map-regional')!==regional){mapArea.classList.toggle('map-regional',regional);map.invalidateSize({pan:true,animate:false});}
 const pixelBounds=map.getPixelBounds(),viewport={left:pixelBounds.min.x,right:pixelBounds.max.x,top:pixelBounds.min.y,bottom:pixelBounds.max.y};
 const points=pinEntries.map(entry=>{const p=map.project(entry.anchor,zoom);return {id:entry.id,x:p.x,y:p.y,radius:entry.radius};});
 // Measure the wrapped legend with the longest note before reserving halo space.
 const declutter=!overview&&zoom>=(phone?7:4.5),note=mapNote+' Lines point to city locations.';
 $('map-note').textContent=declutter?note:mapNote;
 const mapRect=$('map').getBoundingClientRect(),topRect=document.querySelector('.map-top').getBoundingClientRect(),bottomRect=document.querySelector('.map-bottom').getBoundingClientRect(),haloSpace=26;
 const topPadding=Math.min(mapRect.height/3,Math.max(haloSpace,topRect.bottom-mapRect.top+haloSpace)),bottomPadding=Math.min(mapRect.height/2,Math.max(haloSpace,mapRect.bottom-bottomRect.top+haloSpace));
 // Preserve the overview. On closer views only nearby collisions are relaxed.
 const positions=declutter?layoutMarkers(points,{minDistance:52,maxDisplacement:phone?180:160,viewport,bounds:{left:viewport.left+haloSpace,right:viewport.right-haloSpace,top:viewport.top+topPadding,bottom:Math.max(viewport.top+topPadding+52,viewport.bottom-bottomPadding)}}):points;
 let displaced=0;
 positions.forEach((position,index)=>{
  const entry=pinEntries[index],shift=Math.hypot(position.x-points[index].x,position.y-points[index].y),moved=shift>1.5;
  const display=moved?map.unproject([position.x,position.y],zoom):entry.anchor;
  entry.marker.setLatLng(display);entry.marker.getElement()?.classList.toggle('pin-displaced',moved);
  if(moved){displaced++;L.polyline([entry.anchor,display],{pane:'pin-leaders',className:'pin-leader',interactive:false,color:'#bad0dc',weight:1,opacity:.65,smoothFactor:0}).addTo(leaders);}
 });
 $('map-note').textContent=mapNote+(displaced?' Lines point to city locations.':'');
}
function showGroup(jobs){$('detail').hidden=false;const city=jobs[0].geo.city||jobs[0].location,recent=recentPostedCount(jobs);$('detail').innerHTML=`<button class="close-detail" aria-label="Close city details">×</button><div class="eyebrow">${jobs.length} JOBS AT THIS LOCATION</div><h2>${escape(city)}, ${escape(jobs[0].geo.state||'')}</h2><p class="group-hint">Newest jobs first${recent?` · <strong class="recent-note">${recent} posted in the past 7 days</strong>`:''}</p><div class="group-ages">${ageBreakdown(jobs).map(b=>`<span><i class="age-dot" style="background:${b.color}"></i>${escape(b.label)} · <strong>${b.count}</strong></span>`).join('')}</div><div class="group-list">${[...jobs].sort(compareNewest).map(j=>`<button data-id="${escape(j.id)}"><i class="age-dot" style="background:${jobAge(j.postedAt).color}"></i>${escape(j.title)}<small>${escape(j.company)} · ${pay(j)} · ${escape(j.workMode)} · ${escape(jobAge(j.postedAt).label)}</small></button>`).join('')}</div>`;$('detail').querySelector('.close-detail').onclick=closeDetail;$('detail').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>selectJob(b.dataset.id,false));$('detail').querySelector('.close-detail').focus({preventScroll:true});}
function selectJob(id,pan=true){const j=filtered.find(j=>j.id===id);if(!j)return;selectedId=id;document.querySelectorAll('.job-card').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));const age=jobAge(j.postedAt);$('detail').hidden=false;$('detail').innerHTML=`<button class="close-detail" aria-label="Close job details">×</button><div class="company">${escape(j.company)}</div><h2>${escape(j.title)}</h2><div class="location">${escape(j.location)}</div><span class="badge ${modeClass(j.workMode)}">${escape(j.workMode)}</span><div class="age"><i style="background:${age.color}"></i>${escape(age.label)}</div><div class="salary">${pay(j)} <span>/ year</span></div><ul class="facts">${j.facts.map(f=>`<li>${escape(f)}</li>`).join('')}${j.employmentType?`<li>${escape(j.employmentType.replace(/([a-z])([A-Z])/g,'$1 $2'))}</li>`:''}</ul>${j.workMode==='Not specified'?'<p class="detail-dates">The employer has not clearly specified a work setting. Confirm it before applying.</p>':''}<div class="detail-dates">${escape(j.postedLabel)}: ${date(j.postedAt)}<br>Last checked: ${stamp(j.checkedAt)}${j.stale?'<br><strong class="stale-message">Source unavailable; opening not re-verified.</strong>':''}</div><button class="draft-cover-letter">Draft cover letter</button><a class="apply" href="${escape(j.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply on employer site ↗</a><a class="source-link" href="${escape(j.url)}" target="_blank" rel="noopener noreferrer">Read the full job description</a>`;$('detail').querySelector('.close-detail').onclick=closeDetail;$('detail').querySelector('.draft-cover-letter').onclick=()=>openApplication(j);$('detail').querySelector('.close-detail').focus({preventScroll:true});if(map&&pan&&Number.isFinite(j.geo.lat)){map.setView(mapPosition(j.geo),Math.max(map.getZoom(),5),{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});}if(innerWidth<761)$('detail').scrollIntoView({block:'nearest',behavior:'instant'});}
function closeDetail(){const id=selectedId;selectedId=null;$('detail').hidden=true;document.querySelectorAll('.job-card').forEach(c=>{c.classList.remove('selected');if(c.dataset.id===id)c.focus({preventScroll:true});});}
$('open-application-profile').onclick=()=>openApplication();
$('search').addEventListener('input',()=>dataset&&render());$('mode').addEventListener('change',()=>dataset&&render());$('min-salary').addEventListener('change',()=>dataset&&render());$('sort').addEventListener('change',()=>dataset&&render());$('energy-only').addEventListener('change',()=>dataset&&render());$('clear').onclick=()=>{clearFilters();render();};$('week-show-all').onclick=()=>{weekOnly=!weekOnly;if(weekOnly){$('search').value='';$('mode').value='all';$('energy-only').checked=false;}render();$('result-count').scrollIntoView({block:'nearest',behavior:'instant'});};if(matchMedia('(max-width: 1200px)').matches)$('weekly-disclosure').open=false;$('reset-map').onclick=()=>{closeDetail();fitUS();};$('refresh').onclick=load;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastLoaded>1800000)load();});setInterval(load,1800000);setInterval(()=>{if(dataset&&dataset.jobs.some(j=>(isRecentPosting(j.postedAt,lastRendered)&&!isRecentPosting(j.postedAt))||(j.stale&&lastRendered-Date.parse(j.checkedAt)<86400000&&Date.now()-Date.parse(j.checkedAt)>=86400000)))render();updateStatus();},60000);load();
