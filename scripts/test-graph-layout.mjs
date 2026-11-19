import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
const result=await build({entryPoints:[new URL('../frontend/src/graphCompilability.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const {assessGraphCompilability}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const templateBuild=await build({entryPoints:[new URL('../frontend/src/topologyTemplates.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const templates=await import(`data:text/javascript;base64,${Buffer.from(templateBuild.outputFiles[0].text).toString('base64')}`);
const translatorBuild=await build({entryPoints:[new URL('../frontend/src/translator.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const {buildModelDict}=await import(`data:text/javascript;base64,${Buffer.from(translatorBuild.outputFiles[0].text).toString('base64')}`);
const seed=templates.closedBoxTemplate;
const assess=current=>assessGraphCompilability({topology:'closed_box',nodes:current.nodes,edges:current.edges,seedGraph:seed,currentGraph:current}).status;
assert.equal(assess(seed),'compilable_anchor');
const moved=structuredClone(seed); moved.nodes[0].position={x:345,y:123};
assert.equal(assess(moved),'compilable_anchor');
moved.nodes[0].selected=true; moved.nodes[0].width=200;
assert.equal(assess(moved),'compilable_anchor');
const changed=structuredClone(seed);changed.nodes[1].data.Vb=99;
assert.equal(assess(changed),'compilable_anchor');
for (const invalid of [0,-1,NaN,Infinity,'50']) {
  changed.nodes[1].data.Vb=invalid;
  assert.notEqual(assess(changed),'compilable_anchor');
}
changed.nodes[1].data.Vb=50;
changed.nodes[0].data.model='em_explicit';
assert.notEqual(assess(changed),'compilable_anchor');
const disconnected=structuredClone(seed);disconnected.edges.pop();
assert.notEqual(assess(disconnected),'compilable_anchor');
console.log('PASS: graph movement/selection preserve run eligibility; valid parameter edits run; invalid values, driver-model changes and connection changes remain gated.');
const cbDriver=seed.nodes.find(n=>n.data.type==='driver').data;
assert.match(cbDriver.label,/unverified/);
for(const key of ['Bl','Mms','Cms','Rms'])assert(!(key in cbDriver));
for(const [key,value]of Object.entries({Re:5,Le:1.4,Sd:531,Fs:42.38484265955805,Qes:.2758856393208077,Qms:6.105685644071086,Vas:59.98427525495432}))
  assert(Math.abs(cbDriver[key]-value)<1e-10,`physical provenance: ${key}`);
// Independent inverse T/S conversion, using the accepted kernel's frozen air
// constants, checks that all four historical explicit coefficients survive.
const sd=cbDriver.Sd*1e-4, w0=2*Math.PI*cbDriver.Fs;
const cms=(cbDriver.Vas/1000)/(1.2041*343.2**2*sd**2);
const mms=1/(w0*w0*cms),rms=w0*mms/cbDriver.Qms;
const bl=Math.sqrt(w0*mms*cbDriver.Re/cbDriver.Qes);
for(const [value,expected]of [[cms,.00015],[mms,.094],[rms,4.1],[bl,21.3]])
  assert(Math.abs(value/expected-1)<1e-10,'derived TS must preserve legacy explicit driver coefficient');
const cbCanonical=buildModelDict(seed.nodes,seed.edges);
assert.equal(cbCanonical.driver.Re,'5 ohm');assert.equal(cbCanonical.driver.Sd,'531 cm2');
for(const [kind,key]of [['driver','Fs'],['driver','Re'],['driver','source_voltage_rms'],['volume','Vb'],['radiator','Sd']]) {
  const incomplete=structuredClone(seed);
  delete incomplete.nodes.find(n=>n.data.type===kind).data[key];
  assert.notEqual(assess(incomplete),'compilable_anchor',`missing ${kind} ${key} must block graph run`);
  assert.throws(()=>buildModelDict(incomplete.nodes,incomplete.edges),/Missing required/);
}
const mixedDriver=structuredClone(seed);mixedDriver.nodes[0].data.Bl=21.3;
assert.notEqual(assess(mixedDriver),'compilable_anchor');
assert.throws(()=>buildModelDict(mixedDriver.nodes,mixedDriver.edges),/Mixed explicit/);
const malformedDriver=structuredClone(seed);malformedDriver.nodes[0].data.Fs=true;
assert.notEqual(assess(malformedDriver),'compilable_anchor');
assert.throws(()=>buildModelDict(malformedDriver.nodes,malformedDriver.edges),/positive finite number/);
const cbConflictingArea=structuredClone(seed);
cbConflictingArea.nodes.find(n=>n.data.type==='radiator').data.area_cm2=100;
assert.notEqual(assess(cbConflictingArea),'compilable_anchor');
assert.throws(()=>buildModelDict(cbConflictingArea.nodes,cbConflictingArea.edges),/Conflicting values for front radiator area/);
const cbConflictingVolume=structuredClone(seed);
cbConflictingVolume.nodes.find(n=>n.data.type==='volume').data.volume_l=999;
assert.notEqual(assess(cbConflictingVolume),'compilable_anchor');
assert.throws(()=>buildModelDict(cbConflictingVolume.nodes,cbConflictingVolume.edges),/Conflicting values for rear chamber volume/);
console.log('PASS: named CB seed uses its physically derived TS inputs; missing and mixed driver/box fields fail before execution.');
for (const [topology,template] of [['bass_reflex',templates.bassReflexTemplate],['transmission_line',templates.transmissionLineTemplate]]) {
  const gate=current=>assessGraphCompilability({topology,...current,seedGraph:template}).canRunSimulation;
  assert(gate(template),topology);
  for (const key of ['areaCm2','lengthCm']) {
    const edited=structuredClone(template);
    const line=edited.nodes.find(n=>['duct','waveguide_1d'].includes(n.data.type));
    line.data[key]*=1.5;
    assert(gate(edited));
    for(const invalid of [0,-1,NaN,Infinity,'20']) {
      line.data[key]=invalid; assert(!gate(edited));
    }
  }
  const disconnected=structuredClone(template);disconnected.edges.pop();assert(!gate(disconnected));
  const extra=structuredClone(template);extra.nodes.push({...extra.nodes[0],id:'extra'});assert(!gate(extra));
  const renamed=structuredClone(template);renamed.nodes.forEach(n=>n.data.label='vent port driver');assert(gate(renamed));
  const missing=structuredClone(template);
  const line=missing.nodes.find(n=>['duct','waveguide_1d'].includes(n.data.type));
  delete line.data.lengthCm;
  assert(!gate(missing),`${topology} missing length must block simulation`);
  assert.throws(()=>buildModelDict(missing.nodes,missing.edges),/Missing required/);
  const missingRadiator=structuredClone(template);
  delete missingRadiator.nodes.find(n=>n.data.type==='radiator').data.Sd;
  assert(!gate(missingRadiator),`${topology} missing front radiator Sd must block simulation`);
  assert.throws(()=>buildModelDict(missingRadiator.nodes,missingRadiator.edges),/Missing required front radiator area/);
  const inconsistentRadiator=structuredClone(template);
  inconsistentRadiator.nodes.find(n=>n.data.type==='radiator').data.Sd=500;
  assert(!gate(inconsistentRadiator),`${topology} inconsistent front radiator Sd must block simulation`);
  assert.throws(()=>buildModelDict(inconsistentRadiator.nodes,inconsistentRadiator.edges),/must match driver Sd/);
  const conflictingAlias=structuredClone(template);
  conflictingAlias.nodes.find(n=>n.data.type==='radiator').data.area_cm2=500;
  assert(!gate(conflictingAlias),`${topology} conflicting radiator area aliases must block simulation`);
  assert.throws(()=>buildModelDict(conflictingAlias.nodes,conflictingAlias.edges),/Conflicting values for front radiator area/);
  const equalAlias=structuredClone(template);
  equalAlias.nodes.find(n=>n.data.type==='radiator').data.area_cm2=132;
  assert(gate(equalAlias),`${topology} matching alias must remain valid`);
  assert.deepEqual(buildModelDict(equalAlias.nodes,equalAlias.edges),buildModelDict(template.nodes,template.edges));
  if(topology==='bass_reflex') {
    const conflictingVolume=structuredClone(template);
    conflictingVolume.nodes.find(n=>n.data.type==='volume').data.volume_l=999;
    assert(!gate(conflictingVolume));
    assert.throws(()=>buildModelDict(conflictingVolume.nodes,conflictingVolume.edges),/Conflicting values for rear chamber volume/);
    const conflictingPort=structuredClone(template);
    conflictingPort.nodes.find(n=>n.data.type==='duct').data.length_cm=30;
    assert(!gate(conflictingPort));
    assert.throws(()=>buildModelDict(conflictingPort.nodes,conflictingPort.edges),/Conflicting values for port length/);
  }
  assert.equal(buildModelDict(template.nodes,template.edges).elements.find(e=>e.id==='front_rad').area,'132 cm2');
}
console.log('PASS: BR/TL templates and parameter edits run; invalid values and structural changes are blocked.');
const tl=templates.transmissionLineTemplate;
const tlGate=patch=>{
  const current=structuredClone(tl);Object.assign(current.nodes.find(n=>n.data.type==='waveguide_1d').data,patch);
  return assessGraphCompilability({topology:'transmission_line',...current,seedGraph:tl}).canRunSimulation;
};
for(const patch of [{driverOffsetCm:0,lossNpPerM:0},{driverOffsetCm:45,mouthAreaCm2:66,lossNpPerM:.3},{mouthAreaCm2:264},{driverOffsetCm:159.9}]) assert(tlGate(patch));
for(const patch of [{driverOffsetCm:-1},{driverOffsetCm:160},{driverOffsetCm:161},{lossNpPerM:-.1},{lossNpPerM:NaN},{mouthAreaCm2:0},{mouthAreaCm2:Infinity},{driverOffsetCm:'45'}]) assert(!tlGate(patch));
console.log('PASS: taper/offset/attenuation bounds; zero offset and zero attenuation remain valid.');
