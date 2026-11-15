import { buildModelDict } from './translator';
import type { Node, Edge } from 'reactflow';
export type Topology = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';
export type Graph = { nodes: Node[]; edges: Edge[] };
export type Workspace = { topology: Topology; graph: Graph; seed: Graph; override: Record<string, any> | null; pins: string[] };
export type ResultRecord = { model: Record<string, any>; data: any; source: 'graph-derived' | 'loaded-override' };
export type Memory = { id: number; label: string; workspace: Workspace; result: ResultRecord; compare: boolean };
export type TuningSession = { version: 1; workspace: Workspace; result: ResultRecord | null; memories: Memory[]; nextId: number; referenceId: number | null };
export const SESSION_KEY = 'oslem.tuning-session.v1';
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function memorise(session: TuningSession, model: Record<string, any>): TuningSession {
  if (session.memories.length >= 9) throw new Error('Nine memories are full. Delete one before memorising another result.');
  if (!session.result || JSON.stringify(session.result.model) !== JSON.stringify(model) ||
    session.result.source !== (session.workspace.override ? 'loaded-override' : 'graph-derived')) throw new Error('Run the current model before memorising it.');
  return { ...session, nextId: session.nextId + 1, memories: [...session.memories, clone({
    id: session.nextId, label: `Result ${session.nextId}`, workspace: session.workspace, result: session.result, compare: true,
  })] };
}
export function recall(session: TuningSession, id: number): TuningSession {
  const memory = session.memories.find(item => item.id === id);
  if (!memory) throw new Error('Memory not found.');
  return { ...session, workspace: clone(memory.workspace), result: clone(memory.result) };
}
export function removeMemory(session: TuningSession, id: number): TuningSession {
  return { ...session, memories: session.memories.filter(item => item.id !== id), referenceId: session.referenceId === id ? null : session.referenceId };
}
const object = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
const stringList = (v: any) => Array.isArray(v) && v.length < 1000 && v.every(x => typeof x === 'string');
function validGraph(g: any): boolean {
  return object(g) && Array.isArray(g.nodes) && g.nodes.length > 0 && g.nodes.length < 500 &&
    g.nodes.every((n: any) => object(n) && typeof n.id === 'string' && object(n.data) && typeof n.data.type === 'string' && (n.data.label === undefined || typeof n.data.label === 'string') && object(n.position) && Number.isFinite(n.position.x) && Number.isFinite(n.position.y)) &&
    new Set(g.nodes.map((n: any) => n.id)).size === g.nodes.length &&
    Array.isArray(g.edges) && g.edges.length < 1000 && g.edges.every((e: any) => object(e) && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string');
}
function validWorkspace(w: any): boolean {
  return object(w) && ['closed_box','bass_reflex','transmission_line','horn'].includes(w.topology) && validGraph(w.graph) && validGraph(w.seed) &&
    (w.override === null || object(w.override)) && stringList(w.pins);
}
function validResult(r: any): boolean {
  return object(r) && object(r.model) && ['graph-derived','loaded-override'].includes(r.source) && object(r.data) &&
    object(r.data.series) && object(r.data.properties) && Array.isArray(r.data.frequencies_hz) &&
    r.data.frequencies_hz.length > 0 && r.data.frequencies_hz.length <= 20000 &&
    r.data.frequencies_hz.every((v: any, i: number, a: number[]) => Number.isFinite(v) && v > 0 && (i === 0 || v > a[i-1])) &&
    [...Object.values(r.data.series), ...Object.values(r.data.properties)].every((values: any) => !Array.isArray(values) || ((values.length === 0 || values.length === r.data.frequencies_hz.length) && values.every((v: any) => typeof v === 'number' ? Number.isFinite(v) : object(v) && Number.isFinite(v.real) && Number.isFinite(v.imag))));
}
export function parseSession(text: string): TuningSession {
  if (text.length > 10_000_000) throw new Error('Session exceeds the 10 MB limit.');
  let s: any;
  try { s = JSON.parse(text); } catch { throw new Error('Invalid session JSON.'); }
  if (!object(s) || s.version !== 1 || !validWorkspace(s.workspace) || !(s.result === null || validResult(s.result)) ||
      !Array.isArray(s.memories) || s.memories.length > 9 || !s.memories.every((m: any) => object(m) && Number.isSafeInteger(m.id) && m.id > 0 && typeof m.label === 'string' && m.label.length < 100 && typeof m.compare === 'boolean' && validWorkspace(m.workspace) && validResult(m.result)) ||
      new Set(s.memories.map((m: any) => m.id)).size !== s.memories.length || !Number.isSafeInteger(s.nextId) || s.nextId < 1 || s.memories.some((m: any) => m.id >= s.nextId) ||
      !(s.referenceId === null || s.memories.some((m: any) => m.id === s.referenceId))) throw new Error('This is not a valid OS-LEM tuning session (version 1).');
  for (const memory of s.memories) {
    const w = memory.workspace;
    const model = w.override ?? buildModelDict(w.graph.nodes, w.graph.edges);
    if (JSON.stringify(model) !== JSON.stringify(memory.result.model) || memory.result.source !== (w.override ? 'loaded-override' : 'graph-derived')) {
      throw new Error('A memory result does not belong to its saved model.');
    }
  }
  return s;
}
