// DOM interaction test; graph canvas and ECharts drawing are stubbed. No visual-layout claim.
// Set JSDOM_MODULE_PATH to a jsdom 26 installation's lib/api.js.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {JSDOM}=await import(process.env.JSDOM_MODULE_PATH || 'jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:5173'});
for(const name of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','FocusEvent','localStorage','File','FileReader'])globalThis[name]=dom.window[name];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.scrollTo=()=>{};
const React=require('react');const {act}=React;const {createRoot}=require('react-dom/client');
const {build}=require('esbuild');
const output=fileURLToPath(new URL('../frontend/node_modules/.cache/oslem-opt-ui-test.cjs',import.meta.url));
mkdirSync(fileURLToPath(new URL('../frontend/node_modules/.cache',import.meta.url)),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('../frontend/src/App.tsx',import.meta.url))],outfile:output,bundle:true,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom'],plugins:[{name:'dom-stubs',setup(b){
 b.onResolve({filter:/^reactflow$|^echarts-for-react$/},args=>({path:args.path,namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},args=>({loader:'js',contents:args.path==='reactflow' ? `import React from 'react';export default ({children})=>React.createElement('div',{},children);export const Controls=()=>null;export const Background=()=>null;export const addEdge=(e,a)=>[...a,e];export const applyEdgeChanges=(_,a)=>a;export const applyNodeChanges=(_,a)=>a;` : `import React from 'react';export default ({option})=>{globalThis.chartOption=option;return React.createElement('div',{'data-testid':'chart'})};`}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'text'}));
}}]});
const App=require(output).default;
let calls=[];let hold=false;let pending=[];
globalThis.fetch=async (_url,options)=>{
 const request=JSON.parse(options.body);calls.push(request);
 if(hold)await new Promise(resolve=>pending.push(resolve));
 const grid=request.frequencies_hz;
 const volume=Number.parseFloat(request.model_dict.elements.find(e=>e.type==='volume')?.value || '50');
 return Response.json({status:'success',data:{frequencies_hz:grid,series:{spl_front:grid.map(()=>volume)},properties:{zin_mag_ohm:grid.map(()=>volume)},warnings:[],observation_types:{spl_front:'spl'}}});
};
let root=createRoot(document.getElementById('root'));
const render=async()=>act(async()=>{root.render(React.createElement(App));});
const wait=async(ms=450)=>act(async()=>{await new Promise(r=>setTimeout(r,ms));});
const click=async element=>{assert(element,'Missing clickable element');await act(async()=>element.click());};
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const results=()=>document.querySelector('[aria-label="Simulation results"]');
const labelInput=(text,container=document)=>[...container.querySelectorAll('label')].find(l=>l.textContent===text)?.querySelector('input');
const inputByName=name=>document.querySelector(`input[aria-label="${name}"]`);
const editVolume=async value=>{
 const input=[...results().querySelectorAll('.parameter-row label')].find(l=>l.textContent==='Volume liters')?.querySelector('input');assert(input);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
};
// OPT endpoint stub returns physically distinct candidate curves; no acoustics claim.
let optHeld=false,optPending=[],optEvaluations=0;
globalThis.fetch=async (url,options)=>{
 const req=JSON.parse(options.body);
 if(String(url).endsWith('/alignments'))return Response.json({qts_effective:.3,assumption:'Test fixture',alignments:[{name:'SBB4',available:true,applicable:true,volume_l:40,fb_hz:40,port_length_cm:20,reason:''},{name:'C4',available:false,applicable:false,reason:'Outside family domain'}]});
 if(String(url).endsWith('/plan'))return Response.json({candidates:[.8,.9,1.1,1.2].map(f=>Object.fromEntries(req.bounds.map(b=>[b.id,b.value*f])))});
 const volume=Number.parseFloat(req.model_dict.elements.find(e=>e.type==='volume')?.value || '50');
 const data={frequencies_hz:req.frequencies_hz,series:{spl_sum:req.frequencies_hz.map(()=>volume)},properties:{cone_excursion_mm:req.frequencies_hz.map(()=>1)},warnings:[],observation_types:{spl_sum:'spl_sum'}};
 if(String(url).endsWith('/evaluate')){
  optEvaluations++;if(optHeld)await new Promise(resolve=>optPending.push(resolve));
  return Response.json({status:'success',data,evaluation:{score:volume,feasible:true,violations:[],volume_l:volume,peak_excursion_mm:1,ripple_db:0,peak_group_delay_ms:2}});
 }
 return Response.json({status:'success',data});
};
const chooseTemplate=async text=>click([...document.querySelectorAll('button')].find(b=>b.textContent.includes(text)));
try {
 await render();await chooseTemplate('Bass Reflex');await click(button('Results'));await wait();
 await click(button('Optimise'));
 const baselineCurve=structuredClone(globalThis.chartOption.series[0].data);
 await click(button('Start optimisation'));await wait(50);
 assert.equal(optEvaluations,5);assert(button('Apply candidate 1'));
 assert(globalThis.chartOption.series.some(s=>s.name==='OPT candidate 1'));
 assert.deepEqual(globalThis.chartOption.series[0].data,baselineCurve,'Preview must not replace current model');
 await click(button('Apply candidate 1'));await wait(50);
 assert.notDeepEqual(globalThis.chartOption.series[0].data,baselineCurve);
 assert(globalThis.chartOption.series.some(s=>s.lineStyle.type==='dashed'));
 assert(!button('Memorise').disabled);await click(button('Memorise'));assert(button('Result 1'));
 await click(button('Undo last adjustment'));await wait(50);
 assert.deepEqual(globalThis.chartOption.series[0].data,baselineCurve);
 // Stop during an in-flight response. Even a transport ignoring abort cannot publish it.
 optHeld=true;await click(button('Start optimisation'));await wait(30);assert(optPending.length===1);
 await click(button('Stop optimisation'));await act(async()=>optPending.shift()());await wait(30);
 assert(!button('Apply candidate 1'));assert(!globalThis.chartOption.series.some(s=>s.name.startsWith('OPT candidate')));
 // Editing model invalidates the entire search and rejects an old response.
 await click(button('Start optimisation'));await wait(30);assert(optPending.length===1);
 await editVolume(70);await act(async()=>optPending.shift()());optHeld=false;await wait();
 assert(!button('Apply candidate 1'));assert.equal(globalThis.chartOption.series[0].data[0][1],70);
 assert(button('C4').disabled);assert(!button('SBB4').disabled);
 await click(button('SBB4'));await wait(30);assert(button('Apply SBB4'));
 await click(button('Apply SBB4'));await wait(30);assert.equal(globalThis.chartOption.series[0].data[0][1],40);
 await click(button('Undo last adjustment'));await wait(30);assert.equal(globalThis.chartOption.series[0].data[0][1],70);
 console.log('PASS: BR disabled family, preview/apply/undo; OPT progress, candidate overlay without model mutation, Apply/Memorise/Undo, Stop and stale response rejection.');
} finally {await act(async()=>root.unmount());rmSync(output,{force:true});}
