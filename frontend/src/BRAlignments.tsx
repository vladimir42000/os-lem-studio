import {useEffect,useRef,useState} from 'react';
import {parametersFor} from './parameters';
import {clone,type Workspace} from './tuningState';
import {candidateWorkspace,optRequest,type Candidate} from './optimisation';
import {buildModelDict} from './translator';
import {runSimulationThin} from './thinRunner';

type Alignment={name:string;available:boolean;applicable:boolean;reason:string;volume_l?:number;fb_hz?:number;port_length_cm?:number};
export default function BRAlignments({workspace,identity,disabled,onPreview,onApply}:{workspace:Workspace;identity:string;disabled:boolean;onPreview:(c:Candidate|null)=>void;onApply:(c:Candidate)=>void}) {
 const [rows,setRows]=useState<Alignment[]>([]),[note,setNote]=useState(''),[error,setError]=useState('');
 const [volume,setVolume]=useState(200),[length,setLength]=useState(150),[busy,setBusy]=useState(false);
 const [chosen,setChosen]=useState<{row:Alignment;candidate:Candidate}|null>(null);
 const epoch=useRef(0);const preview=useRef(onPreview);preview.current=onPreview;
 useEffect(()=>{const id=++epoch.current;const abort=new AbortController();setChosen(null);setError('');setBusy(false);setRows([]);preview.current(null);
  if(workspace.topology!=='bass_reflex'||workspace.override)return;
  const ps=parametersFor(workspace.graph.nodes,workspace.topology);const ts=Object.fromEntries(ps.filter(p=>['Loudspeaker','Amplifier'].includes(p.group)).map(p=>[p.key,p.value]));
  optRequest('alignments',{ts,port_area_cm2:ps.find(p=>p.key==='areaCm2')!.value,max_volume_l:volume,max_port_length_cm:length},abort.signal)
  .then(r=>{if(epoch.current===id){setRows(r.alignments);setNote(`Effective Qts: ${r.qts_effective.toFixed(4)}. ${r.assumption}`);}})
  .catch(e=>{if(!abort.signal.aborted&&epoch.current===id)setError(e.message);});
  return()=>{epoch.current++;abort.abort();preview.current(null);};
 },[identity,volume,length]);
 if(workspace.topology!=='bass_reflex'||workspace.override)return null;
 const choose=async(row:Alignment)=>{
  const id=++epoch.current;setBusy(true);setError('');setChosen(null);onPreview(null);
  try{
   const ps=parametersFor(workspace.graph.nodes,workspace.topology);const values:Record<string,number>={};
   for(const [key,value] of [['Vb',row.volume_l],['lengthCm',row.port_length_cm]] as const)values[ps.find(p=>p.key===key)!.id]=value!;
   const w=candidateWorkspace(clone(workspace),values);const model=buildModelDict(w.graph.nodes as any,w.graph.edges);
   const data=await runSimulationThin({canonicalModel:model,frequenciesHz:Array.from({length:600},(_,i)=>10*Math.pow(100,i/599))});
   if(epoch.current!==id)return;
   const c:Candidate={id:100+rows.indexOf(row),workspace:w,result:{model,data,source:'graph-derived'},values,
    evaluation:{score:0,feasible:true,violations:[],volume_l:row.volume_l!,peak_excursion_mm:Math.max(...data.properties.cone_excursion_mm as number[]),ripple_db:0,peak_group_delay_ms:null}};
   setChosen({row,candidate:c});onPreview(c);
  }catch(e){if(epoch.current===id)setError(e instanceof Error?e.message:'Alignment preview failed');}
  finally{if(epoch.current===id)setBusy(false);}
 };
 return <details className="optimisation-panel"><summary>Classical BR alignments</summary><p>{note}</p>
  <label className="opt-field">Maximum air volume (L)<input aria-label="Alignment maximum volume" type="number" value={volume} onChange={e=>setVolume(e.target.valueAsNumber)}/></label>
  <label className="opt-field">Maximum port length (cm)<input aria-label="Alignment maximum port length" type="number" value={length} onChange={e=>setLength(e.target.valueAsNumber)}/></label>
  {rows.map(r=><div key={r.name} className="alignment-row"><button disabled={disabled||busy||!r.available} onClick={()=>void choose(r)}>{r.name}</button>
   {r.available&&<span> {r.volume_l?.toFixed(1)} L · Fb {r.fb_hz?.toFixed(1)} Hz · port {r.port_length_cm?.toFixed(1)} cm</span>}
   {r.reason&&<p>{r.reason}</p>}</div>)}
  {busy&&<p role="status">Calculating alignment preview…</p>}{error&&<p role="alert">{error}</p>}
  {chosen&&<><p>Preview: {chosen.row.name}. Driver and port area unchanged. Check excursion and physical construction before use.</p>
   <button disabled={disabled||busy||!chosen.row.applicable} onClick={()=>onApply(chosen.candidate)}>Apply {chosen.row.name}</button>
   <button onClick={()=>{setChosen(null);onPreview(null);}}>Hide alignment preview</button></>}
  <p>Grey options have no solution in the named family or no positive port length. Practical limits block Apply but permit preview. Classical alignment targets are not an external validation of the kernel.</p>
 </details>;
}
