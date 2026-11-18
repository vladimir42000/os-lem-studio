// Real Studio compiler -> kernel -> OPT ask/tell, including fine-grid verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
async function load(name){const r=await build({entryPoints:[new URL(`../frontend/src/${name}.ts`,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);}
const {transmissionLineTemplate}=await load('topologyTemplates');
const {tlDefaults,tlWorkspace,evaluateTL,refineTL,convergence}=await load('tlOptimisation');
const {optRequest,volumeLiters}=await load('optimisation');
const {parseSession}=await load('tuningState');
const realFetch=globalThis.fetch;
globalThis.fetch=(url,opts)=>realFetch(String(url).replace('http://localhost:8000',process.env.STUDIO_TEST_BACKEND_URL),opts);
const base={topology:'transmission_line',graph:structuredClone(transmissionLineTemplate),seed:structuredClone(transmissionLineTemplate),pins:[],override:null};
const snapshot=JSON.stringify(base),signal=new AbortController().signal;
const objective={low_hz:30,high_hz:300,target_db:85,max_volume_l:100,max_excursion_mm:100};
const initial=await evaluateTL(base,objective,0,signal);
for(const stuffing of [false,true]) {
 const {bounds,config}=tlDefaults(base);config.stuffing=stuffing;
 const active=bounds.filter(b=>stuffing||!['zone_start','zone_extent','density'].includes(b.id));
 const {job_id}=await optRequest('adaptive/start',{bounds:active,global_budget:24,local_budget:16,seed:17},signal);
 let reply=null,best=null,count=0,stages=new Set();
 try {
  while(true){
   const next=await optRequest('adaptive/step',{job_id,reply},signal);
   if(next.done){assert(!next.error,next.error);assert(!next.cancelled);break;}
   if(!next.values){reply=null;continue;}
   count++;stages.add(next.stage);let c;
   try{const w=tlWorkspace(base,next.values,config);assert(Math.abs(volumeLiters(w)-next.values.volume_l)<1e-9);assert(volumeLiters(w)<=100);c=await evaluateTL(w,objective,next.token,signal);}catch(e){if(!String(e).includes('Section outside'))throw e;}
   if(c){assert.deepEqual(c.result.model.driver,initial.result.model.driver);if(c.evaluation.feasible&&(!best||c.evaluation.score<best.evaluation.score))best=c;}
   reply={token:next.token,score:c?.evaluation.score??1e12,feasible:c?.evaluation.feasible??false};
  }
  assert(count<=72);assert(best,'At least one feasible candidate');assert([...stages].some(s=>s.startsWith('local')));
  const fine=await refineTL(best,objective,signal);assert.equal(fine.result.data.frequencies_hz.length,2397);assert(Number.isFinite(fine.verification.max_spl_delta_db));
  assert.deepEqual(fine.result.model.driver,initial.result.model.driver);
  const session={version:1,workspace:fine.workspace,result:fine.result,memories:[],nextId:1,referenceId:null};
  assert.deepEqual(parseSession(JSON.stringify(session)).result,fine.result);
  const mismatch=structuredClone(fine);mismatch.result.data.series=Object.fromEntries(Object.entries(mismatch.result.data.series).map(([k,v])=>[k,v.map(x=>x+1)]));
  assert(!convergence(best,mismatch).ok);
  assert.equal(JSON.stringify(base),snapshot,'Search must not mutate the current workspace');
  console.log(`PASS TL ${stuffing?'experimental stuffing':'geometry'}: ${count} real evaluations, local refinement, RMS ${best.evaluation.score.toFixed(3)} dB; fine-grid delta ${fine.verification.max_spl_delta_db.toFixed(3)} dB, convergence ${fine.verification.passed}; fixed driver, volume cap, session round trip.`);
 }finally{await optRequest('adaptive/stop',{job_id},signal);}
}
