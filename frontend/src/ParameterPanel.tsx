import { useEffect, useState } from 'react';
import type { Parameter } from './parameters';
function ParameterInput({ parameter: p, disabled, onChange }: { parameter: Parameter; disabled?: boolean; onChange: (p: Parameter, value: number) => void }) {
  const [draft,setDraft] = useState(String(p.value));
  const [error,setError] = useState('');
  useEffect(() => { setDraft(String(p.value)); setError(''); }, [p.value]);
  const commit = () => {
    const value = Number(draft);
    if (!draft.trim() || !Number.isFinite(value) || (p.allowZero ? value < 0 : value <= 0)) {
      setError(p.allowZero ? 'Enter zero or a positive number.' : 'Enter a positive number.'); return;
    }
    setError(''); if (value !== p.value) onChange(p,value);
  };
  return <div>
    <label>{p.label} {p.unit}
      <input type="number" step="any" value={draft} disabled={disabled} aria-invalid={!!error}
        onChange={e=>setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();} if(e.key==='Escape'){setDraft(String(p.value));setError('');}}} />
    </label>
    {error && <small role="alert">{error}</small>}
  </div>;
}
export default function ParameterPanel({ parameters, pins, results = false, disabled = false, onPin, onChange }: {
  parameters: Parameter[]; pins: string[]; results?: boolean; disabled?: boolean;
  onPin: (id: string) => void; onChange: (p: Parameter,value: number) => void;
}) {
  const [group,setGroup]=useState<string>('');
  const groups=[...new Set(parameters.map(p=>p.group))];
  const visible=parameters.filter(p=>(!group || p.group===group) && (!results || pins.includes(p.id)));
  const groupButtons=<div className="parameter-groups"><button aria-pressed={!group} onClick={()=>setGroup('')}>All</button>{groups.map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(group===g?'':g)}>{g}</button>)}</div>;
  return <div className={results ? 'tuning-parameters' : 'model-parameters'}>
    {groupButtons}
    {visible.length === 0 && <p>{results ? 'Select “Show in Results” beside parameters in Model to tune them here.' : 'No editable parameters for this topology.'}</p>}
    {visible.map(p=><div className="parameter-row" key={p.id}>
      <small>{p.group}</small>
      <ParameterInput parameter={p} disabled={disabled} onChange={onChange} />
      <label className="pin-label"><input type="checkbox" checked={pins.includes(p.id)} disabled={disabled} onChange={()=>onPin(p.id)} aria-label={`Show ${p.group} ${p.label} in Results`} />Show in Results</label>
    </div>)}
  </div>;
}
