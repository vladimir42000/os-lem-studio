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
