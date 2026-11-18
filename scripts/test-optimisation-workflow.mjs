// Real HTTP backend + real Studio graph translator + real OPT scoring.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
async function load(name){const r=await build({entryPoints:[new URL(`../frontend/src/${name}.ts`,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);}
const {bassReflexTemplate,transmissionLineTemplate}=await load('topologyTemplates');
const {geometryParameters,volumeLiters,candidateWorkspace,optRequest,evaluateCandidate}=await load('optimisation');
const {parseSession}=await load('tuningState');
const realFetch=globalThis.fetch;
globalThis.fetch=(url,opts)=>realFetch(String(url).replace('http://localhost:8000',process.env.STUDIO_TEST_BACKEND_URL),opts);
for(const [topology,graph] of [['bass_reflex',bassReflexTemplate],['transmission_line',transmissionLineTemplate]]) {
 const workspace={topology,graph:structuredClone(graph),seed:structuredClone(graph),pins:[],override:null};
 const parameters=geometryParameters(workspace);
 const bounds=parameters.map(p=>({id:p.id,value:p.value,min:p.value*.7,max:p.value===0?40:p.value*1.3}));
 const objective={low_hz:30,high_hz:200,target_db:85,max_volume_l:300,max_excursion_mm:100};
 const signal=new AbortController().signal;
 const baseline=await evaluateCandidate(workspace,{},objective,0,signal);
 const ordinary=await realFetch(process.env.STUDIO_TEST_BACKEND_URL+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model_dict:baseline.result.model,frequencies_hz:baseline.result.data.frequencies_hz})}).then(r=>r.json());
 assert.deepEqual(baseline.result.data,ordinary.data);
 const plan=await optRequest('plan',{bounds,budget:8},signal);
 let best=baseline;
 for(let i=0;i<plan.candidates.length;i++) {
  const c=await evaluateCandidate(workspace,plan.candidates[i],objective,i+1,signal);
  assert.deepEqual(c.result.model.driver,baseline.result.model.driver);
  const originalLine=workspace.graph.nodes.find(n=>n.data.type==='waveguide_1d');
  if(originalLine) {
    const newLine=c.workspace.graph.nodes.find(n=>n.data.type==='waveguide_1d');
    for(const key of Object.keys(originalLine.data).filter(k=>k.startsWith('stuffing')||k==='lossNpPerM'))assert.deepEqual(newLine.data[key],originalLine.data[key]);
  }
  if(c.evaluation.feasible&&c.evaluation.score<best.evaluation.score)best=c;
 }
 assert(best.evaluation.score<=baseline.evaluation.score);
 const session={version:1,workspace:best.workspace,result:best.result,memories:[{id:1,label:'Result 1',workspace:best.workspace,result:best.result,compare:true}],nextId:2,referenceId:1};
 assert.deepEqual(parseSession(JSON.stringify(session)).memories[0].result,best.result);
 assert.throws(()=>candidateWorkspace(workspace,{'driver:Re':3}));
 assert(volumeLiters(workspace)>0);
 console.log(`${topology}: real 8-candidate search, RMS ${baseline.evaluation.score.toFixed(3)} → ${best.evaluation.score.toFixed(3)} dB; identical Studio output, fixed driver/stuffing, session round trip PASS`);
}

const legacy={topology:'transmission_line',graph:structuredClone(transmissionLineTemplate),seed:structuredClone(transmissionLineTemplate),pins:[],override:null};
const line=legacy.graph.nodes.find(n=>n.data.type==='waveguide_1d');delete line.data.mouthAreaCm2;
const inlet=geometryParameters(legacy).find(p=>p.key==='areaCm2');
const changed=candidateWorkspace(legacy,{[inlet.id]:inlet.value*2});
assert.equal(changed.graph.nodes.find(n=>n.id===line.id).data.mouthAreaCm2,inlet.value);
console.log('PASS: omitted legacy mouth area remains fixed when only the inlet is optimised.');
