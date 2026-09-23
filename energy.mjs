import {jobAge} from './age.mjs';

// Employer sectors checked against official company pages, September 2026.
// Match the feed ID, not company-name substrings or description boilerplate.
const employers = new Map([
 // https://www.cfs.energy/technology/
 ['cfsenergy', {label:'Fusion energy',reason:'Commonwealth Fusion Systems develops fusion energy systems.'}],
 // https://oklo.com/
 ['oklo', {label:'Nuclear energy',reason:'Oklo develops advanced fission power and nuclear fuel recycling.'}],
 // https://formenergy.com/technology/battery-technology/
 ['formenergy', {label:'Energy storage',reason:'Form Energy develops long-duration batteries for the electric grid.'}],
 // https://www.rondo.com/products
 ['rondoenergy', {label:'Industrial heat',reason:'Rondo Energy develops heat batteries for industrial energy use.'}],
 // https://www.redwoodmaterials.com/about/
 ['redwoodmaterials', {label:'Battery materials & storage',reason:'Redwood Materials produces battery materials and deploys energy storage systems.'}],
]);

// Explicit title signals only: general power electronics, thermal engineering,
// vehicle batteries, wind tunnels and sensor fusion are not energy-sector proof.
const titleSignals = [
 ['Nuclear energy', /\b(?:nuclear (?:energy|power|reactor|plant|engineering)|(?:engineer|engineering)\b.{0,30}\bnuclear)\b/i],
 ['Fusion energy', /\b(?:fusion (?:energy|power|reactor)|nuclear fusion)\b/i],
 ['Power generation', /\b(?:power generation|power plant|hydroelectric|hydropower)\b/i],
 ['Electric grid', /\b(?:(?:electric|electrical|power) grid|grid (?:interconnection|integration|storage|engineer|engineering)|microgrid)\b/i],
 ['Energy storage', /\b(?:energy storage|battery storage|thermal (?:energy )?storage|BESS)\b/i],
 ['Oil & gas', /\b(?:oil\s*(?:&|and|\/)\s*gas|natural gas|liquefied natural gas|LNG|refiner(?:y|ies)|petrochemical)\b/i],
 ['Geothermal energy', /\bgeothermal\b/i],
 ['Solar energy', /\b(?:solar (?:energy|power|farm|PV)|photovoltaic)\b/i],
 ['Wind energy', /\bwind (?:energy|power|turbine|farm)\b/i],
];

/** A sector signal, not a claim that the candidate meets this job's requirements. */
export function energyFocus(job) {
 const employer=employers.get(String(job?.sourceId??'').toLowerCase());
 if(employer)return {...employer};
 const title=String(job?.title??'');
 // Nuclear medicine and spacecraft photovoltaics belong to other sectors.
 if(/\b(?:nuclear medicine|radiopharma|satellite|spacecraft|wind tunnel|sensor fusion)\b/i.test(title))return null;
 const signal=titleSignals.find(([,pattern])=>pattern.test(title));
 return signal?{label:signal[0],reason:`The job title explicitly mentions ${signal[0].toLowerCase()}.`}:null;
}

const ageOrder={blue:0,green:1,yellow:2,red:3,unknown:4};
const timestamp=job=>Number.isFinite(Date.parse(job?.postedAt))?Date.parse(job.postedAt):0;

/** Keep age bands in order, then favor energy roles within a band, then recency.
 * Equal keys return zero so Array.sort preserves the existing order.
 * Pass a fixed now when sorting a snapshot or testing date boundaries.
 */
export function compareEnergy(a,b,now=Date.now()) {
 const band=ageOrder[jobAge(a?.postedAt,now).key]-ageOrder[jobAge(b?.postedAt,now).key];
 return band||Number(Boolean(energyFocus(b)))-Number(Boolean(energyFocus(a)))||timestamp(b)-timestamp(a);
}
