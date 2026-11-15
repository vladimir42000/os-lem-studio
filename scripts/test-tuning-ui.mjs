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
const output=fileURLToPath(new URL('../frontend/node_modules/.cache/oslem-tuning-test.cjs',import.meta.url));
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
 const input=[...results().querySelectorAll('input[type=number]')][0];assert(input);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
};
try {
 await render();await click(inputByName('Show Enclosure Volume in Results'));await click(button('Results'));await wait();
 assert.equal(calls.length,1);assert(!button('Memorise').disabled);
 await click(button('Memorise'));assert(button('Result 1'));
 await editVolume(60);await wait();assert.equal(calls.length,2);await click(button('Memorise'));assert(button('Result 2'));
 await click(labelInput('Reference Result 1'));await click(labelInput('Compare Result 1'));
 assert(globalThis.chartOption.series.some(s=>s.name==='Result 1 (reference)' && s.lineStyle.type==='dotted'));
 await click(labelInput('Compare Result 2'));assert(!globalThis.chartOption.series.some(s=>s.name==='Result 2'));
 await click(button('Result 1'));assert.equal(results().querySelector('input[type=number]').value,'50');
 assert.equal(globalThis.chartOption.series[0].data[0][1],50);
 // Reject an older request after a second edit; run only the latest queued model.
 hold=true;await editVolume(70);await wait();assert(pending.length===1);
 await editVolume(80);await act(async()=>{pending.shift()();});
 assert.notEqual(globalThis.chartOption.series[0].data[0][1],70);
 hold=false;await wait();assert.equal(globalThis.chartOption.series[0].data[0][1],80);
 // Stored session survives component destruction and reconstruction.
 const saved=localStorage.getItem('oslem.tuning-session.v1');assert(saved);
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render();await click(button('Results'));
 assert(button('Result 1') && button('Result 2'));assert(labelInput('Reference Result 1').checked);
 assert.equal(results().querySelector('input[type=number]').value,'80');
 await click(button('Result 2'));assert.equal(results().querySelector('input[type=number]').value,'60');
 assert.equal(globalThis.chartOption.series[0].data[0][1],60);
 console.log('PASS: Model pin -> Results edit/autocalculation, memory/recall, reference independent of compare, stale-response rejection, and refresh restoration.');
} finally {await act(async()=>root.unmount());rmSync(output,{force:true});dom.window.close();}
