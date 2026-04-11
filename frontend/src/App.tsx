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

type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

type GraphSnapshot = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
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
    edges: snapshot.edges.map((edge) => ({ ...edge })),
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
      detail: 'The working graph still matches the exact validated Closed Box runnable anchor.',
      runLabel: 'Run Closed Box Anchor',
      resetLabel: 'Reset to exact Closed Box anchor',
    };
  }

  if (topology === 'closed_box' && status === 'composition_not_yet_compilable') {
    return {
      title: 'Closed Box composition mode',
      detail:
        reasons[0] ??
        'Structural edits moved the working graph beyond the exact validated Closed Box anchor. Reset to the stored seed to restore the runnable anchor.',
      runLabel: 'Simulation gated',
      resetLabel: 'Reset to exact Closed Box anchor',
    };
  }

  if (topology === 'closed_box' && status === 'invalid_graph') {
    return {
      title: 'Closed Box anchor invalid',
      detail:
        reasons[0] ??
        'The working graph no longer satisfies the required Closed Box primitive/connection motif. Reset to the stored seed to restore the runnable anchor.',
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

  if (topology === 'transmission_line') {
    return {
      title: 'Seed-only Transmission Line path',
      detail: reasons[0] ?? 'Transmission Line remains seeded but non-runnable in the current truthful line.',
      runLabel: 'Simulation gated',
      resetLabel: 'Reset to Transmission Line seed',
    };
  }

  return {
    title: 'Seed-only Horn path',
    detail: reasons[0] ?? 'Horn remains seeded but non-runnable in the current truthful line.',
    runLabel: 'Simulation gated',
    resetLabel: 'Reset to Horn seed',
  };
}

function getAnchorObservableTruth(topology: TopologyId, status: string, reasons: string[]) {
  if (topology === 'closed_box' && status === 'compilable_anchor') {
    return {
      title: 'Trusted anchor observable basis',
      detail:
        'The exact validated Closed Box anchor currently trusts the manual runtime path for system SPL and impedance magnitude. Other returned observables may still be shown, but they are not the basis of current anchor validation.',
      tone: 'good' as const,
    };
  }

  if (topology === 'closed_box') {
    return {
      title: 'Observable/runtime trust dropped',
      detail:
        reasons[0] ??
        'The working graph no longer matches the exact validated Closed Box anchor, so Studio drops from trusted anchor observables to gated or composition-mode truth.',
      tone: 'warning' as const,
    };
  }

  if (topology === 'bass_reflex') {
    return {
      title: 'No validated BR system observable path yet',
      detail:
        reasons[0] ??
        'Bass Reflex remains seeded and gated because the current truthful line still lacks a validated first-class combined BR system SPL path.',
      tone: 'warning' as const,
    };
  }

  if (topology === 'transmission_line') {
    return {
      title: 'No validated observable/runtime path',
      detail: 'Transmission Line remains seed-only and non-runnable in the current truthful line.',
      tone: 'neutral' as const,
    };
  }

  return {
    title: 'No validated observable/runtime path',
    detail: 'Horn remains seed-only and non-runnable in the current truthful line.',
    tone: 'neutral' as const,
  };
}

function nextNodeId(nodes: ReactFlowNode[], prefix: string): string {
  let index = 1;
  const existing = new Set(nodes.map((node) => node.id));
  while (existing.has(`${prefix}_${index}`)) {
    index += 1;
  }
  return `${prefix}_${index}`;
}

export default function App() {
  const initialSeed = useMemo(() => seedTemplateGraph('closed_box'), []);
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [seedGraph, setSeedGraph] = useState<GraphSnapshot>(cloneGraphSnapshot(initialSeed));
  const [nodes, setNodes] = useState<ReactFlowNode[]>(cloneGraphSnapshot(initialSeed).nodes);
  const [edges, setEdges] = useState<ReactFlowEdge[]>(cloneGraphSnapshot(initialSeed).edges);
  const [history, setHistory] = useState<GraphSnapshot[]>([cloneGraphSnapshot(initialSeed)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node_driver_1');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const canvasNodes = useMemo(() => nodes.map(toCanvasNode), [nodes]);
  const canvasEdges = useMemo(() => edges.map(toCanvasEdge), [edges]);

  const [loadedCanonicalModel, setLoadedCanonicalModel] = useState<Record<string, unknown> | null>(null);
  const [canonicalModelLoadError, setCanonicalModelLoadError] = useState<string | null>(null);
  const graphDerivedCanonicalModel = useMemo(() => buildModelDict(canvasNodes, canvasEdges), [canvasNodes, canvasEdges]);
  const canonicalModel = useMemo(
    () => loadedCanonicalModel ?? graphDerivedCanonicalModel,
    [loadedCanonicalModel, graphDerivedCanonicalModel],
  );
  const seedCanvasGraph = useMemo(
    () => ({
      nodes: seedGraph.nodes.map(toCanvasNode),
      edges: seedGraph.edges.map(toCanvasEdge),
    }),
    [seedGraph],
  );

  const graphAssessment = useMemo(
    () =>
      assessGraphCompilability({
        topology: selectedTopology,
        nodes: canvasNodes,
        edges: canvasEdges,
        seedGraph: seedCanvasGraph,
      }),
    [selectedTopology, canvasNodes, canvasEdges, seedCanvasGraph],
  );

  const statusLabel = useMemo(
    () => formatGraphAssessmentStatus(graphAssessment.status),
    [graphAssessment.status],
  );
  const anchorWorkflow = useMemo(
    () => getAnchorWorkflowCopy(selectedTopology, graphAssessment.status, graphAssessment.reasons),
    [selectedTopology, graphAssessment.status, graphAssessment.reasons],
  );
  const anchorObservableTruth = useMemo(
    () => getAnchorObservableTruth(selectedTopology, graphAssessment.status, graphAssessment.reasons),
    [selectedTopology, graphAssessment.status, graphAssessment.reasons],
  );
  const canRunSimulation = graphAssessment.status === 'compilable_anchor';
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const setWorkingGraphFromSnapshot = useCallback((snapshot: GraphSnapshot) => {
    const cloned = cloneGraphSnapshot(snapshot);
    setNodes(cloned.nodes);
    setEdges(cloned.edges);
    setSelectedNodeId(cloned.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
  }, []);



  const commitGraphSnapshot = useCallback(
    (snapshot: GraphSnapshot, options?: { recordHistory?: boolean; clearSimulation?: boolean }) => {
      const cloned = cloneGraphSnapshot(snapshot);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      setSelectedNodeId(cloned.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      if (options?.clearSimulation ?? true) {
        setSimulationResult(null);
      }
      if (options?.recordHistory ?? true) {
        setHistory((currentHistory) => {
          const truncated = currentHistory.slice(0, historyIndex + 1);
          const next = [...truncated, cloneGraphSnapshot(cloned)];
          if (next.length > HISTORY_LIMIT) {
            return next.slice(next.length - HISTORY_LIMIT);
          }
          return next;
        });
        setHistoryIndex(() => {
          const nextLength = Math.min(historyIndex + 2, HISTORY_LIMIT);
          return nextLength - 1;
        });
      }
    },
    [historyIndex],
  );

  const resetToTopologySeed = useCallback(
    (topology: TopologyId) => {
      const seeded = seedTemplateGraph(topology);
      setSelectedTopology(topology);
      setSeedGraph(cloneGraphSnapshot(seeded));
      setWorkingGraphFromSnapshot(seeded);
      setHistory([cloneGraphSnapshot(seeded)]);
      setHistoryIndex(0);
      setSimulationResult(null);
    },
    [setWorkingGraphFromSnapshot],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const nextEdges = addEdge(params, edges);
      commitGraphSnapshot({ nodes, edges: nextEdges });
    },
    [commitGraphSnapshot, edges, nodes],
  );

  const onSelectionChange = useCallback((params: { nodes?: ReactFlowNode[]; edges?: ReactFlowEdge[] }) => {
    const selectedNodes = Array.isArray(params?.nodes) ? params.nodes : [];
    const selectedEdges = Array.isArray(params?.edges) ? params.edges : [];
    setSelectedNodeId(selectedNodes[0]?.id ?? null);
    setSelectedEdgeId(selectedEdges[0]?.id ?? null);
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const nextIndex = historyIndex - 1;
    const snapshot = history[nextIndex];
    if (!snapshot) return;
    setHistoryIndex(nextIndex);
    setWorkingGraphFromSnapshot(snapshot);
    setSimulationResult(null);
  }, [canUndo, history, historyIndex, setWorkingGraphFromSnapshot]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    if (!snapshot) return;
    setHistoryIndex(nextIndex);
    setWorkingGraphFromSnapshot(snapshot);
    setSimulationResult(null);
  }, [canRedo, history, historyIndex, setWorkingGraphFromSnapshot]);

  const handleResetToSeed = useCallback(() => {
    commitGraphSnapshot(seedGraph, { recordHistory: true, clearSimulation: true });
  }, [commitGraphSnapshot, seedGraph]);

  const updateNodeData = useCallback(
    (id: string, newData: any) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === id ? { ...node, data: newData } : node)),
      );
      setSimulationResult(null);
    },
    [],
  );

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === id ? { ...node, data: { ...(node.data ?? {}), ...patch } } : node,
        ),
      );
      setSimulationResult(null);
    },
    [],
  );

  const attachChildToSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return;

    const childId = nextNodeId(nodes, 'node_branch_volume');
    const nextNodes = [
      ...nodes,
      {
        id: childId,
        type: 'default',
        position: {
          x: Number(selectedNode.position.x) + 200,
          y: Number(selectedNode.position.y) + 110,
        },
        data: {
          type: 'volume',
          label: 'Branch Volume',
          Vb: 8,
        },
      } as ReactFlowNode,
    ];

    const nextEdges = [
      ...edges,
      {
        id: nextNodeId(nodes, 'edge_branch'),
        source: selectedNode.id,
        target: childId,
      } as ReactFlowEdge,
    ];

    commitGraphSnapshot({ nodes: nextNodes, edges: nextEdges });
  }, [commitGraphSnapshot, edges, nodes, selectedNodeId]);

  const splitSelectedPath = useCallback(() => {
    if (!selectedEdgeId) return;
    const targetEdge = edges.find((edge) => edge.id === selectedEdgeId);
    if (!targetEdge) return;

    const splitNodeId = nextNodeId(nodes, 'node_split_duct');
    const nextNodes = [
      ...nodes,
      {
        id: splitNodeId,
        type: 'default',
        position: {
          x: 0.5 * (
            Number(nodes.find((node) => node.id === targetEdge.source)?.position.x ?? 0) +
            Number(nodes.find((node) => node.id === targetEdge.target)?.position.x ?? 0)
          ),
          y: 0.5 * (
            Number(nodes.find((node) => node.id === targetEdge.source)?.position.y ?? 0) +
            Number(nodes.find((node) => node.id === targetEdge.target)?.position.y ?? 0)
          ),
        },
        data: {
          type: 'duct',
          label: 'Inserted Duct',
          areaCm2: 40,
          lengthCm: 12,
        },
      } as ReactFlowNode,
    ];

    const nextEdges = edges
      .filter((edge) => edge.id !== targetEdge.id)
      .concat([
        {
          id: `${targetEdge.id}_a`,
          source: targetEdge.source,
          target: splitNodeId,
        } as ReactFlowEdge,
        {
          id: `${targetEdge.id}_b`,
          source: splitNodeId,
          target: targetEdge.target,
        } as ReactFlowEdge,
      ]);

    commitGraphSnapshot({ nodes: nextNodes, edges: nextEdges });
  }, [commitGraphSnapshot, edges, nodes, selectedEdgeId]);

  const deleteSelectedLeaf = useCallback(() => {
    if (!selectedNodeId) return;
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return;

    const protectedIds = new Set(seedGraph.nodes.map((node) => node.id));
    const hasOutgoingEdge = edges.some((edge) => edge.source === selectedNode.id);
    if (protectedIds.has(selectedNode.id) || hasOutgoingEdge) {
      return;
    }

    const nextNodes = nodes.filter((node) => node.id !== selectedNode.id);
    const nextEdges = edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id);

    commitGraphSnapshot({ nodes: nextNodes, edges: nextEdges });
  }, [commitGraphSnapshot, edges, nodes, seedGraph.nodes, selectedNodeId]);

  const handleSimulate = useCallback(async () => {
    if (!canRunSimulation) {
      alert(graphAssessment.reasons[0] ?? 'This graph is not on a validated runnable path in the current line.');
      return;
    }

    const frequencies = Array.from({ length: 150 }, (_, index) => 20 * Math.pow(1000 / 20, index / 149));
    const canonicalModel = buildModelDict(canvasNodes, canvasEdges);
    try {
      const simulationData = await runSimulationThin({ canonicalModel, frequenciesHz: frequencies });
      console.debug('[thin-runner proof path] canonicalModel -> backend -> numeric curves', simulationData);
      setSimulationResult(simulationData);
    } catch (_error) {
      alert('Failed to connect to backend.');
    }
  }, [canRunSimulation, canvasEdges, canvasNodes, graphAssessment.reasons]);

  const selectedCanvasNode = useMemo<CanvasNode | null>(() => {
    const selected = nodes.find((node) => node.id === selectedNodeId);
    return selected ? toCanvasNode(selected) : null;
  }, [nodes, selectedNodeId]);

  const driverNode = useMemo(() => nodes.find((node) => node.data?.type === 'driver') ?? null, [nodes]);
  const volumeNode = useMemo(() => nodes.find((node) => node.id === 'node_volume_1') ?? null, [nodes]);
  const radiatorNode = useMemo(() => nodes.find((node) => node.id === 'node_radiator_1') ?? null, [nodes]);
  const portNode = useMemo(() => nodes.find((node) => node.id === 'node_port_1') ?? null, [nodes]);

  const statusTone =
    graphAssessment.status === 'compilable_anchor'
      ? 'good'
      : graphAssessment.status === 'invalid_graph'
        ? 'bad'
        : 'warning';

  const renderClosedBoxEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode) {
      return <div style={{ color: '#991b1b' }}>Closed Box seed motif is incomplete.</div>;
    }

    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Closed Box Seed Editor</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            This guided panel edits the current working graph while Closed Box remains the validated runnable anchor.
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Driver</div>
          <LabeledInput
            label="Label"
            value={String(driverNode.data?.label ?? '')}
            onChange={(value) => patchNodeData(driverNode.id, { label: value || 'Driver' })}
          />
          <LabeledInput
            label="Re"
            value={Number(driverNode.data?.Re ?? 5.0)}
            suffix="ohm"
            onChange={(value) => patchNodeData(driverNode.id, { Re: parsePositiveNumber(value, 5.0) })}
          />
          <LabeledInput
            label="Le"
            value={Number(driverNode.data?.Le ?? 1.4)}
            suffix="mH"
            onChange={(value) => patchNodeData(driverNode.id, { Le: parsePositiveNumber(value, 1.4) })}
          />
          <LabeledInput
            label="Sd"
            value={Number(driverNode.data?.Sd ?? 531)}
            suffix="cm²"
            onChange={(value) => patchNodeData(driverNode.id, { Sd: parsePositiveNumber(value, 531) })}
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Rear Chamber</div>
          <LabeledInput
            label="Volume"
            value={Number(volumeNode.data?.Vb ?? 50)}
            suffix="liters"
            onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 50) })}
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Front Radiation</div>
          <LabeledInput
            label="Label"
            value={String(radiatorNode.data?.label ?? '')}
            onChange={(value) => patchNodeData(radiatorNode.id, { label: value || 'Front Radiation' })}
          />
          <LabeledInput
            label="Radiating Area"
            value={Number(radiatorNode.data?.Sd ?? 531)}
            suffix="cm²"
            onChange={(value) => patchNodeData(radiatorNode.id, { Sd: parsePositiveNumber(value, 531) })}
          />
        </div>
      </>
    );
  };

  const renderBassReflexEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode || !portNode) {
      return <div style={{ color: '#991b1b' }}>Bass Reflex seed motif is incomplete.</div>;
    }

    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Bass Reflex Seed Editor</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            Bass Reflex is a seeded graph path in this line. The graph is editable, but runtime remains gated until a
            truthful graph-to-kernel path is validated.
          </div>
        </div>

        <LabeledInput
          label="Rear Chamber Volume"
          value={Number(volumeNode.data?.Vb ?? 65)}
          suffix="liters"
          onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 65) })}
        />
        <LabeledInput
          label="Port Area"
          value={Number(portNode.data?.areaCm2 ?? 120)}
          suffix="cm²"
          onChange={(value) => patchNodeData(portNode.id, { areaCm2: parsePositiveNumber(value, 120) })}
        />
        <LabeledInput
          label="Port Length"
          value={Number(portNode.data?.lengthCm ?? 20)}
          suffix="cm"
          onChange={(value) => patchNodeData(portNode.id, { lengthCm: parsePositiveNumber(value, 20) })}
        />
        <LabeledInput
          label="Front Radiation Area"
          value={Number(radiatorNode.data?.Sd ?? 531)}
          suffix="cm²"
          onChange={(value) => patchNodeData(radiatorNode.id, { Sd: parsePositiveNumber(value, 531) })}
        />
      </>
    );
  };

  const renderPlaceholderEditor = (title: string, note: string) => (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{note}</div>
    </>
  );

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}>
      <div
        style={{
          padding: '14px 16px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <strong>os-lem Studio</strong>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Template-seeded acoustic topology composition workbench
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StatusBadge text={statusLabel} tone={statusTone} />
          <button
            onClick={handleSimulate}
            disabled={!canRunSimulation}
            title={canRunSimulation ? 'Run exact validated Closed Box anchor' : graphAssessment.reasons.join(' | ')}
            style={{
              padding: '8px 14px',
              cursor: canRunSimulation ? 'pointer' : 'not-allowed',
              background: canRunSimulation ? '#22c55e' : '#94a3b8',
              color: 'white',
              border: 'none',
              borderRadius: 6,
            }}
          >
            {anchorWorkflow.runLabel}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <TopologyCard
            title="Closed Box"
            subtitle="Validated runnable anchor"
            status="supported"
            active={selectedTopology === 'closed_box'}
            onClick={() => resetToTopologySeed('closed_box')}
          />
          <TopologyCard
            title="Bass Reflex"
            subtitle="Seeded graph path"
            status="gated"
            active={selectedTopology === 'bass_reflex'}
            onClick={() => resetToTopologySeed('bass_reflex')}
          />
          <TopologyCard
            title="Transmission Line"
            subtitle="Seed only"
            status="upcoming"
            active={selectedTopology === 'transmission_line'}
            onClick={() => resetToTopologySeed('transmission_line')}
          />
          <TopologyCard
            title="Horn"
            subtitle="Seed only"
            status="upcoming"
            active={selectedTopology === 'horn'}
            onClick={() => resetToTopologySeed('horn')}
          />
        </div>
        <div style={{ fontSize: 13, color: '#334155' }}>
          Templates seed an initial graph. The editable graph is the real working object; runtime eligibility now comes
          from a single graph-to-kernel compilability assessment.
        </div>
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: selectedTopology === 'closed_box' && canRunSimulation ? '#ecfdf5' : '#fff7ed',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{anchorWorkflow.title}</div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{anchorWorkflow.detail}</div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid #cbd5e1',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{anchorObservableTruth.title}</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{anchorObservableTruth.detail}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, minHeight: 0, borderBottom: '1px solid #cbd5e1' }}>
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
          <div style={{ height: '38%', minHeight: 220, background: '#fff' }}>
            <SimulationResultExportControls simulationResult={simulationResult} />
        <>
            <SimulationWarningsSurface warnings={Array.isArray(simulationResult?.warnings) ? simulationResult.warnings : []} />
            <ChartPanel simulationData={simulationResult} />
          </>
        <CanonicalModelFileControls
          canonicalModel={canonicalModel as Record<string, unknown>}
          onLoadCanonicalModel={(model) => {
            setLoadedCanonicalModel(model);
            setCanonicalModelLoadError(null);
          }}
          onLoadCanonicalModelError={(message) => {
            setCanonicalModelLoadError(message);
          }}
          onClearLoadedCanonicalModel={() => {
            setLoadedCanonicalModel(null);
            setCanonicalModelLoadError(null);
          }}
          hasLoadedOverride={loadedCanonicalModel !== null}
          loadError={canonicalModelLoadError}
        />
        <CanonicalModelInspection canonicalModel={canonicalModel} />
          </div>
        </div>

        <div
          style={{
            width: 380,
            borderLeft: '1px solid #cbd5e1',
            background: '#fff',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Compiler Boundary</div>
            <div style={{ marginBottom: 8 }}>
              <StatusBadge text={statusLabel} tone={statusTone} />
            </div>
            <div style={{ marginBottom: 10, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              <strong>{anchorWorkflow.title}:</strong> {anchorWorkflow.detail}
            </div>
            <div style={{ marginBottom: 10, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              <strong>{anchorObservableTruth.title}:</strong> {anchorObservableTruth.detail}
            </div>
            <ul style={{ paddingLeft: 18, margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
              {graphAssessment.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Graph History</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: canUndo ? '#fff' : '#f1f5f9',
                  cursor: canUndo ? 'pointer' : 'not-allowed',
                }}
              >
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: canRedo ? '#fff' : '#f1f5f9',
                  cursor: canRedo ? 'pointer' : 'not-allowed',
                }}
              >
                Redo
              </button>
              <button
                onClick={handleResetToSeed}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                {anchorWorkflow.resetLabel}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              Seed snapshot is preserved separately from the working graph. Structural edits operate on the working
              graph only.
            </div>
          </div>

          <div style={{ marginBottom: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Structural Editing</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={attachChildToSelectedNode}
                disabled={!selectedNodeId}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: selectedNodeId ? '#fff' : '#f1f5f9',
                  cursor: selectedNodeId ? 'pointer' : 'not-allowed',
                }}
              >
                Insert Element
              </button>
              <button
                onClick={splitSelectedPath}
                disabled={!selectedEdgeId}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: selectedEdgeId ? '#fff' : '#f1f5f9',
                  cursor: selectedEdgeId ? 'pointer' : 'not-allowed',
                }}
              >
                Split Path
              </button>
              <button
                onClick={deleteSelectedLeaf}
                disabled={!selectedNodeId}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: selectedNodeId ? '#fff' : '#f1f5f9',
                  cursor: selectedNodeId ? 'pointer' : 'not-allowed',
                }}
              >
                Delete Leaf
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              Structural edits are allowed, but they immediately move runtime truth to whatever the compiler-boundary
              assessment now reports.
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 18 }}>
            {selectedTopology === 'closed_box'
              ? renderClosedBoxEditor()
              : selectedTopology === 'bass_reflex'
                ? renderBassReflexEditor()
                : selectedTopology === 'transmission_line'
                  ? renderPlaceholderEditor(
                      'Transmission Line Seed',
                      'Transmission Line remains a seed-only graph path in this line.',
                    )
                  : renderPlaceholderEditor('Horn Seed', 'Horn remains a seed-only graph path in this line.')}
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Selected Node Inspector</div>
            <Inspector selectedNode={selectedCanvasNode} updateNodeData={updateNodeData} />
          </div>
        </div>
      </div>
    </div>
  );
}
