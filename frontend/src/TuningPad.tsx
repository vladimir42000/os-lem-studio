import { useEffect, useRef, useState } from 'react';
import type { Parameter } from './parameters';
import { defaultSensitivity, dragValue, scaleSensitivity, type PadSettings } from './tuningGesture';
export default function TuningPad({parameters,settings,onSettings,disabled,onStart,onMove,onEnd,onCancel}: {
 parameters:Parameter[];settings:PadSettings;onSettings:(s:PadSettings)=>void;disabled:boolean;
 onStart:()=>void;onMove:(values:Record<string,number>)=>void;onEnd:()=>void;onCancel:()=>void;
}) {
 const [active,setActive]=useState(false);
 const gesture=useRef<null|{pointer:number;left:number;top:number;width:number;height:number;x:Parameter;y:Parameter;settings:PadSettings}>(null);
 const x=parameters.find(p=>p.id===settings.x),y=parameters.find(p=>p.id===settings.y);
 const sensitivity=(p:Parameter)=>p.value===0 && settings.sensitivity[p.id]?.mode==='relative' ? defaultSensitivity(0) : settings.sensitivity[p.id]??defaultSensitivity(p.value);
 const canStart=!disabled && !!x && !!y && x.id!==y.id && !(settings.locked?.x && settings.locked?.y);
 const cancel=()=>{if(!gesture.current)return;gesture.current=null;setActive(false);onCancel();};
 const cancelRef=useRef(cancel);cancelRef.current=cancel;
 useEffect(()=>{const blur=()=>cancelRef.current();window.addEventListener('blur',blur);return()=>window.removeEventListener('blur',blur);},[]);
 const controls=(axis:'x'|'y',p:Parameter|undefined)=><div className="pad-axis">
  <label>{axis==='x'?'Horizontal →':'Vertical ↑'}<select disabled={active} value={p?.id??''} onChange={e=>onSettings({...settings,[axis]:e.target.value})}>
   <option value="">Select parameter</option>{parameters.map(item=><option key={item.id} value={item.id}>{item.group}: {item.label}</option>)}
  </select></label>
  {p && <><strong>{p.value.toPrecision(6)} {p.unit}</strong>
   <div className="axis-actions">
    <button disabled={active} aria-pressed={!!settings.locked?.[axis]} onClick={()=>onSettings({...settings,locked:{...settings.locked,[axis]:!settings.locked?.[axis]}})}>{settings.locked?.[axis]?'Unlock':'Lock'} {axis.toUpperCase()}</button>
    <button disabled={active} aria-label={`${axis.toUpperCase()} sensitivity divided by 2`} onClick={()=>onSettings({...settings,sensitivity:{...settings.sensitivity,[p.id]:scaleSensitivity(sensitivity(p),.5)}})}>÷2</button>
    <button disabled={active} aria-label={`${axis.toUpperCase()} sensitivity multiplied by 2`} onClick={()=>onSettings({...settings,sensitivity:{...settings.sensitivity,[p.id]:scaleSensitivity(sensitivity(p),2)}})}>×2</button>
    <button disabled={active} onClick={()=>onSettings({...settings,sensitivity:{...settings.sensitivity,[p.id]:defaultSensitivity(p.value)}})}>Default</button>
   </div>
   <details className="sensitivity-details"><summary>Sensitivity: {sensitivity(p).step.toPrecision(4)} {sensitivity(p).mode==='relative'?'factor/pad':'units/pixel'}</summary><label>Sensitivity mode<select disabled={active} value={sensitivity(p).mode} onChange={e=>onSettings({...settings,sensitivity:{...settings.sensitivity,[p.id]:{mode:e.target.value as 'relative'|'absolute',step:e.target.value==='relative'?2:Math.max(p.value/200,.01)}}})}>
    <option value="relative" disabled={p.value===0}>Relative factor / pad</option><option value="absolute">Units / pixel</option>
   </select></label>
   <label>{sensitivity(p).mode==='relative'?'Factor per full pad':'Units per pixel'}<SensitivityInput value={sensitivity(p).step} minimum={sensitivity(p).mode==='relative'?1:0} disabled={active} onCommit={step=>onSettings({...settings,sensitivity:{...settings.sensitivity,[p.id]:{...sensitivity(p),step}}})} /></label></details></>}
 </div>;
 const move=(e:React.PointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
  onMove({...(g.settings.locked?.x?{}:{[g.x.id]:dragValue(g.x.value,e.clientX-g.left,g.width,g.settings.sensitivity[g.x.id]??defaultSensitivity(g.x.value),g.x.allowZero)}),
   ...(g.settings.locked?.y?{}:{[g.y.id]:dragValue(g.y.value,g.top-e.clientY,g.height,g.settings.sensitivity[g.y.id]??defaultSensitivity(g.y.value),g.y.allowZero)})});
 };
 return <aside className="tuning-pad-panel" aria-label="Two parameter tuning">
  {controls('x',x)}{controls('y',y)}
  <div className={`tuning-pad ${active?'dragging':''}`} role="application" aria-label="Two parameter control pad" aria-disabled={!canStart&&!active} tabIndex={0}
   onPointerDown={e=>{if(gesture.current||!canStart||e.button!==0||!x||!y)return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();
    const savedSettings={...settings,sensitivity:{...settings.sensitivity,[x.id]:sensitivity(x),[y.id]:sensitivity(y)}};onSettings(savedSettings);
    gesture.current={pointer:e.pointerId,left:e.clientX,top:e.clientY,width:rect.width,height:rect.height,x:{...x},y:{...y},settings:structuredClone(savedSettings)};
    e.currentTarget.setPointerCapture(e.pointerId);onStart();setActive(true);}}
   onPointerMove={move} onPointerUp={e=>{if(!gesture.current||gesture.current.pointer!==e.pointerId)return;move(e);gesture.current=null;setActive(false);onEnd();e.currentTarget.releasePointerCapture(e.pointerId);}}
   onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={e=>{if(e.key==='Escape'&&gesture.current){e.stopPropagation();cancel();}}}>
   <span>{active?'Adjusting… release to finish':'Hold and drag'}<br/>↑ increase Y<br/>← X →<br/>↓ decrease Y</span>
  </div>
  <small>{x?.id===y?.id&&x?'Choose two different parameters.':'Choose two parameters marked Show in Results. Default: one full pad move doubles or halves a positive value. Escape cancels a drag.'}</small>
 </aside>;
}

function SensitivityInput({value,minimum,disabled,onCommit}:{value:number;minimum:number;disabled:boolean;onCommit:(v:number)=>void}) {
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{const n=Number(draft);if(draft.trim()&&Number.isFinite(n)&&n>minimum)onCommit(n);else setDraft(String(value));};
 return <input type="number" step="any" disabled={disabled} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setDraft(String(value));}}/>;
}
