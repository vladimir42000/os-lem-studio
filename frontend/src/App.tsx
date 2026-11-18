import TLAdaptivePanel from './TLAdaptivePanel';
import BRAlignments from './BRAlignments';
import OptimisationPanel from './OptimisationPanel';
import type { Candidate } from './optimisation';
import TuningPad from './TuningPad';
import { emptyPad, type PadSettings } from './tuningGesture';
import ParameterPanel from './ParameterPanel';
import MemoryPanel from './MemoryPanel';
import { parametersFor, boxSummary, type Parameter } from './parameters';
import { clone, memorise, recall, parseSession, SESSION_KEY, type TuningSession, type ResultRecord, type Workspace } from './tuningState';
import { closedBoxTemplate, bassReflexTemplate, transmissionLineTemplate } from './topologyTemplates';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';
import type {
  Connection,
  Edge as ReactFlowEdge,
  EdgeChange,
  Node as ReactFlowNode,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ChartPanel from './ChartPanel';
import SimulationWarningsSurface from './SimulationWarningsSurface';
import CanonicalModelInspection from './CanonicalModelInspection';
import CanonicalModelFileControls from './CanonicalModelFileControls';
import { buildModelDict } from './translator';
import { runSimulationThin } from './thinRunner';
import { assessGraphCompilability } from './graphCompilability';
import type { CanvasEdge, CanvasNode } from './types';
import SimulationResultExportControls from './SimulationResultExportControls';
import RunnerStateSummary from './RunnerStateSummary';
import { computeRunnerStateTruth } from './lifecycleTruth';
import type { CanonicalModelSourceKind } from './lifecycleTruth';

type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

type GraphSnapshot = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
};

type HistoryState = {
  snapshots: GraphSnapshot[];
  index: number;
};

const HISTORY_LIMIT = 40;

function placeholderTemplate(label: string): GraphSnapshot {
  return {
    nodes: [
      {
        id: 'node_placeholder_1',
        type: 'default',
        position: { x: 320, y: 170 },
        data: {
          type: 'volume',
          label,
          Vb: 1,
        },
      },
    ],
    edges: [],
  };
}

function cloneGraphSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...(node.data ?? {}) },
    })),
    edges: snapshot.edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : undefined,
    })),
  };
}

function seedTemplateGraph(topology: TopologyId): GraphSnapshot {
  const base =
    topology === 'closed_box'
      ? closedBoxTemplate
      : topology === 'bass_reflex'
        ? bassReflexTemplate
        : topology === 'transmission_line'
          ? transmissionLineTemplate
          : placeholderTemplate('Horn seed');

  const seeded = cloneGraphSnapshot(base);
  return {
    nodes: seeded.nodes.map((node) => ({
      ...node,
      data: {
        ...(node.data ?? {}),
        _seedTopology: topology,
      },
    })),
    edges: seeded.edges.map((edge) => ({
      ...edge,
      data: {
        ...(edge.data ?? {}),
        _seedTopology: topology,
      },
    })),
  };
}

function toCanvasNode(node: ReactFlowNode): CanvasNode {
  return {
    id: String(node.id),
    type: (node.type ?? 'default') as CanvasNode['type'],
    position: {
      x: Number(node.position?.x ?? 0),
      y: Number(node.position?.y ?? 0),
    },
    data: node.data ?? {},
  };
}

function toCanvasEdge(edge: ReactFlowEdge): CanvasEdge {
  return {
    id: String(edge.id),
    source: String(edge.source),
    sourceHandle: edge.sourceHandle ?? null,
    target: String(edge.target),
    targetHandle: edge.targetHandle ?? null,
  };
}

function stableSnapshotKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch (_error) {
    return '__unserializable__';
  }
}


function pushSnapshotBounded(prev: HistoryState, snapshot: GraphSnapshot): HistoryState {
  const base = prev.snapshots.slice(0, prev.index + 1);
  const appended = [...base, cloneGraphSnapshot(snapshot)];
  const trimmed = appended.length > HISTORY_LIMIT ? appended.slice(appended.length - HISTORY_LIMIT) : appended;
  return {
    snapshots: trimmed,
    index: trimmed.length - 1,
  };
}

function TopologyCard({
  title,
  subtitle,
  status,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  status: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 10,
        border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
        background: active ? '#eff6ff' : '#ffffff',
        cursor: 'pointer',
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>{subtitle}</div>
      <div style={{ fontSize: 12, color: active ? '#1d4ed8' : '#64748b' }}>{status}</div>
    </button>
  );
}

function StatusBadge({ text, tone }: { text: string; tone: 'good' | 'warning' | 'bad' | 'neutral' }) {
  const colors =
    tone === 'good'
      ? { bg: '#dcfce7', fg: '#166534' }
      : tone === 'warning'
        ? { bg: '#ffedd5', fg: '#9a3412' }
        : tone === 'bad'
          ? { bg: '#fee2e2', fg: '#991b1b' }
          : { bg: '#e2e8f0', fg: '#334155' };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: colors.bg,
        color: colors.fg,
      }}
    >
      {text}
    </span>
  );
}

function formatGraphAssessmentStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function getAnchorWorkflowCopy(topology: TopologyId, status: string, reasons: string[]) {
  if ((topology === 'bass_reflex' || topology === 'transmission_line') && status === 'compilable_anchor') {
    return { title: topology === 'bass_reflex' ? 'Bass Reflex simulation' : 'Transmission line',
      detail: 'SPL combines driver and mouth pressures at 1 m in half-space. External comparison pending.',
      runLabel: 'Run simulation', resetLabel: 'Reset template' };
  }
  if (topology === 'closed_box' && status === 'compilable_anchor') {
    return {
      title: 'Closed Box simulation',
      detail: 'Edit driver or enclosure parameters, then run again. Structural changes remain restricted.',
      runLabel: 'Run simulation',
      resetLabel: 'Reset to exact Closed Box anchor',
    };
  }

  if (topology === 'closed_box' && status === 'composition_not_yet_compilable') {
    return {
      title: 'Closed Box composition mode',
      detail:
        reasons[0] ??
        'Structural edits moved the graph beyond the exact validated Closed Box anchor. Reset to the stored seed to restore the runnable anchor.',
      runLabel: 'Simulation gated',
      resetLabel: 'Reset to exact Closed Box anchor',
    };
  }

  if (topology === 'closed_box' && status === 'invalid_graph') {
    return {
      title: 'Closed Box anchor invalid',
      detail:
        reasons[0] ??
        'The graph no longer satisfies the required Closed Box primitive/connection motif. Reset to the stored seed to restore the runnable anchor.',
      runLabel: 'Simulation gated',
      resetLabel: 'Reset to exact Closed Box anchor',
    };
  }

  if (topology === 'bass_reflex') {
    return {
      title: 'Bass Reflex needs a valid model',
      detail: reasons[0] ?? 'Restore template connections and enter valid parameters.',
      runLabel: 'Simulation gated',
      resetLabel: 'Reset to Bass Reflex seed',
    };
  }

  if (topology === 'transmission_line') {
    return { title: 'Transmission line needs valid parameters', detail: reasons[0] ?? 'Check line geometry and driver offset.',
      runLabel: 'Check parameters', resetLabel: 'Reset template' };
  }

  return {
    title: 'Seed-only topology path',
    detail: reasons[0] ?? 'This seeded topology is visible for authoring direction only and is not runnable in the current truthful line.',
    runLabel: 'Simulation gated',
    resetLabel: `Reset to ${topology === 'horn' ? 'Horn' : 'Transmission Line'} seed`,
  };
}

function safeAssessGraphCompilability(args: {
  topology: TopologyId;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  seedGraph: GraphSnapshot;
  currentGraph: GraphSnapshot;
}) {
  const fn = assessGraphCompilability as any;
  try {
    const result = fn(args);
    if (result && typeof result === 'object') return result;
  } catch (_error) {
    // fall through
  }

  try {
    const result = fn(args.topology, args.nodes, args.edges, args.seedGraph, args.currentGraph);
    if (result && typeof result === 'object') return result;
  } catch (_error) {
    // fall through
  }

  return {
    status: 'invalid_graph',
    reasons: ['Graph compilability assessment failed.'],
  };
}

const initialSeedGraph = seedTemplateGraph('closed_box');

function initialTuningSession(): { session: TuningSession | null; error: string } {
  try { const text = localStorage.getItem(SESSION_KEY); return { session: text ? parseSession(text) : null, error: '' }; }
  catch { return { session: null, error: 'Saved session could not be restored. Load a session file if you have one.' }; }
}

export default function App() {
  const [initial] = useState(initialTuningSession);
  const restored = initial.session;
  const [pins,setPins] = useState<string[]>(restored?.workspace.pins ?? []);
  const [workshopMode,setWorkshopMode] = useState<'tuning'|'optimise'>('tuning');
  const [optPreview,setOptPreview] = useState<Candidate|null>(null);
  const [memories,setMemories] = useState(restored?.memories ?? []);
  const [nextId,setNextId] = useState(restored?.nextId ?? 1);
  const [referenceId,setReferenceId] = useState<number | null>(restored?.referenceId ?? null);
  const [sessionError,setSessionError] = useState(initial.error);
  const [storageError,setStorageError] = useState('');
  const [resultRecord,setResultRecord] = useState<ResultRecord | null>(restored?.result ?? null);
  const [autoRecalculate,setAutoRecalculate] = useState(true);
  const [padSettings,setPadSettings] = useState<PadSettings>(restored?.workspace.tuning ?? emptyPad());
  const [dragging,setDragging] = useState(false);
  const [forceRecalculate,setForceRecalculate] = useState(false);
  const [graphFocus,setGraphFocus] = useState(false);
  const [previousGesture,setPreviousGesture] = useState<ResultRecord | null>(null);
  const [gestureUndo,setGestureUndo] = useState<{workspace:Workspace;result:ResultRecord|null;history:HistoryState}|null>(null);
  const gestureStart = useRef<{workspace:Workspace;result:ResultRecord|null;history:HistoryState}|null>(null);
  const gestureLatest = useRef<GraphSnapshot|null>(null);
  const draggingRef = useRef(false);
  const gesturePriorCurve = useRef<ResultRecord|null>(null);
  const attemptedKey = useRef('');
  const [activeView, setActiveView] = useState<'model' | 'results' | 'files'>('model');
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>(restored?.workspace.topology ?? 'closed_box');
  const [seedGraph, setSeedGraph] = useState<GraphSnapshot>(() => cloneGraphSnapshot(restored?.workspace.seed ?? initialSeedGraph));
  const [nodes, setNodes] = useState<ReactFlowNode[]>(() => cloneGraphSnapshot(restored?.workspace.graph ?? initialSeedGraph).nodes);
  const [edges, setEdges] = useState<ReactFlowEdge[]>(() => cloneGraphSnapshot(restored?.workspace.graph ?? initialSeedGraph).edges);
  const [historyState, setHistoryState] = useState<HistoryState>(() => ({
    snapshots: [cloneGraphSnapshot(restored?.workspace.graph ?? initialSeedGraph)],
    index: 0,
  }));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSeedGraph.nodes[0]?.id ?? null);
  const [simulationResult, setSimulationResult] = useState<any>(restored?.result?.data ?? null);
  const [latestResultCanonicalModelSnapshotKey, setLatestResultCanonicalModelSnapshotKey] = useState<string | null>(restored?.result ? stableSnapshotKey(restored.result.model) : null);
  const [latestResultSourceKind, setLatestResultSourceKind] = useState<CanonicalModelSourceKind | null>(restored?.result?.source ?? null);
  const [loadedCanonicalModelOverride, setLoadedCanonicalModelOverride] = useState<Record<string, unknown> | null>(restored?.workspace.override ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationInFlight = useRef(false);

  const currentGraph = useMemo<GraphSnapshot>(() => cloneGraphSnapshot({ nodes, edges }), [nodes, edges]);
  const canvasNodes = useMemo(() => nodes.map(toCanvasNode), [nodes]);
  const canvasEdges = useMemo(() => edges.map(toCanvasEdge), [edges]);
  const compiledGraph = useMemo(
    () => {try {return {model:buildModelDict(canvasNodes,canvasEdges),error:''};}
      catch(error){return {model:{} as Record<string,any>,error:error instanceof Error?error.message:'Invalid model parameters'};}},
    [canvasNodes, canvasEdges],
  );

  const graphDerivedCanonicalModel=compiledGraph.model;
  // lifecycle marker: canonical model snapshot key used for result ownership
  const canonicalModel = loadedCanonicalModelOverride ?? graphDerivedCanonicalModel;
  const canonicalModelSnapshotKey = useMemo(() => stableSnapshotKey(canonicalModel), [canonicalModel]);
  const currentCanonicalModelSourceKind: CanonicalModelSourceKind = loadedCanonicalModelOverride ? 'loaded-override' : 'graph-derived';
  const currentIdentity = `${currentCanonicalModelSourceKind}:${canonicalModelSnapshotKey}`;
  const identityRef = useRef(currentIdentity);
  identityRef.current = currentIdentity;
  const generation = useRef(0);
  const parameters = useMemo(() => parametersFor(nodes, selectedTopology), [nodes, selectedTopology]);
  const workspace: Workspace = { topology: selectedTopology, graph: currentGraph, seed: seedGraph, override: loadedCanonicalModelOverride, pins, tuning: padSettings };
  const session: TuningSession = { version: 1, workspace, result: resultRecord, memories, nextId, referenceId };
  const sessionText = dragging ? '' : JSON.stringify(session);
  useEffect(() => {
    if(!sessionText)return;
    try { localStorage.setItem(SESSION_KEY,sessionText); setStorageError(''); }
    catch { setStorageError('Browser storage is unavailable or full. Use Save tuning session to keep your work.'); }
  }, [sessionText]);

  const runnerStateTruth = useMemo(
    () =>
      computeRunnerStateTruth({
        simulationResult,
        latestResultCanonicalModelSnapshotKey,
        latestResultSourceKind,
        currentCanonicalModelSnapshotKey: canonicalModelSnapshotKey,
        currentCanonicalModelSourceKind,
      }),
    [
      simulationResult,
      latestResultCanonicalModelSnapshotKey,
      latestResultSourceKind,
      canonicalModelSnapshotKey,
      currentCanonicalModelSourceKind,
    ],
  );
  const {
    resultLifecycleIsStale,
    rerunNeeded,
    canonicalModelSourceLabel,
    canonicalModelSourceDetail,
    resultStateLabel,
    resultOwnershipLabel,
  } = runnerStateTruth;

  const graphAssessment = useMemo(
    () =>
      safeAssessGraphCompilability({
        topology: selectedTopology,
        nodes,
        edges,
        seedGraph,
        currentGraph,
      }),
    [selectedTopology, nodes, edges, seedGraph, currentGraph],
  ) as { status: string; reasons: string[] };

  const canUndo = !dragging && (!!gestureUndo || historyState.index > 0);
  const canRedo = historyState.index < historyState.snapshots.length - 1;
  const chartOverlays = useMemo(()=>[
    ...(optPreview?[{id:1000+optPreview.id,label:`OPT candidate ${optPreview.id}`,data:optPreview.result.data,reference:false}]:[]),
    ...memories.filter(m=>m.compare || m.id===referenceId).map(m=>({id:m.id,label:m.label,data:m.result.data,reference:m.id===referenceId})),
    ...(previousGesture?[{id:0,label:'Before last adjustment',data:previousGesture.data,reference:false,previous:true}]:[]),
  ],[memories,referenceId,previousGesture,optPreview]);
  const currentWarnings = Array.isArray(simulationResult?.warnings)
    ? simulationResult.warnings.filter((warning: unknown) => typeof warning === 'string' && warning.trim().length > 0)
    : [];

  const anchorWorkflowCopy = getAnchorWorkflowCopy(selectedTopology, graphAssessment.status, graphAssessment.reasons ?? []);
  const statusTone: 'good' | 'warning' | 'bad' | 'neutral' =
    graphAssessment.status === 'compilable_anchor'
      ? 'good'
      : graphAssessment.status === 'invalid_graph'
        ? 'bad'
        : 'warning';

  const canRunSimulation = Boolean(loadedCanonicalModelOverride) || (!compiledGraph.error && graphAssessment.status === 'compilable_anchor');
  const runButtonLabel = loadedCanonicalModelOverride ? 'Run Loaded Canonical Model' : anchorWorkflowCopy.runLabel;

  const replaceWorkingGraph = useCallback(
    (snapshot: GraphSnapshot, options: { recordHistory: boolean; resetHistory?: boolean } = { recordHistory: true }) => {
      const safeSnapshot = cloneGraphSnapshot(snapshot);
      setNodes(safeSnapshot.nodes);
      setEdges(safeSnapshot.edges);

      if (options.resetHistory) {
        setHistoryState({ snapshots: [cloneGraphSnapshot(safeSnapshot)], index: 0 });
        return;
      }

      if (options.recordHistory) {
        setHistoryState((prev) => pushSnapshotBounded(prev, safeSnapshot));
      }
    },
    [],
  );

  const handleTopologySelect = useCallback(
    (topology: TopologyId) => {
      const nextSeed = seedTemplateGraph(topology);
      setGestureUndo(null);setPreviousGesture(null);
      setSelectedTopology(topology);
      setLoadedCanonicalModelOverride(null);
      setLoadError(null);
      setSeedGraph(cloneGraphSnapshot(nextSeed));
      replaceWorkingGraph(nextSeed, { recordHistory: false, resetHistory: true });
      setSelectedNodeId(nextSeed.nodes[0]?.id ?? null);
      setRunError(null);
    },
    [replaceWorkingGraph],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextNodes = applyNodeChanges(changes, nodes);
      const recordHistory = changes.some((change) => change.type !== 'select' && change.type !== 'dimensions');
      if (recordHistory) {
        replaceWorkingGraph({ nodes: nextNodes, edges }, { recordHistory: true });
      } else {
        setNodes(nextNodes);
      }
    },
    [nodes, edges, replaceWorkingGraph],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nextEdges = applyEdgeChanges(changes, edges);
      const recordHistory = changes.some((change) => change.type !== 'select');
      if (recordHistory) {
        replaceWorkingGraph({ nodes, edges: nextEdges }, { recordHistory: true });
      } else {
        setEdges(nextEdges);
      }
    },
    [nodes, edges, replaceWorkingGraph],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const nextEdges = addEdge(params, edges);
      replaceWorkingGraph({ nodes, edges: nextEdges }, { recordHistory: true });
    },
    [nodes, edges, replaceWorkingGraph],
  );

  const onSelectionChange = useCallback((params: any) => {
    const selectedNodes = Array.isArray(params?.nodes) ? params.nodes : [];
    setSelectedNodeId(selectedNodes[0]?.id ?? null);
  }, []);

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const nextNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...(node.data ?? {}), ...patch } } : node,
      );
      replaceWorkingGraph({ nodes: nextNodes, edges }, { recordHistory: true });
    },
    [nodes, edges, replaceWorkingGraph],
  );

  const changeParameter = (p: Parameter, value: number) => {
    setGestureUndo(null);setPreviousGesture(null);
    patchNodeData(p.nodeId, { [p.key]: value });
    setRunError(null);
  };
  const togglePin = (id: string) => setPins(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const changeMemories = (s: TuningSession) => { setMemories(s.memories); setNextId(s.nextId); setReferenceId(s.referenceId); };
  const restoreSession = (s: TuningSession) => {
    generation.current += 1;
    setGestureUndo(null);setPreviousGesture(null);
    const w = clone(s.workspace);
    setPadSettings(w.tuning ?? emptyPad());
    setSelectedTopology(w.topology);setSeedGraph(w.seed);setPins(w.pins);setLoadedCanonicalModelOverride(w.override);
    replaceWorkingGraph(w.graph,{recordHistory:false,resetHistory:true});
    setSelectedNodeId(w.graph.nodes[0]?.id ?? null);
    setResultRecord(clone(s.result));setSimulationResult(s.result?.data ?? null);
    setLatestResultCanonicalModelSnapshotKey(s.result ? stableSnapshotKey(s.result.model) : null);
    setLatestResultSourceKind(s.result?.source ?? null);
    changeMemories(s);setRunError(null);setLoadError(null);setSessionError('');setActiveView('results');attemptedKey.current='';
  };
  const remember = () => {
    try { changeMemories(memorise(session,canonicalModel));setSessionError(''); }
    catch(error){setSessionError(error instanceof Error ? error.message : 'Cannot memorise result.');}
  };

  const restoreGesture = (saved: {workspace:Workspace;result:ResultRecord|null;history:HistoryState}) => {
    generation.current += 1;
    setNodes(clone(saved.workspace.graph.nodes));setEdges(clone(saved.workspace.graph.edges));setHistoryState(clone(saved.history));
    setResultRecord(clone(saved.result));setSimulationResult(saved.result?.data ?? null);
    setLatestResultCanonicalModelSnapshotKey(saved.result ? stableSnapshotKey(saved.result.model) : null);
    setLatestResultSourceKind(saved.result?.source ?? null);setGestureUndo(null);setRunError(null);setForceRecalculate(false);
    attemptedKey.current='';
  };
  const applyOptCandidate = (candidate:Candidate) => {
    generation.current += 1;
    setGestureUndo({workspace:clone(workspace),result:clone(resultRecord),history:clone(historyState)});
    setPreviousGesture(clone(resultRecord));
    replaceWorkingGraph(candidate.workspace.graph,{recordHistory:true});
    setResultRecord(clone(candidate.result));setSimulationResult(clone(candidate.result.data));
    setLatestResultCanonicalModelSnapshotKey(stableSnapshotKey(candidate.result.model));
    setLatestResultSourceKind('graph-derived');setRunError(null);setOptPreview(null);
    attemptedKey.current='';
  };
  const startGesture = () => {
    gesturePriorCurve.current=previousGesture;
    const saved = clone({workspace,result:resultRecord,history:historyState});
    gestureStart.current=saved;gestureLatest.current=clone(currentGraph);
    setPreviousGesture(resultRecord ? clone(resultRecord) : null);
    draggingRef.current=true;setDragging(true);setRunError(null);
  };
  const moveGesture = (values:Record<string,number>) => {
    const saved=gestureStart.current;if(!saved)return;
    const next=clone(saved.workspace.graph);
    for(const p of parameters) if(p.id in values) {
      const node=next.nodes.find(n=>n.id===p.nodeId);if(node)node.data[p.key]=values[p.id];
    }
    // Keep coupled TL geometry valid, including when both length and offset move.
    for(const node of next.nodes) if(node.data.type==='waveguide_1d') {
      const d=node.data;
      if(d.driverOffsetCm>=d.lengthCm) {
        const offsetParameter=parameters.find(p=>p.nodeId===node.id&&p.key==='driverOffsetCm');
        if(offsetParameter && offsetParameter.id in values) d.driverOffsetCm=Math.max(0,d.lengthCm-1e-6);
        else d.lengthCm=d.driverOffsetCm+1e-6;
      }
    }
    const assessment=assessGraphCompilability({topology:selectedTopology,...next,seedGraph});
    if(!assessment.canRunSimulation){setRunError(assessment.reasons[0]);return;}
    gestureLatest.current=next;setNodes(next.nodes);setEdges(next.edges);
  };
  const endGesture = () => {
    const saved=gestureStart.current,latest=gestureLatest.current;
    draggingRef.current=false;setDragging(false);gestureStart.current=null;
    if(saved&&latest&&JSON.stringify(saved.workspace.graph)!==JSON.stringify(latest)) {
      setGestureUndo(saved);setHistoryState(pushSnapshotBounded(saved.history,latest));
      attemptedKey.current='';setForceRecalculate(true);
    } else setPreviousGesture(gesturePriorCurve.current);
  };
  const cancelGesture = () => {
    const saved=gestureStart.current;gestureStart.current=null;draggingRef.current=false;setDragging(false);
    if(saved)restoreGesture(saved);setPreviousGesture(gesturePriorCurve.current);
  };

  const handleUndo = () => {
    if (gestureUndo) { restoreGesture(gestureUndo);return; }
    setHistoryState((prev) => {
      if (prev.index === 0) return prev;
      const nextIndex = prev.index - 1;
      const snapshot = cloneGraphSnapshot(prev.snapshots[nextIndex]);
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      return { ...prev, index: nextIndex };
    });
  };

  const handleRedo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index >= prev.snapshots.length - 1) return prev;
      const nextIndex = prev.index + 1;
      const snapshot = cloneGraphSnapshot(prev.snapshots[nextIndex]);
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      return { ...prev, index: nextIndex };
    });
  }, []);

  const handleResetToSeed = useCallback(() => {
    replaceWorkingGraph(seedGraph, { recordHistory: true });
    setSelectedNodeId(seedGraph.nodes[0]?.id ?? null);
  }, [seedGraph, replaceWorkingGraph]);

  const handleAddChild = useCallback(() => {
    const parent = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
    if (!parent) return;
    const childId = `node_added_${Date.now()}`;
    const edgeId = `edge_added_${Date.now()}`;
    const nextNode: ReactFlowNode = {
      id: childId,
      type: 'default',
      position: { x: parent.position.x + 180, y: parent.position.y + 90 },
      data: {
        type: 'volume',
        label: 'Added Volume',
        Vb: 10,
      },
    };
    const nextEdge: ReactFlowEdge = {
      id: edgeId,
      source: String(parent.id),
      target: childId,
    };
    replaceWorkingGraph({ nodes: [...nodes, nextNode], edges: [...edges, nextEdge] }, { recordHistory: true });
    setSelectedNodeId(childId);
  }, [nodes, edges, selectedNodeId, replaceWorkingGraph]);

  const handleDeleteSelectedLeaf = useCallback(() => {
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return;
    const seedNodeIds = new Set(seedGraph.nodes.map((node) => String(node.id)));
    const nodeId = String(selectedNode.id);
    const hasOutgoing = edges.some((edge) => String(edge.source) === nodeId);
    if (seedNodeIds.has(nodeId) || hasOutgoing) return;
    const nextNodes = nodes.filter((node) => String(node.id) !== nodeId);
    const nextEdges = edges.filter((edge) => String(edge.source) !== nodeId && String(edge.target) !== nodeId);
    replaceWorkingGraph({ nodes: nextNodes, edges: nextEdges }, { recordHistory: true });
    setSelectedNodeId(nextNodes[0]?.id ? String(nextNodes[0].id) : null);
  }, [nodes, edges, selectedNodeId, seedGraph, replaceWorkingGraph]);

  const handleSplitFirstOutgoingPath = useCallback(() => {
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return;
    const outgoingEdge = edges.find((edge) => String(edge.source) === String(selectedNode.id));
    if (!outgoingEdge) return;
    const targetNode = nodes.find((node) => String(node.id) === String(outgoingEdge.target));
    const splitNodeId = `node_split_${Date.now()}`;
    const splitNode: ReactFlowNode = {
      id: splitNodeId,
      type: 'default',
      position: {
        x: targetNode ? (selectedNode.position.x + targetNode.position.x) / 2 : selectedNode.position.x + 120,
        y: targetNode ? (selectedNode.position.y + targetNode.position.y) / 2 : selectedNode.position.y,
      },
      data: {
        type: 'duct',
        label: 'Split Duct',
        areaCm2: 40,
        lengthCm: 15,
      },
    };
    const remainingEdges = edges.filter((edge) => String(edge.id) !== String(outgoingEdge.id));
    const nextEdges: ReactFlowEdge[] = [
      ...remainingEdges,
      { id: `${outgoingEdge.id}_a`, source: String(outgoingEdge.source), target: splitNodeId },
      { id: `${outgoingEdge.id}_b`, source: splitNodeId, target: String(outgoingEdge.target) },
    ];
    replaceWorkingGraph({ nodes: [...nodes, splitNode], edges: nextEdges }, { recordHistory: true });
    setSelectedNodeId(splitNodeId);
  }, [nodes, edges, selectedNodeId, replaceWorkingGraph]);

  const handleLoadCanonicalModel = useCallback((model: Record<string, unknown>) => {
    setLoadedCanonicalModelOverride(model);
    setLoadError(null);
  }, []);

  const handleLoadCanonicalModelError = useCallback((message: string) => {
    setLoadError(message);
  }, []);

  const handleClearLoadedCanonicalModel = useCallback(() => {
    setLoadedCanonicalModelOverride(null);
    setLoadError(null);
  }, []);

  const handleRunSimulationThin = useCallback(async (automatic = false) => {
    if (simulationInFlight.current) return;
    if (!canRunSimulation) {
      setRunError(graphAssessment.reasons?.[0] ?? 'Simulation is currently gated by compiler-boundary truth.');
      return;
    }

    const topology = (canonicalModel.meta as Record<string, unknown> | undefined)?.studio_topology;
    const extendedSweep = topology === 'bass_reflex' || topology === 'transmission_line';
    const pointCount = extendedSweep ? 600 : 150;
    const startHz = extendedSweep ? 10 : 20;
    const frequenciesHz = Array.from({ length: pointCount }, (_, index) => startHz * Math.pow(1000 / startHz, index / (pointCount - 1)));
    const runCanonicalModel = clone(canonicalModel);
    const runIdentity = currentIdentity;
    const runGeneration = generation.current;
    attemptedKey.current = runIdentity;
    const runCanonicalModelSnapshotKey = stableSnapshotKey(runCanonicalModel);

    simulationInFlight.current = true;
    setIsSimulating(true);
    try {
      setRunError(null);
      const result = await runSimulationThin({
        canonicalModel: runCanonicalModel,
        frequenciesHz,
      });
      if (generation.current !== runGeneration || (!draggingRef.current && identityRef.current !== runIdentity)) return;
      setResultRecord({model:runCanonicalModel,data:result,source:currentCanonicalModelSourceKind});
      setSimulationResult(result);
      if (!automatic) { setActiveView('results'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      // lifecycle marker: latest result ownership snapshot
      setLatestResultCanonicalModelSnapshotKey(runCanonicalModelSnapshotKey);
      setLatestResultSourceKind(currentCanonicalModelSourceKind);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Thin runner failed.';
      if (identityRef.current === runIdentity && generation.current === runGeneration) { setRunError(message); if(!draggingRef.current)setForceRecalculate(false); }
    } finally {
      simulationInFlight.current = false;
      setIsSimulating(false);
    }
  }, [canRunSimulation, canonicalModel, currentCanonicalModelSourceKind, graphAssessment.reasons, currentIdentity]);

  useEffect(() => {
    if (simulationResult && !resultLifecycleIsStale) setForceRecalculate(false);
    if (dragging || activeView !== 'results' || (!autoRecalculate && !forceRecalculate) || !canRunSimulation || isSimulating ||
        (simulationResult && !resultLifecycleIsStale) || attemptedKey.current === currentIdentity) return;
    const timer = setTimeout(() => { void handleRunSimulationThin(true); }, 350);
    return () => clearTimeout(timer);
  }, [dragging,forceRecalculate,activeView,autoRecalculate,canRunSimulation,isSimulating,simulationResult,resultLifecycleIsStale,currentIdentity,handleRunSimulationThin]);

  const liveRun = useRef<()=>void>(()=>{});
  liveRun.current=()=>{if(canRunSimulation && !simulationInFlight.current && attemptedKey.current!==currentIdentity) void handleRunSimulationThin(true);};
  useEffect(()=>{
    if(!dragging)return;
    const timer=setInterval(()=>liveRun.current(),120);
    return()=>clearInterval(timer);
  },[dragging]);
  useEffect(()=>{
    if(!graphFocus)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!draggingRef.current)setGraphFocus(false);};
    window.addEventListener('keydown',escape);
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape);};
  },[graphFocus]);



  return (
    <div className="studio-app">
      <div
        style={{
          padding: '12px 15px',
          background: '#282c34',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>OS-LEM Studio</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Loudspeaker simulation • development preview
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge text={formatGraphAssessmentStatus(graphAssessment.status)} tone={statusTone} />
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{ padding: '7px 10px', cursor: canUndo ? 'pointer' : 'not-allowed', borderRadius: 6, border: 'none' }}
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            style={{ padding: '7px 10px', cursor: canRedo ? 'pointer' : 'not-allowed', borderRadius: 6, border: 'none' }}
          >
            Redo
          </button>
          <button
            onClick={handleResetToSeed}
            style={{ padding: '7px 10px', cursor: 'pointer', borderRadius: 6, border: 'none' }}
          >
            {anchorWorkflowCopy.resetLabel}
          </button>
          <button
            onClick={() => void handleRunSimulationThin()}
            disabled={!canRunSimulation || isSimulating}
            aria-busy={isSimulating}
            style={{
              padding: '7px 14px',
              cursor: canRunSimulation ? 'pointer' : 'not-allowed',
              background: canRunSimulation ? '#4CAF50' : '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: 6,
            }}
            title={canRunSimulation ? 'Thin runner executes the current canonical model.' : anchorWorkflowCopy.detail}
          >
            {isSimulating ? 'Simulating…' : runButtonLabel}
          </button>
        </div>
      </div>

      <nav className="workspace-tabs" aria-label="Workspace views">
        {(['model', 'results', 'files'] as const).map((view) => (
          <button key={view} aria-pressed={activeView === view} onClick={() => setActiveView(view)}>
            {view === 'model' ? 'Model' : view === 'results' ? 'Results' : 'Files & details'}
          </button>
        ))}
        <span role="status">{isSimulating ? 'Calculating…' : resultStateLabel}</span>
      </nav>
      {runError ? <div role="alert" className="run-error">{runError}</div> : null}

      <div hidden={activeView !== 'model'} style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <TopologyCard
            title="Closed Box"
            subtitle="Validated runnable anchor"
            status="Editable driver and enclosure parameters"
            active={selectedTopology === 'closed_box'}
            onClick={() => handleTopologySelect('closed_box')}
          />
          <TopologyCard
            title="Bass Reflex"
            subtitle="Vented enclosure"
            status="Editable box and port; combined SPL"
            active={selectedTopology === 'bass_reflex'}
            onClick={() => handleTopologySelect('bass_reflex')}
          />
          <TopologyCard
            title="Transmission Line"
            subtitle="Taper, offset driver and damping"
            status="Editable geometry and attenuation; combined SPL"
            active={selectedTopology === 'transmission_line'}
            onClick={() => handleTopologySelect('transmission_line')}
          />
          <TopologyCard
            title="Horn"
            subtitle="Seed only"
            status="Not runnable in current truthful line"
            active={selectedTopology === 'horn'}
            onClick={() => handleTopologySelect('horn')}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge text={formatGraphAssessmentStatus(graphAssessment.status)} tone={statusTone} />
          <span style={{ fontSize: 13, color: '#475569' }}>{anchorWorkflowCopy.title}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{anchorWorkflowCopy.detail}</div>


      </div>

      {activeView === 'model' && loadedCanonicalModelOverride && (
        <div className="run-error">
          Runs currently use the loaded file. Switch to the graph model before editing these parameters.
          <button onClick={handleClearLoadedCanonicalModel}>Use graph model for editing</button>
        </div>
      )}
      <div hidden={activeView !== 'model'} className="model-workspace">
        <div className="model-canvas">
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleAddChild}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              Insert element
            </button>
            <button
              onClick={handleSplitFirstOutgoingPath}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              Split path
            </button>
            <button
              onClick={handleDeleteSelectedLeaf}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              Delete leaf
            </button>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <div className="model-inspector">
          <fieldset disabled={loadedCanonicalModelOverride !== null} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <h3>Model parameters</h3>{compiledGraph.error && <p role="alert">{compiledGraph.error}</p>}<p>{boxSummary(nodes,selectedTopology)}</p>
          <p>Select “Show in Results” to make parameters available beside the response graph.</p>
          <ParameterPanel parameters={parameters} pins={pins} onPin={togglePin} onChange={changeParameter} />
          {selectedTopology === 'transmission_line' && <p>Linear-area taper; offset must be smaller than line length. Attenuation is damping only (Np/m), with unchanged sound speed, not a material-density model.</p>}
          {selectedTopology !== 'closed_box' && <p>Front radiation area follows driver Sd. Mouth termination is included automatically.</p>}
          </fieldset>


        </div>
      </div>

      {activeView === 'results' && <section className="results-workspace" aria-label="Simulation results">
        <div className={`graph-station ${graphFocus?'graph-focus':''}`}>
          <div className="graph-toolbar">
            <button onClick={()=>setGraphFocus(!graphFocus)} disabled={dragging}>{graphFocus?'Exit full-screen view':'Full-screen graph'}</button>
            <button onClick={()=>void handleRunSimulationThin(true)} disabled={dragging || isSimulating || !canRunSimulation}>Run</button>
            <button onClick={handleUndo} disabled={!canUndo}>Undo last adjustment</button>
            <button onClick={remember} disabled={dragging || isSimulating || !simulationResult || resultLifecycleIsStale || !canRunSimulation || memories.length>=9}>Memorise</button>
            <span role="status">{isSimulating?'Calculating…':resultStateLabel}</span>
          </div>
          {runError && <div role="alert">{runError}</div>}
          {!loadedCanonicalModelOverride && compiledGraph.error && <div role="alert">{compiledGraph.error}</div>}
          <div className="graph-and-pad">
            <div className="results-chart">
              <ChartPanel simulationData={simulationResult} stale={resultLifecycleIsStale && !dragging}
                overlays={chartOverlays} />
            </div>
            <div className="workshop-sidebar"><div className="workshop-mode">
              <button aria-pressed={workshopMode==='tuning'} onClick={()=>setWorkshopMode('tuning')}>Manual tuning</button>
              <button aria-pressed={workshopMode==='optimise'} onClick={()=>setWorkshopMode('optimise')}>Optimise</button></div>
              <div className="workshop-optimisation" hidden={workshopMode!=='optimise'}><BRAlignments workspace={workspace} identity={currentIdentity} disabled={dragging || isSimulating || !canRunSimulation} onPreview={setOptPreview} onApply={applyOptCandidate}/>{selectedTopology==='transmission_line'&&!loadedCanonicalModelOverride?<TLAdaptivePanel workspace={workspace} identity={currentIdentity} disabled={dragging || isSimulating || !canRunSimulation || !simulationResult || resultLifecycleIsStale} onPreview={setOptPreview} onApply={applyOptCandidate}/>:<OptimisationPanel workspace={workspace} identity={currentIdentity} disabled={dragging || isSimulating || !canRunSimulation || !simulationResult || resultLifecycleIsStale}
              onPreview={setOptPreview} onApply={applyOptCandidate}/>}</div><div className="manual-workshop" hidden={workshopMode!=='tuning'}><TuningPad parameters={parameters.filter(p=>pins.includes(p.id))} settings={padSettings} onSettings={setPadSettings}
              disabled={!!loadedCanonicalModelOverride || !canRunSimulation || (!dragging && (isSimulating || !simulationResult || resultLifecycleIsStale))}
              onStart={startGesture} onMove={moveGesture} onEnd={endGesture} onCancel={cancelGesture} />
              <div className="workshop-parameters"><h3>All model parameters</h3><p>{boxSummary(nodes,selectedTopology)}</p>
              {selectedTopology==='transmission_line' && <p className="stuffing-note">Stuffing zones fill the cross-section. Zero density disables a zone. Positions are % of line length from the closed end. Material defaults are illustrative: calibrate density/resistivity before trusting stuffed-line predictions.</p>}
              <ParameterPanel parameters={parameters} pins={pins} disabled={dragging || !!loadedCanonicalModelOverride} onPin={togglePin} onChange={changeParameter}/></div></div>
            </div>
          </div>
        </div>
        <details className="results-tuning">
          <summary>Results parameters</summary>
          <p>Enter a value, then press Enter or leave the field to apply it. These are the same values as in Model.</p>
          <label><input type="checkbox" checked={autoRecalculate} onChange={e=>{setAutoRecalculate(e.target.checked);attemptedKey.current='';}} />Recalculate automatically</label>
          {loadedCanonicalModelOverride && <p>Loaded canonical model is active. Recall an editable graph memory or choose a Model template to tune graph parameters.</p>}
          <ParameterPanel parameters={parameters} pins={pins} results disabled={dragging || !!loadedCanonicalModelOverride} onPin={togglePin} onChange={changeParameter} />
          {!canRunSimulation && <p role="alert">{graphAssessment.reasons[0]}</p>}
        </details>
        <MemoryPanel session={session} canMemorise={!dragging && !!simulationResult && !resultLifecycleIsStale && !isSimulating && canRunSimulation}
          onMemorise={remember} onRecall={id=>restoreSession(recall(session,id))} onChange={changeMemories} onLoad={restoreSession} onError={setSessionError} />
        {sessionError && <p role="alert">{sessionError}</p>}
        {storageError && <p role="alert">{storageError}</p>}
        <SimulationResultExportControls
          simulationResult={simulationResult}
          isStale={resultLifecycleIsStale}
          resultStateLabel={resultStateLabel}
        />
        <div style={{ padding: '10px 12px 0 12px' }}>
          <SimulationWarningsSurface warnings={currentWarnings} isStale={resultLifecycleIsStale} />
        </div>

      </section>}

      <section hidden={activeView !== 'files'} className="files-workspace">
        <CanonicalModelFileControls
          canonicalModel={canonicalModel}
          onLoadCanonicalModel={handleLoadCanonicalModel}
          onLoadCanonicalModelError={handleLoadCanonicalModelError}
          onClearLoadedCanonicalModel={handleClearLoadedCanonicalModel}
          hasLoadedOverride={loadedCanonicalModelOverride !== null}
          loadError={loadError}
        />

        <RunnerStateSummary
          canonicalModelSourceLabel={canonicalModelSourceLabel}
          canonicalModelSourceDetail={canonicalModelSourceDetail}
          resultStateLabel={resultStateLabel}
          resultOwnershipLabel={resultOwnershipLabel}
          warningCount={currentWarnings.length}
          rerunNeeded={rerunNeeded}
        />
        <CanonicalModelInspection canonicalModel={canonicalModel} />
      </section>
    </div>
  );
}
