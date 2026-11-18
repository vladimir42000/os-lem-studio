import { useEffect, useRef, useState } from 'react';
import { clone, type Workspace } from './tuningState';
import { geometryParameters,volumeLiters,optRequest,evaluateCandidate,type Bound,type Candidate,type Objective } from './optimisation';

type Props={workspace:Workspace;identity:string;disabled:boolean;onPreview:(c:Candidate|null)=>void;onApply:(c:Candidate)=>void};
export default function OptimisationPanel({workspace,identity,disabled,onPreview,onApply}:Props) {
  const parameters=geometryParameters(workspace);
  const [bounds,setBounds]=useState<Bound[]>([]);
  const [objective,setObjective]=useState<Objective>({low_hz:30,high_hz:200,target_db:85,max_volume_l:100,max_excursion_mm:5});
  const [budget,setBudget]=useState(48);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const [baseline,setBaseline]=useState<Candidate|null>(null);
  const [best,setBest]=useState<Candidate[]>([]);
  const [previewId,setPreviewId]=useState<number|null>(null);
  const controller=useRef<AbortController|null>(null);
  const epoch=useRef(0);
  const previewRef=useRef(onPreview);previewRef.current=onPreview;
  useEffect(()=>{
    epoch.current++;controller.current?.abort();controller.current=null;
    setRunning(false);setBest([]);setBaseline(null);setPreviewId(null);setProgress('');setError('');previewRef.current(null);
    setBounds(geometryParameters(workspace).map(p=>({id:p.id,value:p.value,min:p.value===0?0:p.value*.7,max:p.value===0?40:p.value*1.3})));
    return()=>{epoch.current++;controller.current?.abort();previewRef.current(null);};
  },[identity]);
  if(!parameters.length || workspace.override)return <details className="optimisation-panel"><summary>Optimise geometry</summary><p>Select an editable Bass Reflex or Transmission Line template to optimise.</p></details>;
  const updateBound=(id:string,key:'min'|'max',value:number)=>setBounds(old=>old.map(b=>b.id===id?{...b,[key]:value}:b));
  const stop=()=>{epoch.current++;controller.current?.abort();controller.current=null;setRunning(false);setProgress(p=>p+' — stopped; completed candidates retained.');};
  const start=async()=>{
    if(controller.current)return;
    const run=++epoch.current;const abort=new AbortController();controller.current=abort;
    const base=clone(workspace);const limits=clone(objective);
    setRunning(true);setError('');setBest([]);setBaseline(null);setPreviewId(null);onPreview(null);setProgress('Evaluating baseline…');
    let failed=0;let infeasible=0;let firstFailure='';const ranked:Candidate[]=[];
    try {
      const plan=await optRequest('plan',{bounds,budget},abort.signal);
      if(epoch.current!==run)return;
      const b=await evaluateCandidate(base,{},limits,0,abort.signal);
      if(epoch.current!==run)return;
      setBaseline(b);
      if(b.evaluation.feasible)ranked.push(b);
      for(let i=0;i<plan.candidates.length;i++) {
        if(epoch.current!==run)return;
        try {
          const c=await evaluateCandidate(base,plan.candidates[i],limits,i+1,abort.signal);
          if(epoch.current!==run)return;
          if(c.evaluation.feasible){ranked.push(c);ranked.sort((a,b)=>a.evaluation.score-b.evaluation.score);ranked.splice(3);setBest([...ranked]);setPreviewId(ranked[0].id);onPreview(ranked[0]);}
          else infeasible++;
        } catch(e) {if(epoch.current!==run)return;failed++;if(!firstFailure)firstFailure=e instanceof Error?e.message:'Invalid candidate';}
        setProgress(`${i+1}/${plan.candidates.length} evaluated · ${infeasible} outside limits · ${failed} failed`);
      }
      if(!ranked.some(c=>c.id!==0))setError('No feasible alternative found. Keep the baseline or revise bounds and limits.');
      else if(b.evaluation.feasible && ranked[0].evaluation.score>=b.evaluation.score)setError('No sampled improvement over the baseline. Keep the baseline or revise the search.');
      if(firstFailure)setError(old=>`${old} First failed candidate: ${firstFailure}`.trim());
      if(ranked.length){setBest([...ranked]);setPreviewId(ranked[0].id);onPreview(ranked[0]);}
      setProgress(p=>p+' — complete');
    }catch(e){if(epoch.current===run)setError(e instanceof Error?e.message:'Optimisation failed.');}
    finally{if(epoch.current===run){setRunning(false);controller.current=null;}}
  };
  return <details className="optimisation-panel" open><summary>Optimise geometry</summary>
    <p>Bounded search at fixed driver, amplifier and stuffing settings. Preview does not change your model.</p>
    <fieldset disabled={running || disabled}><legend>Variables and bounds</legend>
      {parameters.map(p=>{const b=bounds.find(b=>b.id===p.id);return <div className="opt-bound" key={p.id}>
        <label><input type="checkbox" checked={!!b} onChange={e=>setBounds(old=>e.target.checked?[...old,{id:p.id,value:p.value,min:p.value*.7,max:p.value===0?40:p.value*1.3}]:old.filter(b=>b.id!==p.id))}/>{p.label} ({p.unit})</label>
        {b&&<div><input type="number" aria-label={`${p.label} minimum`} value={b.min} onChange={e=>updateBound(p.id,'min',e.target.valueAsNumber)}/><span> to </span><input type="number" aria-label={`${p.label} maximum`} value={b.max} onChange={e=>updateBound(p.id,'max',e.target.valueAsNumber)}/></div>}
      </div>;})}
      {([['low_hz','Band start (Hz)'],['high_hz','Band end (Hz)'],['target_db','Flat target (dB SPL)'],['max_volume_l','Maximum air volume (L)'],['max_excursion_mm','Maximum excursion (mm)']] as const).map(([key,label])=><label className="opt-field" key={key}>{label}<input aria-label={label} type="number" value={objective[key]} onChange={e=>setObjective(old=>({...old,[key]:e.target.valueAsNumber}))}/></label>)}
      <label className="opt-field">Search evaluations (4–256)<input aria-label="Search evaluations" type="number" min={4} max={256} value={budget} onChange={e=>setBudget(e.target.valueAsNumber)}/></label>
      <p>Current air volume: {volumeLiters(workspace).toFixed(2)} L. BR includes port air. Walls and driver displacement excluded. Excursion limit covers 10–1000 Hz at the current voltage.</p>
      <button onClick={()=>void start()}>Start optimisation</button>
    </fieldset>
    {running&&<button onClick={stop}>Stop optimisation</button>}
    <p role="status">{progress}</p>{error&&<p role="alert">{error}</p>}
    {baseline&&<p>Baseline: RMS error {baseline.evaluation.score.toFixed(2)} dB — {baseline.evaluation.feasible?'within limits':`outside ${baseline.evaluation.violations.join(', ')} limits`}</p>}
    {best.map(c=><div className="opt-candidate" key={c.id}>
      <strong>{c.id===0?'Baseline':`Candidate ${c.id}`}</strong>: RMS error {c.evaluation.score.toFixed(2)} dB · ripple {c.evaluation.ripple_db.toFixed(2)} dB · {c.evaluation.volume_l.toFixed(2)} L · excursion {c.evaluation.peak_excursion_mm.toFixed(2)} mm · peak delay {c.evaluation.peak_group_delay_ms?.toFixed(2)??'unavailable'} ms
      <p>{parameters.map(p=>`${p.label}: ${(c.values[p.id]??p.value).toFixed(2)} ${p.unit}`).join('; ')}</p>
      <button disabled={disabled} aria-pressed={previewId===c.id} onClick={()=>{setPreviewId(c.id);onPreview(c);}}>Preview {c.id===0?'baseline':c.id}</button>
      <button disabled={running||disabled||c.id===0} onClick={()=>onApply(c)}>Apply candidate {c.id}</button>
    </div>)}
    {previewId!==null&&<button onClick={()=>{setPreviewId(null);onPreview(null);}}>Hide candidate preview</button>}
    <p>Lower RMS error is better; candidates are the best sampled feasible models, not guaranteed optima. Group delay is reported, not minimised. Apply supports Undo; then use Memorise to keep a candidate. Search history is temporary.</p>
  </details>;
}
