import { useCallback, useMemo, useState } from 'react';
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
import Inspector from './Inspector';
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

const closedBoxTemplate: GraphSnapshot = {
  nodes: [
    {
      id: 'node_driver_1',
      type: 'default',
      position: { x: 250, y: 150 },
      data: {
        type: 'driver',
        label: '12NW100 Driver',
        model: 'ts_classic',
        Sd: 531,
        Bl: 21.3,
        Re: 5.0,
        Mms: 94,
        Cms: 0.15,
        Rms: 4.1,
        Le: 1.4,
      },
    },
    {
      id: 'node_volume_1',
      type: 'default',
      position: { x: 500, y: 50 },
      data: {
        type: 'volume',
        label: 'Rear Chamber',
        Vb: 50.0,
      },
    },
    {
      id: 'node_radiator_1',
      type: 'default',
      position: { x: 500, y: 250 },
      data: {
        type: 'radiator',
        label: 'Front Radiation',
        model: 'infinite_baffle_piston',
        Sd: 531,
      },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' },
    { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' },
  ],
};

const bassReflexTemplate: GraphSnapshot = {
  nodes: [
    {
      id: 'node_driver_1',
      type: 'default',
      position: { x: 240, y: 160 },
      data: {
        type: 'driver',
        label: '12NW100 Driver',
        model: 'ts_classic',
        Sd: 531,
        Bl: 21.3,
        Re: 5.0,
        Mms: 94,
        Cms: 0.15,
        Rms: 4.1,
        Le: 1.4,
      },
    },
    {
      id: 'node_volume_1',
      type: 'default',
      position: { x: 500, y: 50 },
      data: {
        type: 'volume',
        label: 'Rear Chamber',
        Vb: 65.0,
      },
    },
    {
      id: 'node_port_1',
      type: 'default',
      position: { x: 520, y: 165 },
      data: {
        type: 'duct',
        label: 'Port',
        areaCm2: 120,
        lengthCm: 20,
      },
    },
    {
      id: 'node_radiator_1',
      type: 'default',
      position: { x: 520, y: 285 },
      data: {
        type: 'radiator',
        label: 'Front Radiation',
        model: 'infinite_baffle_piston',
        Sd: 531,
      },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' },
    { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' },
    { id: 'edge-3', source: 'node_volume_1', target: 'node_port_1' },
  ],
};

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
          ? placeholderTemplate('Transmission Line seed')
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

function parsePositiveNumber(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

function LabeledInput({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
          }}
        />
        {suffix ? <span style={{ fontSize: 12, color: '#64748b' }}>{suffix}</span> : null}
      </div>
    </label>
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
  if (topology === 'closed_box' && status === 'compilable_anchor') {
    return {
      title: 'Validated Closed Box anchor',
      detail: 'The graph matches the exact validated Closed Box seed and remains the truthful runnable anchor workflow.',
      runLabel: 'Run Closed Box Anchor',
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
      title: 'Seeded but gated Bass Reflex path',
      detail: reasons[0] ?? 'Bass Reflex remains explicitly gated in the current truthful line.',
      runLabel: 'Simulation gated',
      resetLabel: 'Reset to Bass Reflex seed',
    };
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

export default function App() {
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [seedGraph, setSeedGraph] = useState<GraphSnapshot>(() => cloneGraphSnapshot(initialSeedGraph));
  const [nodes, setNodes] = useState<ReactFlowNode[]>(() => cloneGraphSnapshot(initialSeedGraph).nodes);
  const [edges, setEdges] = useState<ReactFlowEdge[]>(() => cloneGraphSnapshot(initialSeedGraph).edges);
  const [historyState, setHistoryState] = useState<HistoryState>(() => ({
    snapshots: [cloneGraphSnapshot(initialSeedGraph)],
    index: 0,
  }));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSeedGraph.nodes[0]?.id ?? null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [latestResultCanonicalModelSnapshotKey, setLatestResultCanonicalModelSnapshotKey] = useState<string | null>(null);
  const [loadedCanonicalModelOverride, setLoadedCanonicalModelOverride] = useState<Record<string, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const currentGraph = useMemo<GraphSnapshot>(() => cloneGraphSnapshot({ nodes, edges }), [nodes, edges]);
  const canvasNodes = useMemo(() => nodes.map(toCanvasNode), [nodes]);
  const canvasEdges = useMemo(() => edges.map(toCanvasEdge), [edges]);
  const graphDerivedCanonicalModel = useMemo(
    () => buildModelDict(canvasNodes, canvasEdges),
    [canvasNodes, canvasEdges],
  );

  // lifecycle marker: canonical model snapshot key used for result ownership
  const canonicalModel = loadedCanonicalModelOverride ?? graphDerivedCanonicalModel;
  const canonicalModelSnapshotKey = useMemo(() => stableSnapshotKey(canonicalModel), [canonicalModel]);
  const resultLifecycleIsAbsent = simulationResult == null;
  const resultLifecycleIsCurrent = !resultLifecycleIsAbsent && latestResultCanonicalModelSnapshotKey === canonicalModelSnapshotKey;
  const resultLifecycleIsStale = !resultLifecycleIsAbsent && latestResultCanonicalModelSnapshotKey !== canonicalModelSnapshotKey;
  const rerunNeeded = resultLifecycleIsStale;

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

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.snapshots.length - 1;
  const currentWarnings = Array.isArray(simulationResult?.warnings)
    ? simulationResult.warnings.filter((warning: unknown) => typeof warning === 'string' && warning.trim().length > 0)
    : [];

  const canonicalModelSourceLabel = loadedCanonicalModelOverride
    ? 'Loaded canonical model override active'
    : 'Graph-derived canonical model active';
  const resultStateLabel = resultLifecycleIsAbsent
    ? 'No result yet'
    : resultLifecycleIsCurrent
      ? 'Current result available'
      : 'Stale result — rerun needed';
  const resultOwnershipLabel = resultLifecycleIsAbsent
    ? 'No canonical model snapshot recorded yet'
    : resultLifecycleIsCurrent
      ? 'Latest result matches current canonical model snapshot'
      : 'Latest result belongs to an earlier canonical model snapshot';

  const anchorWorkflowCopy = getAnchorWorkflowCopy(selectedTopology, graphAssessment.status, graphAssessment.reasons ?? []);
  const statusTone: 'good' | 'warning' | 'bad' | 'neutral' =
    graphAssessment.status === 'compilable_anchor'
      ? 'good'
      : graphAssessment.status === 'invalid_graph'
        ? 'bad'
        : 'warning';

  const canRunSimulation = Boolean(loadedCanonicalModelOverride) || graphAssessment.status === 'compilable_anchor';
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
      setSelectedTopology(topology);
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

  const updateNodeData = useCallback(
    (id: string, newData: any) => {
      const nextNodes = nodes.map((node) => (node.id === id ? { ...node, data: newData } : node));
      replaceWorkingGraph({ nodes: nextNodes, edges }, { recordHistory: true });
    },
    [nodes, edges, replaceWorkingGraph],
  );

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const nextNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...(node.data ?? {}), ...patch } } : node,
      );
      replaceWorkingGraph({ nodes: nextNodes, edges }, { recordHistory: true });
    },
    [nodes, edges, replaceWorkingGraph],
  );

  const handleUndo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index === 0) return prev;
      const nextIndex = prev.index - 1;
      const snapshot = cloneGraphSnapshot(prev.snapshots[nextIndex]);
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      return { ...prev, index: nextIndex };
    });
  }, []);

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

  const selectedCanvasNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => node.id === selectedNodeId);
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes, selectedNodeId]);

  const driverNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => String(node.id) === 'node_driver_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const volumeNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => String(node.id) === 'node_volume_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const radiatorNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => String(node.id) === 'node_radiator_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const portNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => String(node.id) === 'node_port_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

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

  const handleRunSimulationThin = useCallback(async () => {
    if (!canRunSimulation) {
      setRunError(graphAssessment.reasons?.[0] ?? 'Simulation is currently gated by compiler-boundary truth.');
      return;
    }

    const frequenciesHz = Array.from({ length: 150 }, (_, index) => 20 * Math.pow(1000 / 20, index / 149));
    const runCanonicalModel = canonicalModel;
    const runCanonicalModelSnapshotKey = stableSnapshotKey(runCanonicalModel);

    try {
      setRunError(null);
      const result = await runSimulationThin({
        canonicalModel: runCanonicalModel,
        frequenciesHz,
      });
      setSimulationResult(result);
      // lifecycle marker: latest result ownership snapshot
      setLatestResultCanonicalModelSnapshotKey(runCanonicalModelSnapshotKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Thin runner failed.';
      setRunError(message);
    }
  }, [canRunSimulation, canonicalModel, graphAssessment.reasons]);

  const renderTopologyEditor = () => {
    if (selectedTopology === 'closed_box' && driverNode && volumeNode && radiatorNode) {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Closed Box Seed Editor</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              This seed remains the truthful runnable anchor only while the graph still matches the exact validated pattern.
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Driver</div>
            <LabeledInput
              label="Label"
              value={driverNode.data.label ?? ''}
              onChange={(value) => patchNodeData(driverNode.id, { label: value || 'Driver' })}
            />
            <LabeledInput
              label="Re"
              value={driverNode.data.Re ?? 5.0}
              suffix="ohm"
              onChange={(value) => patchNodeData(driverNode.id, { Re: parsePositiveNumber(value, 5.0) })}
            />
            <LabeledInput
              label="Le"
              value={driverNode.data.Le ?? 1.4}
              suffix="mH"
              onChange={(value) => patchNodeData(driverNode.id, { Le: parsePositiveNumber(value, 1.4) })}
            />
            <LabeledInput
              label="Sd"
              value={driverNode.data.Sd ?? 531}
              suffix="cm²"
              onChange={(value) => patchNodeData(driverNode.id, { Sd: parsePositiveNumber(value, 531) })}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Rear Chamber</div>
            <LabeledInput
              label="Volume"
              value={volumeNode.data.Vb ?? 50}
              suffix="liters"
              onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 50) })}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Front Radiation</div>
            <LabeledInput
              label="Label"
              value={radiatorNode.data.label ?? ''}
              onChange={(value) => patchNodeData(radiatorNode.id, { label: value || 'Front Radiation' })}
            />
            <LabeledInput
              label="Radiating Area"
              value={radiatorNode.data.Sd ?? 531}
              suffix="cm²"
              onChange={(value) => patchNodeData(radiatorNode.id, { Sd: parsePositiveNumber(value, 531) })}
            />
          </div>
        </>
      );
    }

    if (selectedTopology === 'bass_reflex' && driverNode && volumeNode && radiatorNode && portNode) {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Bass Reflex Seed Editor</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              Bass Reflex remains a seeded and inspectable canonical-model path, but it is still gated in the current truthful line.
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Driver</div>
            <LabeledInput
              label="Label"
              value={driverNode.data.label ?? ''}
              onChange={(value) => patchNodeData(driverNode.id, { label: value || 'Driver' })}
            />
            <LabeledInput
              label="Re"
              value={driverNode.data.Re ?? 5.0}
              suffix="ohm"
              onChange={(value) => patchNodeData(driverNode.id, { Re: parsePositiveNumber(value, 5.0) })}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Rear Chamber</div>
            <LabeledInput
              label="Volume"
              value={volumeNode.data.Vb ?? 65}
              suffix="liters"
              onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 65) })}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Port</div>
            <LabeledInput
              label="Port Area"
              value={portNode.data.areaCm2 ?? 120}
              suffix="cm²"
              onChange={(value) => patchNodeData(portNode.id, { areaCm2: parsePositiveNumber(value, 120) })}
            />
            <LabeledInput
              label="Port Length"
              value={portNode.data.lengthCm ?? 20}
              suffix="cm"
              onChange={(value) => patchNodeData(portNode.id, { lengthCm: parsePositiveNumber(value, 20) })}
            />
          </div>
        </>
      );
    }

    return (
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
        This topology is visible as a seed direction only. It is not runnable in the current truthful line.
      </div>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}>
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
          <div style={{ fontWeight: 700 }}>os-lem Studio — Canonical Model Thin Runner</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Canonical model is the primary truth. Thin-runner results are owned by a canonical model snapshot.
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
            onClick={handleRunSimulationThin}
            disabled={!canRunSimulation}
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
            {runButtonLabel}
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <TopologyCard
            title="Closed Box"
            subtitle="Validated runnable anchor"
            status="Exact seed match remains runnable"
            active={selectedTopology === 'closed_box'}
            onClick={() => handleTopologySelect('closed_box')}
          />
          <TopologyCard
            title="Bass Reflex"
            subtitle="Seeded but gated"
            status="Canonical model path visible, runtime still gated"
            active={selectedTopology === 'bass_reflex'}
            onClick={() => handleTopologySelect('bass_reflex')}
          />
          <TopologyCard
            title="Transmission Line"
            subtitle="Seed only"
            status="Not runnable in current truthful line"
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
        {runError ? <div style={{ marginTop: 8, fontSize: 12, color: '#991b1b' }}>{runError}</div> : null}

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
          resultStateLabel={resultStateLabel}
          resultOwnershipLabel={resultOwnershipLabel}
          warningCount={currentWarnings.length}
          rerunNeeded={rerunNeeded}
        />
      </div>

      <div style={{ display: 'flex', height: '52%', borderBottom: '1px solid #cbd5e1' }}>
        <div style={{ flex: 1, position: 'relative' }}>
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

        <div style={{ width: 360, borderLeft: '1px solid #e2e8f0', padding: 16, overflowY: 'auto', background: '#fff' }}>
          {renderTopologyEditor()}

          <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Graph editor surface</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
              The graph is the working object. Structural edits affect the working graph only, while Reset to Seed restores the stored template seed snapshot.
            </div>
            <Inspector selectedNode={selectedCanvasNode} updateNodeData={updateNodeData} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <SimulationResultExportControls
          simulationResult={simulationResult}
          isStale={resultLifecycleIsStale}
          resultStateLabel={resultStateLabel}
        />
        <div style={{ padding: '10px 12px 0 12px' }}>
          <SimulationWarningsSurface warnings={currentWarnings} isStale={resultLifecycleIsStale} />
        </div>
        <div style={{ flex: 1 }}>
          <ChartPanel simulationData={simulationResult} />
        </div>
      </div>

      <CanonicalModelInspection canonicalModel={canonicalModel} />
    </div>
  );
}
