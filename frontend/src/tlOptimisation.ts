import {clone,type Workspace} from './tuningState';
import {parametersFor} from './parameters';
import {buildModelDict} from './translator';
import {selectSplSeries} from './chartSeries';
import {optRequest,volumeLiters,type Candidate,type Objective,type Bound} from './optimisation';
export type TLBounds=Bound & {label:string;local_wide?:boolean};
export type TLConfig={stuffing:boolean;s0min:number;s0max:number;smmin:number;smmax:number};
export function tlDefaults(w:Workspace):{bounds:TLBounds[];config:TLConfig} {
 const ps=parametersFor(w.graph.nodes,w.topology);const v=(k:string)=>ps.find(p=>p.key===k)!.value;
 const L=v('lengthCm'),a=v('areaCm2'),b=v('mouthAreaCm2'),start=v('stuffing1Start');
 const tuple:[string,string,number,number,number,boolean?][]=[
  ['length_cm','Line length (cm)',.5*343.2/(4*v('Fs'))*100,1.2*343.2/(4*v('Fs'))*100,L],
  ['volume_l','Line volume (L)',Math.max(.1,volumeLiters(w)*.4),100,volumeLiters(w)],
  ['taper','Mouth / closed-end area',.1,8,b/a],
  ['driver_fraction','Driver position / length',0,.35,v('driverOffsetCm')/L,true],
  ['zone_start','Zone 1 start / length',0,.8,start/100,true],
  ['zone_extent','Zone 1 fraction of remaining length',.05,1,(v('stuffing1End')-start)/(100-start),true],
  ['density','Zone 1 density (kg/m³)',0,15,v('stuffing1Density'),true],
 ];
 return {bounds:tuple.map(([id,label,min,max,value,local_wide])=>({id,label,min,max,value,local_wide})),config:{stuffing:false,s0min:.1,s0max:4,smmin:.1,smmax:8}};
}
export function tlWorkspace(base:Workspace,values:Record<string,number>,config:TLConfig):Workspace {
 if(Object.values(values).some(v=>!Number.isFinite(v)))throw new Error('Nonfinite TL parameter.');
 const {length_cm:L,volume_l:V,taper:r,driver_fraction:eta}=values;
 if(!(L>0&&V>0&&r>0&&eta>=0&&eta<1))throw new Error('Invalid TL geometry.');
 const w=clone(base);const line=w.graph.nodes.find(n=>n.data.type==='waveguide_1d')!;
 const sd=parametersFor(w.graph.nodes,w.topology).find(p=>p.key==='Sd')!.value;
 const a=2000*V/(L*(1+r)),b=r*a;
 if(a<sd*config.s0min||a>sd*config.s0max||b<sd*config.smmin||b>sd*config.smmax)throw new Error('Section outside specified Sd limits.');
 Object.assign(line.data,{lengthCm:L,areaCm2:a,mouthAreaCm2:b,driverOffsetCm:eta*L});
 if(config.stuffing) {
  if(Number(line.data.stuffing2Density??0)>0||Number(line.data.stuffing3Density??0)>0)throw new Error('Experimental search requires zones 2 and 3 disabled; existing zones were not changed.');
  const {zone_start:start,zone_extent:extent,density}=values;
  if(!(start>=0&&start<1&&extent>0&&extent<=1&&density>=0&&density<=15))throw new Error('Invalid stuffing zone.');
  Object.assign(line.data,{stuffing1Start:100*start,stuffing1End:100*(start+(1-start)*extent),stuffing1Density:density});
 }
 return w;
}
export async function evaluateTL(w:Workspace,objective:Objective,id:number,signal:AbortSignal,segments=64,count=600):Promise<Candidate> {
 const workspace=clone(w);workspace.graph.nodes.find(n=>n.data.type==='waveguide_1d')!.data.lineSegments=segments;
 const model=buildModelDict(workspace.graph.nodes as any,workspace.graph.edges);
 const grid=Array.from({length:count},(_,i)=>10*Math.pow(100,i/(count-1)));
 const payload=await optRequest('evaluate',{model_dict:model,frequencies_hz:grid,objective,volume_l:volumeLiters(workspace)},signal);
 if(payload.status!=='success'||!Number.isFinite(payload.evaluation?.score)||payload.data?.frequencies_hz?.length!==count||
  !payload.data.frequencies_hz.every((v:number,i:number)=>v===grid[i]))throw new Error('Invalid adaptive evaluation response.');
 return {id,workspace,result:{model,data:payload.data,source:'graph-derived'},evaluation:payload.evaluation,values:{}};
}
export function convergence(coarse:Candidate,fine:Candidate) {
 const a=selectSplSeries(coarse.result.data.series,coarse.result.data.frequencies_hz.length),b=selectSplSeries(fine.result.data.series,fine.result.data.frequencies_hz.length);
 if(!a.length||b.length!==2*a.length-1)return {ok:false,delta:Infinity};
 const delta=Math.max(...a.map((v,i)=>Math.abs(v-b[2*i])));
 const excursion=Math.abs(coarse.evaluation.peak_excursion_mm-fine.evaluation.peak_excursion_mm);
 return {ok:delta<=.25&&Math.abs(coarse.evaluation.score-fine.evaluation.score)<=.25&&excursion<=Math.max(.01,.02*fine.evaluation.peak_excursion_mm),delta};
}
export async function refineTL(c:Candidate,objective:Objective,signal:AbortSignal):Promise<Candidate> {
 const mid=await evaluateTL(c.workspace,objective,c.id,signal,128,1199);
 const fine=await evaluateTL(c.workspace,objective,c.id,signal,256,2397);
 const check=convergence(mid,fine);
 // Fine-grid feasibility is authoritative. Coarse->middle is diagnostic; middle->fine is the gate.
 fine.verification={passed:check.ok,max_spl_delta_db:check.delta,coarse_delta_db:convergence(c,mid).delta};
 return fine;
}
export function keepDiverse(candidates:Candidate[],bounds:TLBounds[],limit=3):Candidate[] {
 const sorted=[...candidates].sort((a,b)=>a.evaluation.score-b.evaluation.score),chosen:Candidate[]=[];
 for(const c of sorted) {
  if(chosen.every(d=>Math.sqrt(bounds.reduce((sum,b)=>sum+((c.values[b.id]-d.values[b.id])/(b.max-b.min))**2,0))>=.1))chosen.push(c);
  if(chosen.length===limit)break;
 }
 return chosen;
}
