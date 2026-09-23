import test from 'node:test';
import assert from 'node:assert/strict';
import {energyFocus,compareEnergy} from '../energy.mjs';

test('verified employer feeds supply a specific sector reason',()=>{
 for(const sourceId of ['cfsenergy','oklo','FormEnergy','rondoenergy','redwoodmaterials']){
  const focus=energyFocus({sourceId,title:'Senior Mechanical Engineer'});
  assert.ok(focus?.label);
  assert.ok(focus.reason.length>30);
 }
 assert.equal(energyFocus({sourceId:'unknown',company:'Form Energy',title:'Mechanical Engineer'}),null);
 assert.equal(energyFocus({sourceId:'crusoe',title:'Mechanical Engineer'}),null);
});

test('explicit energy title signals include established and emerging energy sectors',()=>{
 for(const title of [
  'Mechanical Engineer - Power Generation','Mechanical Engineer, Nuclear',
  'Mechanical Design Engineer, Fusion Energy','Mechanical Engineer - Grid Interconnection',
  'Mechanical Engineer - Electric Grid','Mechanical Engineer, Energy Storage',
  'Mechanical Engineer - Oil & Gas','Mechanical Engineer - Refinery',
  'Geothermal Mechanical Engineer','Mechanical Engineer - Solar PV',
  'Mechanical Engineer - Wind Turbine','Mechanical Engineer - Hydropower',
 ])assert.ok(energyFocus({title}),title);
});

test('generic engineering and unrelated sector phrases do not become energy matches',()=>{
 for(const title of [
  'Mechanical Engineer','Thermal Engineer','High Energy Mechanical Engineer',
  'Power Electronics Mechanical Engineer','Power System Battery Pack Designer',
  'Senior Mechanical Engineer, Battery Design','Mechanical Engineer, Sensor Fusion',
  'Mechanical Engineer, Nuclear Medicine','Mechanical Engineer, Wind Tunnel',
  'Mechanical Engineer - Satellite Solar Array','Mechanical Engineer, Spacecraft Photovoltaic',
  'Mechanical Engineer - Gas Delivery','Mechanical Engineer - Grid Mesh',
 ])assert.equal(energyFocus({title}),null,title);
 assert.equal(energyFocus({title:'Mechanical Engineer',description:'Our company supports solar energy and nuclear power.',facts:['Power generation']}),null);
 assert.equal(energyFocus({}),null);
 assert.equal(energyFocus(null),null);
});

const now=Date.parse('2026-09-23T12:00:00Z');
const job=(id,days,energy=false)=>({id,title:'Mechanical Engineer',sourceId:energy?'oklo':'other',postedAt:days===null?null:new Date(now-days*86400000).toISOString()});
const sort=jobs=>jobs.sort((a,b)=>compareEnergy(a,b,now)).map(j=>j.id);

test('energy emphasis stays inside the existing age color bands',()=>{
 assert.deepEqual(sort([
  job('unknown-energy',null,true),job('red-energy',31,true),job('yellow-energy',30,true),
  job('green-energy',14,true),job('blue-energy',7,true),job('today',0),
  job('green-new',8),job('yellow-new',15),job('red-new',31),job('unknown',null),
 ]),['blue-energy','today','green-energy','green-new','yellow-energy','yellow-new','red-energy','red-new','unknown-energy','unknown']);
});

test('recency breaks same-sector ties and equal dates preserve stable order',()=>{
 assert.deepEqual(sort([job('older-energy',5,true),job('new-energy',1,true),job('same-first',2),job('same-second',2),job('newest-other',0)]),['new-energy','older-energy','newest-other','same-first','same-second']);
 assert.equal(compareEnergy(job('a',1),job('b',1),now),0);
});

test('unknown and invalid dates never outrank dated jobs',()=>{
 const invalid={...job('invalid',null,true),postedAt:'not a date'};
 assert.deepEqual(sort([invalid,job('unknown',null,true),job('old-dated',500)]),['old-dated','invalid','unknown']);
 assert.ok(Number.isFinite(compareEnergy(invalid,job('unknown',null,true),now)));
});
