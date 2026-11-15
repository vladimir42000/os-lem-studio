// Run with the real backend active: node scripts/test-workflow.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const ts = require('typescript');
async function load(name) {
  const source = readFileSync(new URL(`../frontend/src/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { buildModelDict } = await load('translator');
const { runSimulationThin } = await load('thinRunner');
const { computeRunnerStateTruth } = await load('lifecycleTruth');
const nodes = [
  {id:'driver',data:{type:'driver'}},
  {id:'box',data:{type:'volume',Vb:18}},
  {id:'front',data:{type:'radiator'}},
];
const model = buildModelDict(nodes, []);
const frequenciesHz = Array.from({length:150},(_,i)=>20*Math.pow(50,i/149));
const options = {canonicalModel:model,frequenciesHz,backendUrl:process.env.STUDIO_TEST_BACKEND_URL || 'http://127.0.0.1:8000/api/simulate'};
const first = await runSimulationThin(options);
assert.equal(first.frequencies_hz.length,150);
assert(first.series.spl_front.every(Number.isFinite));
const originalKey = JSON.stringify(model);
const lifecycle = (current,key=originalKey,source='graph-derived') => computeRunnerStateTruth({
  simulationResult:first,latestResultCanonicalModelSnapshotKey:key,
  latestResultSourceKind:'graph-derived',currentCanonicalModelSnapshotKey:JSON.stringify(current),currentCanonicalModelSourceKind:source,
});
assert(lifecycle(model).resultLifecycleIsCurrent);
nodes[1].data.Vb=36;
const changed = buildModelDict(nodes,[]);
assert(lifecycle(changed).resultLifecycleIsStale);
const second = await runSimulationThin({...options,canonicalModel:changed});
assert(second.properties.zin_mag_ohm.some((value,index)=>Math.abs(value-first.properties.zin_mag_ohm[index])>0.01));
assert(lifecycle(changed,JSON.stringify(changed)).resultLifecycleIsCurrent);
const saved = JSON.stringify(changed,null,2);
const loaded = JSON.parse(saved);
assert(lifecycle(loaded,JSON.stringify(changed),'loaded-override').resultLifecycleIsStale);
const restored = await runSimulationThin({...options,canonicalModel:loaded});
assert.deepEqual(restored.series,second.series);
for (const [fetchImpl, pattern] of [
  [async()=>{throw new Error('network');}, /Cannot reach/],
  [async()=>new Response('not json',{status:502}), /invalid response/],
  [async()=>Response.json({detail:'OS-LEM kernel is unavailable'},{status:503}), /kernel is unavailable/],
  [async()=>Response.json({status:'success',data:{frequencies_hz:[]}}), /frequency grid/],
]) {
  await assert.rejects(runSimulationThin({...options,fetchImpl}),pattern);
}
await assert.rejects(runSimulationThin({...options,canonicalModel:{}}));
console.log('PASS: real-kernel run, edit/rerun, JSON save/load round trip, result ownership, and failure handling.');
const {bassReflexTemplate,transmissionLineTemplate}=await load('topologyTemplates');
for(const [name,template] of [['bass_reflex',bassReflexTemplate],['transmission_line',transmissionLineTemplate]]) {
  const canonical=buildModelDict(template.nodes,template.edges);
  assert.equal(canonical.meta.studio_topology,name);
  const frequencyGrid=Array.from({length:600},(_,i)=>10*100**(i/599));
  const run=canonicalModel=>runSimulationThin({...options,canonicalModel,frequenciesHz:frequencyGrid});
  const baseline=await run(canonical);
  for(const key of ['spl_sum','spl_front',name==='bass_reflex'?'spl_port':'spl_mouth']) {
    assert.equal(baseline.series[key].length,600);
    assert(baseline.series[key].every(Number.isFinite));
  }
  assert(baseline.series.spl_sum.some((v,i)=>Math.abs(v-baseline.series.spl_front[i])>1));
  const saved=JSON.parse(JSON.stringify(canonical));
  assert.deepEqual((await run(saved)).series,baseline.series);
  const renamed=structuredClone(template);renamed.nodes.forEach(n=>n.data.label='vent port');
  assert.deepEqual(buildModelDict(renamed.nodes,renamed.edges),canonical,'display labels must not affect acoustics');
  for(const field of ['areaCm2','lengthCm']) {
    const changed=structuredClone(template);
    const duct=changed.nodes.find(n=>['duct','waveguide_1d'].includes(n.data.type));
    duct.data[field]*=1.5;
    const result=await run(buildModelDict(changed.nodes,changed.edges));
    assert(result.properties.zin_mag_ohm.some((v,i)=>Math.abs(v-baseline.properties.zin_mag_ohm[i])>0.1),`${name} ${field} must affect impedance`);
    assert(result.series.spl_sum.some((v,i)=>Math.abs(v-baseline.series.spl_sum[i])>0.1));
  }
  const twice=structuredClone(canonical);twice.driver.source_voltage_rms*=2;
  const doubled=await run(twice);
  doubled.series.spl_sum.forEach((v,i)=>assert(Math.abs(v-baseline.series.spl_sum[i]-20*Math.log10(2))<1e-8));
  doubled.properties.zin_mag_ohm.forEach((v,i)=>assert(Math.abs(v-baseline.properties.zin_mag_ohm[i])<1e-8));
  // Export exact defaults for independent Hornresp/Akabak checks, only on request.
  if(process.env.STUDIO_EXPORT_REFERENCE_DIR) {
    const {mkdirSync,writeFileSync}=await import('node:fs');
    const folder=process.env.STUDIO_EXPORT_REFERENCE_DIR;mkdirSync(folder,{recursive:true});
    writeFileSync(`${folder}/${name}.json`,JSON.stringify(canonical,null,2)+'\n');
    const outlet=name==='bass_reflex'?'spl_port':'spl_mouth';
    const rows=frequencyGrid.map((f,i)=>[f,baseline.series.spl_sum[i],baseline.series.spl_front[i],baseline.series[outlet][i],baseline.properties.zin_mag_ohm[i],Math.atan2(baseline.properties.zin_complex_ohm[i].imag,baseline.properties.zin_complex_ohm[i].real)*180/Math.PI].join(','));
    writeFileSync(`${folder}/${name}.csv`,['frequency_hz,spl_combined_db,spl_driver_db,spl_outlet_db,impedance_ohm,impedance_phase_deg',...rows].join('\n')+'\n');
  }
  console.log(`PASS: ${name} real-kernel combined SPL, geometry sensitivity, label independence, save/load, voltage scaling.`);
}
const tlGrid=Array.from({length:600},(_,i)=>10*100**(i/599));
const tlModel=patch=>{
  const graph=structuredClone(transmissionLineTemplate);
  Object.assign(graph.nodes.find(n=>n.data.type==='waveguide_1d').data,patch);
  return buildModelDict(graph.nodes,graph.edges);
};
const tlRun=model=>runSimulationThin({...options,canonicalModel:model,frequenciesHz:tlGrid});
const tlBase=await tlRun(tlModel({}));
for(const [name,patch] of [
  ['tl_taper',{mouthAreaCm2:66}],
  ['tl_offset',{driverOffsetCm:45}],
  ['tl_stuffed',{lossNpPerM:.3}],
  ['tl_combined',{areaCm2:264,mouthAreaCm2:66,driverOffsetCm:45,lossNpPerM:.3}],
]) {
  const model=tlModel(patch);
  const result=await tlRun(model);
  assert(result.series.spl_sum.every(Number.isFinite));
  assert(result.properties.zin_mag_ohm.some((v,i)=>Math.abs(v-tlBase.properties.zin_mag_ohm[i])>.1),name);
  assert.deepEqual((await tlRun(JSON.parse(JSON.stringify(model)))).series,result.series);
  const line=model.elements.filter(e=>e.type==='waveguide_1d');
  assert(line.every(e=>Number.parseFloat(e.length)>0));
  assert.equal(line.length,patch.driverOffsetCm ? 2 : 1);
  assert.equal(line.at(-1).area_end,model.elements.find(e=>e.id==='mouth_rad').area);
  if(patch.driverOffsetCm) {
    assert.equal(line[0].node_a,'closed_end');
    assert.equal(line[0].node_b,'rear');assert.equal(line[1].node_a,'rear');
    assert.equal(line[0].area_end,line[1].area_start);
    assert(Math.abs(line.reduce((s,e)=>s+parseFloat(e.length),0)-160)<1e-9);
    const expected=(patch.areaCm2??132)+((patch.mouthAreaCm2??132)-(patch.areaCm2??132))*45/160;
    assert.equal(parseFloat(line[0].area_end),expected);
  }
  if(process.env.STUDIO_EXPORT_REFERENCE_DIR) {
    const {writeFileSync}=await import('node:fs'); const folder=process.env.STUDIO_EXPORT_REFERENCE_DIR;
    writeFileSync(`${folder}/${name}.json`,JSON.stringify(model,null,2)+'\n');
    const rows=tlGrid.map((f,i)=>[f,result.series.spl_sum[i],result.series.spl_front[i],result.series.spl_mouth[i],result.properties.zin_mag_ohm[i],Math.atan2(result.properties.zin_complex_ohm[i].imag,result.properties.zin_complex_ohm[i].real)*180/Math.PI].join(','));
    writeFileSync(`${folder}/${name}.csv`,['frequency_hz,spl_combined_db,spl_driver_db,spl_outlet_db,impedance_ohm,impedance_phase_deg',...rows].join('\n')+'\n');
  }
  console.log(`PASS: ${name} live run, geometry/termination consistency, parameter sensitivity and save/load.`);
}

// Check complete tuning memories with an actual serialized kernel result.
const {build}=require('esbuild');
const tuningBundle=await build({entryPoints:[new URL('../frontend/src/tuningState.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const tuning=await import(`data:text/javascript;base64,${Buffer.from(tuningBundle.outputFiles[0].text).toString('base64')}`);
const tuningGraph=structuredClone(bassReflexTemplate);
const tuningModel=buildModelDict(tuningGraph.nodes,tuningGraph.edges);
const tuningResult=await runSimulationThin({...options,canonicalModel:tuningModel});
let session={version:1,workspace:{topology:'bass_reflex',graph:tuningGraph,seed:structuredClone(bassReflexTemplate),override:null,pins:['bass_reflex:node_volume_1:Vb']},result:{model:tuningModel,data:tuningResult,source:'graph-derived'},memories:[],nextId:1,referenceId:null};
session=tuning.memorise(session,tuningModel);
assert.deepEqual(tuning.parseSession(JSON.stringify(session)),session);
session.workspace.graph.nodes.find(n=>n.data.type==='volume').data.Vb=42;
const editedModel=buildModelDict(session.workspace.graph.nodes,session.workspace.graph.edges);
assert.throws(()=>tuning.memorise(session,editedModel));
session=tuning.recall(session,1);
assert.deepEqual(session.result.data,tuningResult);
assert.deepEqual(buildModelDict(session.workspace.graph.nodes,session.workspace.graph.edges),tuningModel);
console.log('PASS: real-kernel complete memory/session save-load, stale-memory rejection and whole-model recall.');
