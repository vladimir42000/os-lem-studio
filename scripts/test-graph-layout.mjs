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
const templateBuild=await build({entryPoints:[new URL('../frontend/src/topologyTemplates.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const templates=await import(`data:text/javascript;base64,${Buffer.from(templateBuild.outputFiles[0].text).toString('base64')}`);
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
