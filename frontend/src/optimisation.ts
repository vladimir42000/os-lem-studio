import type { Parameter } from './parameters';
import { parametersFor } from './parameters';
import { clone, type Workspace, type ResultRecord } from './tuningState';
import { buildModelDict } from './translator';
export type Bound = {id:string; min:number; max:number; value:number};
export type Objective = {low_hz:number; high_hz:number; target_db:number; max_volume_l:number; max_excursion_mm:number};
export type Evaluation = {score:number;feasible:boolean;violations:string[];volume_l:number;peak_excursion_mm:number;ripple_db:number;peak_group_delay_ms:number|null};
export type Candidate = {id:number;workspace:Workspace;result:ResultRecord;evaluation:Evaluation;values:Record<string,number>};
export function geometryParameters(workspace:Workspace):Parameter[] {
  const keys=workspace.topology==='bass_reflex'?['Vb','areaCm2','lengthCm']:workspace.topology==='transmission_line'?['lengthCm','driverOffsetCm','areaCm2','mouthAreaCm2']:[];
  return parametersFor(workspace.graph.nodes,workspace.topology).filter(p=>p.group==='Box'&&keys.includes(p.key));
}
export function candidateWorkspace(base:Workspace,values:Record<string,number>):Workspace {
  const w=clone(base);const allowed=geometryParameters(base);
  // Freeze fallback geometry too: legacy TL mouth area must not track an edited inlet.
  for(const p of allowed) {const node=w.graph.nodes.find(n=>n.id===p.nodeId)!;if(node.data[p.key]===undefined)node.data[p.key]=p.value;}
  for(const [id,value] of Object.entries(values)) {
    const p=allowed.find(p=>p.id===id);
    if(!p || !Number.isFinite(value) || value<0 || (!p.allowZero&&value===0))throw new Error('Invalid geometry candidate.');
    const node=w.graph.nodes.find(n=>n.id===p.nodeId)!;node.data[p.key]=value;
  }
  const line=w.graph.nodes.find(n=>n.data.type==='waveguide_1d')?.data;
  if(line && Number(line.driverOffsetCm??0)>=Number(line.lengthCm??160))throw new Error('Driver position must be smaller than line length.');
  return w;
}
export function volumeLiters(w:Workspace):number {
  const p=parametersFor(w.graph.nodes,w.topology);const v=(key:string)=>p.find(p=>p.key===key)!.value;
  // BR cap includes net chamber plus the air inside its port; excludes walls/driver.
  return w.topology==='bass_reflex'?v('Vb')+v('areaCm2')*v('lengthCm')/1000:(v('areaCm2')+v('mouthAreaCm2'))/2*v('lengthCm')/1000;
}
export const optimisationGrid=()=>Array.from({length:600},(_,i)=>10*Math.pow(100,i/599));
export async function optRequest(path:string,body:unknown,signal:AbortSignal):Promise<any> {
  const response=await fetch(`http://localhost:8000/api/optimise/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const payload=await response.json();
  if(!response.ok)throw new Error(typeof payload.detail==='string'?payload.detail:`OPT request failed (${response.status}).`);
  return payload;
}
export async function evaluateCandidate(base:Workspace,values:Record<string,number>,objective:Objective,id:number,signal:AbortSignal):Promise<Candidate> {
  const workspace=candidateWorkspace(base,values);
  const model=buildModelDict(workspace.graph.nodes as any,workspace.graph.edges);
  const frequencies=optimisationGrid();
  const payload=await optRequest('evaluate',{model_dict:model,frequencies_hz:frequencies,objective,volume_l:volumeLiters(workspace)},signal);
  if(payload.status!=='success'||!payload.evaluation||!Array.isArray(payload.data?.frequencies_hz)||
      payload.data.frequencies_hz.length!==frequencies.length||!payload.data.frequencies_hz.every((v:number,i:number)=>v===frequencies[i])||
      !Number.isFinite(payload.evaluation.score))throw new Error('Invalid OPT result.');
  return {id,workspace,result:{model,data:payload.data,source:'graph-derived'},evaluation:payload.evaluation,values};
}
