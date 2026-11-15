import { useRef } from 'react';
import { parseSession, removeMemory, type TuningSession } from './tuningState';
export default function MemoryPanel({ session, canMemorise, onMemorise, onRecall, onChange, onLoad, onError }: {
  session: TuningSession; canMemorise: boolean; onMemorise: () => void; onRecall: (id:number) => void;
  onChange: (s:TuningSession)=>void; onLoad: (s:TuningSession)=>void; onError:(message:string)=>void;
}) {
  const file=useRef<HTMLInputElement>(null);
  const save=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='os-lem-tuning-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="memory-panel" aria-label="Memorised results">
    <div className="tuning-toolbar">
      <button disabled={!canMemorise || session.memories.length>=9} onClick={onMemorise}>Memorise</button>
      <span>{session.memories.length}/9 memories</span>
      <button onClick={save}>Save tuning session</button>
      <button onClick={()=>file.current?.click()}>Load tuning session</button>
      <input hidden ref={file} type="file" accept=".json,application/json" aria-label="Tuning session file" onChange={async e=>{
        const selected=e.target.files?.[0];e.target.value='';if(!selected)return;
        try {if(selected.size>10_000_000)throw new Error('Session exceeds the 10 MB limit.');onLoad(parseSession(await selected.text()));}
        catch(error){onError(error instanceof Error ? error.message : 'Cannot load session.');}
      }} />
    </div>
    <p>Recall restores the complete model and selected parameters. Compare adds a coloured curve; Reference keeps a dotted curve visible even when Compare is off.</p>
    {session.memories.length>0 && <div className="memory-list">{session.memories.map(m=><div className="memory-slot" key={m.id}>
      <button onClick={()=>onRecall(m.id)} title={`Recall ${m.label} — ${m.workspace.topology.replace(/_/g,' ')}`}>{m.label}</button>
      <small>{m.workspace.topology.replace(/_/g,' ')}</small>
      <label><input type="checkbox" checked={m.compare} onChange={()=>onChange({...session,memories:session.memories.map(x=>x.id===m.id?{...x,compare:!x.compare}:x)})} />Compare {m.label}</label>
      <label><input type="radio" name="reference-memory" checked={session.referenceId===m.id} onChange={()=>onChange({...session,referenceId:m.id})} />Reference {m.label}</label>
      <button aria-label={`Delete ${m.label}`} onClick={()=>onChange(removeMemory(session,m.id))}>Delete</button>
    </div>)}</div>}
    {session.referenceId!==null && <button onClick={()=>onChange({...session,referenceId:null})}>Clear reference</button>}
    {!canMemorise && <small>Run a valid current model before memorising. Uncalculated edits cannot be saved as results.</small>}
  </section>;
}
