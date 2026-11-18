// Component interaction test with deterministic HTTP fixtures; not visual/acoustic QA.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {JSDOM}=await import(process.env.JSDOM_MODULE_PATH||'jsdom');
const dom=new JSDOM('<div id="root"></div>');
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{build}=require('esbuild');
const dir=fileURLToPath(new URL('../frontend/node_modules/.cache',import.meta.url)),output=dir+'/tl-adaptive-ui.cjs';mkdirSync(dir,{recursive:true});
await build({stdin:{contents:"export {default as Panel} from './TLAdaptivePanel'; export {transmissionLineTemplate as template} from './topologyTemplates';",resolveDir:fileURLToPath(new URL('../frontend/src',import.meta.url)),loader:'tsx'},outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom']});
const {Panel,template}=require(output),base={topology:'transmission_line',graph:structuredClone(template),seed:structuredClone(template),pins:[],override:null};
let steps=0,preview=null,applied=null,stops=0,hold=false,pending=[],failConvergence=false;
globalThis.fetch=async(url,options)=>{
 const req=JSON.parse(options.body),path=String(url).split('/').at(-1);
 if(path==='start'){steps=0;return Response.json({job_id:'fixture'});}
 if(path==='stop'){stops++;return Response.json({stopped:true});}
 if(path==='step')return Response.json(++steps<=2?{done:false,token:steps,count:steps,stage:steps===1?'global':'local 1/1',values:{length_cm:160,volume_l:30+steps,taper:1,driver_fraction:.2}}:{done:true});
 assert.equal(path,'evaluate');
 if(hold)await new Promise(r=>pending.push(r));
 const value=failConvergence&&req.frequencies_hz.length===2397?90:85;
 return Response.json({status:'success',data:{frequencies_hz:req.frequencies_hz,series:{spl_sum:req.frequencies_hz.map(()=>value)},properties:{cone_excursion_mm:req.frequencies_hz.map(()=>1)}},evaluation:{score:1,feasible:true,violations:[],volume_l:req.volume_l,peak_excursion_mm:1,ripple_db:0,peak_group_delay_ms:2}});
};
const root=createRoot(document.getElementById('root'));
const render=async identity=>act(async()=>root.render(React.createElement(Panel,{workspace:base,identity,disabled:false,onPreview:c=>preview=c,onApply:c=>applied=c})));
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const click=async b=>{assert(b);await act(async()=>b.click());};
const wait=async()=>act(async()=>{await new Promise(r=>setTimeout(r,30));});
try {
 await render('initial');await click(button('Start TL optimisation'));await wait();
 const apply=button('Apply TL candidate 1');assert(apply&&!apply.disabled);assert(preview.verification.passed);
 await click(apply);assert.equal(applied.result.data.frequencies_hz.length,2397);assert(stops>0);
 await render('failed-convergence');failConvergence=true;await click(button('Start TL optimisation'));await wait();
 assert(button('Apply TL candidate 1').disabled);assert.match(document.body.textContent,/No candidate passed/);
 await render('stop');hold=true;await click(button('Start TL optimisation'));await wait();assert.equal(pending.length,1);
 await click(button('Stop TL optimisation'));await act(async()=>pending.shift()());await wait();assert.equal(preview,null);assert(!button('Apply TL candidate 1'));
 await click(button('Start TL optimisation'));await wait();await render('changed-model');await act(async()=>pending.shift()());await wait();
 assert.equal(preview,null);assert(!button('Apply TL candidate 1'));
 console.log('PASS: TL global/local progression, verified Apply, failed convergence blocks Apply, Stop and changed-model stale-response rejection.');
}finally{await act(async()=>root.unmount());rmSync(output,{force:true});}
