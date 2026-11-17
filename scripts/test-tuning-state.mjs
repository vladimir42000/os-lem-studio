import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
async function load(name){const r=await build({entryPoints:[new URL(`../frontend/src/${name}.ts`,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);}
const {memorise,recall,removeMemory,parseSession}=await load('tuningState');
const {closedBoxTemplate,bassReflexTemplate,transmissionLineTemplate}=await load('topologyTemplates');
const {buildModelDict}=await load('translator');
const {parametersFor}=await load('parameters');
const {overlaySeries}=await load('chartData');
const copy=x=>structuredClone(x);
const data={frequencies_hz:[10,100,1000],series:{spl_front:[70,80,90]},properties:{zin_mag_ohm:[5,20,10],cone_velocity_m_per_s:[]}};
const model=buildModelDict(closedBoxTemplate.nodes,closedBoxTemplate.edges);
let s={version:1,workspace:{topology:'closed_box',graph:copy(closedBoxTemplate),seed:copy(closedBoxTemplate),override:null,pins:['closed_box:node_volume_1:Vb']},result:{model:copy(model),data,source:'graph-derived'},memories:[],nextId:1,referenceId:null};
s=memorise(s,model);assert.equal(s.memories[0].label,'Result 1');
s.workspace.graph.nodes[1].data.Vb=80;
assert.equal(s.memories[0].workspace.graph.nodes[1].data.Vb,50,'deep snapshot');
assert.throws(()=>memorise(s,buildModelDict(s.workspace.graph.nodes,s.workspace.graph.edges)),/Run the current/);
s=recall(s,1);assert.equal(s.workspace.graph.nodes[1].data.Vb,50);
assert.deepEqual(parseSession(JSON.stringify(s)),s);
for(let i=1;i<9;i++)s=memorise(s,model);
assert.throws(()=>memorise(s,model),/Nine/);
s.referenceId=1;s=removeMemory(s,1);assert.equal(s.referenceId,null);s=memorise(s,model);assert.equal(s.memories.at(-1).label,'Result 10');
for(const bad of ['{}','not json',JSON.stringify({...s,version:2}),JSON.stringify({...s,referenceId:999})])assert.throws(()=>parseSession(bad));
const wrong=copy(s);wrong.memories[0].workspace.graph.nodes[1].data.Vb=111;assert.throws(()=>parseSession(JSON.stringify(wrong)),/does not belong/);
const overlays=overlaySeries([{id:1,label:'Result 1',data,reference:true},{id:2,label:'Result 2',data:{...data,frequencies_hz:[20,200,2000]},reference:false}],'spl');
assert.equal(overlays[0].lineStyle.type,'dotted');assert.equal(overlays[1].data[0][0],20);assert.equal(overlaySeries([{id:1,label:'Result 1',data,reference:true}],'displacement').length,0);
for(const [topology,template] of [['closed_box',closedBoxTemplate],['bass_reflex',bassReflexTemplate],['transmission_line',transmissionLineTemplate]]) {
 const parameters=parametersFor(template.nodes,topology);assert(parameters.length>=8);assert.equal(new Set(parameters.map(p=>p.id)).size,parameters.length);
 for(const p of parameters.filter(p=>!p.key.startsWith('stuffing'))){const nodes=copy(template.nodes);nodes.find(n=>n.id===p.nodeId).data[p.key]=p.value===0?.2:p.value*1.1;assert.notEqual(JSON.stringify(buildModelDict(nodes,template.edges)),JSON.stringify(buildModelDict(template.nodes,template.edges)),`${p.id} must affect the model`);}
}
console.log('PASS: deep memories, stale rejection, recall, capacity/labels, session validation, parameter coverage and overlay frequency/reference styles.');

const withPad=structuredClone(s);withPad.workspace.tuning={x:'volume',y:'Re',sensitivity:{volume:{mode:'absolute',step:.25},Re:{mode:'relative',step:2}}};
assert.deepEqual(parseSession(JSON.stringify(withPad)).workspace.tuning,withPad.workspace.tuning);
withPad.workspace.tuning.sensitivity.volume.step=-1;assert.throws(()=>parseSession(JSON.stringify(withPad)));
const previous=overlaySeries([{id:0,label:'Before last drag',data,reference:false,previous:true}],'spl');
assert.equal(previous[0].lineStyle.type,'dashed');assert.equal(previous[0].lineStyle.color,'#9ca3af');
console.log('PASS: pad settings round-trip and validation; previous-gesture grey dashed overlay.');
