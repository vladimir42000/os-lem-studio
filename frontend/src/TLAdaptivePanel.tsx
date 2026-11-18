import {useEffect,useRef,useState} from 'react';
import {clone,type Workspace} from './tuningState';
import {optRequest,type Candidate,type Objective} from './optimisation';
import {tlDefaults,tlWorkspace,evaluateTL,refineTL,keepDiverse,type TLBounds,type TLConfig} from './tlOptimisation';
import {boxSummary} from './parameters';

type Props={workspace:Workspace;identity:string;disabled:boolean;onPreview:(c:Candidate|null)=>void;onApply:(c:Candidate)=>void};
export default function TLAdaptivePanel({workspace,identity,disabled,onPreview,onApply}:Props) {
 const defaults=()=>tlDefaults(workspace);
 const [bounds,setBounds]=useState<TLBounds[]>(defaults().bounds),[config,setConfig]=useState<TLConfig>(defaults().config);
 const [objective,setObjective]=useState<Objective>({low_hz:30,high_hz:300,target_db:85,max_volume_l:100,max_excursion_mm:5});
 const [globalBudget,setGlobalBudget]=useState(128),[localBudget,setLocalBudget]=useState(64),[seed,setSeed]=useState(17);
 const [running,setRunning]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [best,setBest]=useState<Candidate[]>([]),[baseline,setBaseline]=useState<Candidate|null>(null),[verifiedBase,setVerifiedBase]=useState<Candidate|null>(null);
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),job=useRef<string|null>(null);
 const preview=useRef(onPreview);preview.current=onPreview;
 const cancelJob=()=>{const id=job.current;job.current=null;if(id)void optRequest('adaptive/stop',{job_id:id},new AbortController().signal).catch(()=>{});};
 useEffect(()=>{epoch.current++;controller.current?.abort();cancelJob();setRunning(false);setBest([]);setBaseline(null);setVerifiedBase(null);setStatus('');setError('');
  const d=tlDefaults(workspace);setBounds(d.bounds);setConfig(d.config);preview.current(null);
  return()=>{epoch.current++;controller.current?.abort();cancelJob();preview.current(null);};
 },[identity]);
 const stop=()=>{epoch.current++;controller.current?.abort();controller.current=null;cancelJob();setRunning(false);setStatus('Stopped. Unverified candidates are preview-only.');};
 const start=async()=>{
  if(controller.current)return;const id=++epoch.current,abort=new AbortController();controller.current=abort;
  const base=clone(workspace),cfg=clone(config),target=clone(objective);
  const active=bounds.filter(b=>cfg.stuffing||!['zone_start','zone_extent','density'].includes(b.id)).map(b=>({...b,max:b.id==='volume_l'?Math.min(b.max,target.max_volume_l):b.max}));
  setRunning(true);setError('');setBest([]);setBaseline(null);setVerifiedBase(null);onPreview(null);
  let archive:Candidate[]=[],failed=0,infeasible=0,firstFailure='';
  try {
   for(const b of active)if(!Number.isFinite(b.min)||!Number.isFinite(b.max)||b.min>=b.max)throw new Error(`Invalid bounds: ${b.label}.`);
   for(const key of ['length_cm','volume_l','taper'])if(active.find(b=>b.id===key)!.min<=0)throw new Error('Length, volume and taper bounds must be positive.');
   if(cfg.stuffing&&active.some(b=>(b.id==='density'&&(b.min<0||b.max>15))||(b.id==='zone_start'&&(b.min<0||b.max>=1))||(b.id==='zone_extent'&&(b.min<=0||b.max>1))))throw new Error('Stuffing bounds require density 0–15, start 0–<1, and extent >0–1.');
   if(active.find(b=>b.id==='driver_fraction')!.min<0||active.find(b=>b.id==='driver_fraction')!.max>=1)throw new Error('Driver fraction must remain between 0 and less than 1.');
   if(cfg.stuffing&&(Number(base.graph.nodes.find(n=>n.data.type==='waveguide_1d')!.data.stuffing2Density??0)>0||Number(base.graph.nodes.find(n=>n.data.type==='waveguide_1d')!.data.stuffing3Density??0)>0))throw new Error('Disable stuffing zones 2 and 3 before searching zone 1.');
   if(!Object.entries(cfg).filter(([k])=>k!=='stuffing').every(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>0)||cfg.s0min>=cfg.s0max||cfg.smmin>=cfg.smmax)throw new Error('Section limits must be finite, positive and increasing.');
   setStatus('Evaluating baseline…');const initial=await evaluateTL(base,target,0,abort.signal);if(epoch.current!==id)return;setBaseline(initial);
   const created=await optRequest('adaptive/start',{bounds:active,global_budget:globalBudget,local_budget:localBudget,seed},abort.signal);
   if(epoch.current!==id){void optRequest('adaptive/stop',{job_id:created.job_id},new AbortController().signal);return;}
   job.current=created.job_id;let reply:unknown=null;
   while(epoch.current===id) {
    const next=await optRequest('adaptive/step',{job_id:created.job_id,reply},abort.signal);if(epoch.current!==id)return;
    if(next.done){if(next.error)throw new Error(next.error);if(next.cancelled)throw new Error('Search expired before completion.');break;}
    if(!next.values){reply=null;continue;}
    let score=1e12,feasible=false;
    try {
     const w=tlWorkspace(base,next.values,cfg);
     if(Number(next.values.volume_l)>target.max_volume_l)throw new Error('Volume limit exceeded.');
     const c=await evaluateTL(w,target,next.token,abort.signal);if(epoch.current!==id)return;c.values=next.values;
     score=c.evaluation.score;feasible=c.evaluation.feasible;
     if(feasible){archive.push(c);archive=keepDiverse(archive,active,12);const top=keepDiverse(archive,active);setBest(top);onPreview(top[0]);}else infeasible++;
    }catch(e){if(epoch.current!==id)return;failed++;if(!firstFailure)firstFailure=e instanceof Error?e.message:'Candidate failed';}
    reply={token:next.token,score,feasible};setStatus(`${next.stage}: ${next.count} evaluations · ${infeasible} outside response limits · ${failed} rejected/failed`);
   }
   cancelJob();setStatus('Verifying baseline at 128 / 256 segments and denser frequency grids…');
   const verified=await refineTL(initial,target,abort.signal);if(epoch.current!==id)return;setVerifiedBase(verified);
   const final:Candidate[]=[];
   for(const c of keepDiverse(archive,active)) {
    setStatus(`Verifying candidate ${c.id}…`);
    const checked=await refineTL(c,target,abort.signal);if(epoch.current!==id)return;checked.values=c.values;final.push(checked);setBest([...final]);
   }
   final.sort((a,b)=>a.evaluation.score-b.evaluation.score);setBest(final);if(final.length)onPreview(final[0]);
   const usable=final.filter(c=>c.verification?.passed&&c.evaluation.feasible);
   if(!usable.length)setError('No candidate passed both fine-grid constraints and convergence. Preview only; adjust bounds or increase the search budget.');
   else if(!verified.verification?.passed)setError('Baseline did not converge: no reliable improvement claim against it.');
   else if(verified.evaluation.feasible&&usable[0].evaluation.score>=verified.evaluation.score)setError('No verified improvement over the baseline.');
   if(firstFailure)setError(old=>`${old} First rejected/failed candidate: ${firstFailure}`.trim());
   setStatus('Complete: global DE → local Powell → numerical verification.');
  }catch(e){if(epoch.current===id)setError(e instanceof Error?e.message:'Adaptive search failed.');}
  finally{if(epoch.current===id){cancelJob();controller.current=null;setRunning(false);}}
 };
 const displayed=bounds.filter(b=>config.stuffing||!['zone_start','zone_extent','density'].includes(b.id));
 return <details className="optimisation-panel" open><summary>TL: global + local optimisation</summary>
  <p>DE explores geometry jointly; Powell refines up to three distinct regions. Driver, amplifier and material calibration stay fixed.</p>
  <fieldset disabled={running||disabled}><legend>Search setup</legend>
   <label><input type="checkbox" checked={config.stuffing} onChange={e=>setConfig(c=>({...c,stuffing:e.target.checked}))}/>Experimental: optimise stuffing zone 1</label>
   {config.stuffing&&<p>Illustrative material calibration is not validation. Zones 2 and 3 must be disabled. Density is limited to 0–15 kg/m³ as an exploration preset.</p>}
   {displayed.map(b=><div key={b.id} className="opt-bound"><label>{b.label}</label><div>
    <input aria-label={`${b.label} minimum`} type="number" step="any" value={b.min} onChange={e=>setBounds(old=>old.map(x=>x.id===b.id?{...x,min:e.target.valueAsNumber}:x))}/> to <input aria-label={`${b.label} maximum`} type="number" step="any" value={b.max} onChange={e=>setBounds(old=>old.map(x=>x.id===b.id?{...x,max:e.target.valueAsNumber}:x))}/></div></div>)}
   {([['s0min','Minimum closed-end area / Sd'],['s0max','Maximum closed-end area / Sd'],['smmin','Minimum mouth area / Sd'],['smmax','Maximum mouth area / Sd']] as const).map(([key,label])=><label className="opt-field" key={key}>{label}<input aria-label={label} type="number" step="any" value={config[key]} onChange={e=>setConfig(c=>({...c,[key]:e.target.valueAsNumber}))}/></label>)}
   {([['low_hz','Band start (Hz)'],['high_hz','Band end (Hz)'],['target_db','Flat target (dB SPL)'],['max_volume_l','Maximum air volume (L)'],['max_excursion_mm','Maximum excursion (mm)']] as const).map(([key,label])=><label className="opt-field" key={key}>{label}<input aria-label={label} type="number" value={objective[key]} onChange={e=>setObjective(o=>({...o,[key]:e.target.valueAsNumber}))}/></label>)}
   <label className="opt-field">Global evaluation budget<input aria-label="Global evaluation budget" type="number" value={globalBudget} onChange={e=>setGlobalBudget(e.target.valueAsNumber)}/></label>
   <label className="opt-field">Local budget per region<input aria-label="Local evaluation budget" type="number" value={localBudget} onChange={e=>setLocalBudget(e.target.valueAsNumber)}/></label>
   <label className="opt-field">Random seed<input aria-label="Search random seed" type="number" value={seed} onChange={e=>setSeed(e.target.valueAsNumber)}/></label>
   <button onClick={()=>void start()}>Start TL optimisation</button>
  </fieldset>
  {running&&<button onClick={stop}>Stop TL optimisation</button>}<p role="status">{status}</p>{error&&<p role="alert">{error}</p>}
  {baseline&&<p>Baseline RMS: {(verifiedBase??baseline).evaluation.score.toFixed(3)} dB. {verifiedBase?(verifiedBase.verification?.passed?'Numerically converged.':'Convergence failed.'):'Coarse evaluation.'} {(verifiedBase??baseline).evaluation.feasible?'Within limits.':'Outside limits.'}</p>}
  {best.map(c=><div className="opt-candidate" key={c.id}><strong>Candidate {c.id}</strong><p>RMS {c.evaluation.score.toFixed(3)} dB · ripple {c.evaluation.ripple_db.toFixed(2)} dB · excursion {c.evaluation.peak_excursion_mm.toFixed(2)} mm · peak delay {c.evaluation.peak_group_delay_ms?.toFixed(2)??'—'} ms</p>
   <p>{boxSummary(c.workspace.graph.nodes,'transmission_line')}</p><p>{displayed.map(b=>`${b.label}: ${c.values[b.id]?.toFixed(3)}`).join('; ')}</p>
   <p>{c.verification?`128→256 segments: ΔSPL max ${c.verification.max_spl_delta_db.toFixed(3)} dB; ${c.verification.passed?'converged':'not converged'}`:'Preview only: numerical verification pending.'} {!c.evaluation.feasible&&'Outside fine-grid limits.'}</p>
   <button disabled={disabled} onClick={()=>onPreview(c)}>Preview TL candidate {c.id}</button>
   <button disabled={running||disabled||!c.verification?.passed||!c.evaluation.feasible} onClick={()=>onApply(c)}>Apply TL candidate {c.id}</button>
  </div>)}
  <button onClick={()=>onPreview(null)}>Hide TL preview</button>
  <p>Maximum {globalBudget+3*localBudget} search evaluations plus baseline and verification. Stop retains previews; only verified feasible candidates can be applied. Apply supports Undo and Memorise. No guarantee of global optimum or external acoustic accuracy. Excursion is checked over 10–1000 Hz; group delay is reported, not minimised.</p>
 </details>;
}
