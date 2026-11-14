import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
const result=await build({entryPoints:[new URL('../frontend/src/graphCompilability.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const {assessGraphCompilability}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const seed={nodes:['driver','volume','radiator'].map((type,i)=>({id:type,type:'default',position:{x:i*100,y:0},data:{type}})),edges:[{id:'box',source:'driver',target:'volume'},{id:'front',source:'driver',target:'radiator'}]};
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
