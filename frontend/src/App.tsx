import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ReactFlow, {
  Background,
  Connection,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import 'reactflow/dist/style.css';
import Inspector from './Inspector';
import ChartPanel from './ChartPanel';
import { buildModelDict } from './translator';
import type { CanvasEdge, CanvasNode } from './types';

type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

type TemplateGraph = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
};

type GraphSnapshot = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  selectedNodeId: string | null;
};

type HistoryState = {
  stack: GraphSnapshot[];
  index: number;
};

const HISTORY_LIMIT = 40;

const closedBoxTemplate: TemplateGraph = {
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

const bassReflexTemplate: TemplateGraph = {
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

const placeholderTemplate = (label: string): TemplateGraph => ({
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
});

function cloneNodes(nodes: ReactFlowNode[]): ReactFlowNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...(node.data ?? {}) },
  }));
}

function cloneEdges(edges: ReactFlowEdge[]): ReactFlowEdge[] {
  return edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...(edge.data as Record<string, unknown>) } : edge.data,
  }));
}

function cloneSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return {
    nodes: cloneNodes(snapshot.nodes),
    edges: cloneEdges(snapshot.edges),
    selectedNodeId: snapshot.selectedNodeId,
  };
}

function withSeedMetadata(topology: TopologyId, template: TemplateGraph): TemplateGraph {
  return {
    nodes: cloneNodes(template.nodes).map((node) => ({
      ...node,
      data: {
        ...(node.data ?? {}),
        _seedTopology: topology,
        _seedAnchor: true,
      },
    })),
    edges: cloneEdges(template.edges).map((edge) => ({
      ...edge,
      data: {
        ...(edge.data as Record<string, unknown> | undefined),
        _seedTopology: topology,
      },
    })),
  };
}

function getTemplateGraph(topology: TopologyId): TemplateGraph {
  if (topology === 'closed_box') {
    return withSeedMetadata('closed_box', closedBoxTemplate);
  }
  if (topology === 'bass_reflex') {
    return withSeedMetadata('bass_reflex', bassReflexTemplate);
  }
  if (topology === 'transmission_line') {
    return withSeedMetadata('transmission_line', placeholderTemplate('Transmission Line seed preview'));
  }
  return withSeedMetadata('horn', placeholderTemplate('Horn seed preview'));
}

function seedTemplateGraph(topology: TopologyId): GraphSnapshot {
  const graph = getTemplateGraph(topology);
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    selectedNodeId: graph.nodes[0]?.id ?? null,
  };
}

function parsePositiveNumber(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function graphStructureSignature(nodes: ReactFlowNode[], edges: ReactFlowEdge[]): string {
  const nodeSignature = nodes
    .map((node) => `${String(node.id)}:${String(node.data?.type ?? node.type ?? 'default')}`)
    .sort()
    .join('|');
  const edgeSignature = edges
    .map((edge) => `${String(edge.source)}->${String(edge.target)}`)
    .sort()
    .join('|');
  return `${nodeSignature}__${edgeSignature}`;
}

function nextNodeId(prefix: string, nodes: ReactFlowNode[]): string {
  let index = nodes.length + 1;
  let candidate = `${prefix}_${index}`;
  const existing = new Set(nodes.map((node) => String(node.id)));
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  return candidate;
}

function nextEdgeId(edges: ReactFlowEdge[]): string {
  let index = edges.length + 1;
  let candidate = `edge-${index}`;
  const existing = new Set(edges.map((edge) => String(edge.id)));
  while (existing.has(candidate)) {
    index += 1;
    candidate = `edge-${index}`;
  }
  return candidate;
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

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #dbe3ef',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function RuntimeStatusRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warning' | 'neutral';
}) {
  const color = tone === 'good' ? '#166534' : tone === 'warning' ? '#9a3412' : '#475569';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.45,
        padding: '6px 0',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700, color, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function App() {
  const initialSeed = useMemo(() => cloneSnapshot(seedTemplateGraph('closed_box')), []);

  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [showAdvancedCanvas, setShowAdvancedCanvas] = useState(true);
  const [seedGraph, setSeedGraph] = useState<GraphSnapshot>(initialSeed);
  const [historyState, setHistoryState] = useState<HistoryState>({
    stack: [cloneSnapshot(initialSeed)],
    index: 0,
  });
  const [nodes, setNodes, onNodesChange] = useNodesState(cloneNodes(initialSeed.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(cloneEdges(initialSeed.edges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSeed.selectedNodeId);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const applySnapshotWithoutHistory = useCallback(
    (snapshot: GraphSnapshot) => {
      const snapshotClone = cloneSnapshot(snapshot);
      setNodes(snapshotClone.nodes);
      setEdges(snapshotClone.edges);
      setSelectedNodeId(snapshotClone.selectedNodeId);
      setSimulationResult(null);
    },
    [setEdges, setNodes],
  );

  const commitGraphChange = useCallback(
    (nextNodes: ReactFlowNode[], nextEdges: ReactFlowEdge[], nextSelectedNodeId?: string | null) => {
      const snapshot: GraphSnapshot = {
        nodes: cloneNodes(nextNodes),
        edges: cloneEdges(nextEdges),
        selectedNodeId: nextSelectedNodeId ?? selectedNodeId ?? nextNodes[0]?.id ?? null,
      };

      applySnapshotWithoutHistory(snapshot);
      setHistoryState((previous) => {
        const base = previous.stack.slice(0, previous.index + 1);
        const appended = [...base, cloneSnapshot(snapshot)];
        const trimmed = appended.length > HISTORY_LIMIT ? appended.slice(appended.length - HISTORY_LIMIT) : appended;
        return { stack: trimmed, index: trimmed.length - 1 };
      });
    },
    [applySnapshotWithoutHistory, selectedNodeId],
  );

  const reseedTopology = useCallback(
    (topology: TopologyId) => {
      const seeded = cloneSnapshot(seedTemplateGraph(topology));
      setSelectedTopology(topology);
      setSeedGraph(cloneSnapshot(seeded));
      setHistoryState({ stack: [cloneSnapshot(seeded)], index: 0 });
      applySnapshotWithoutHistory(seeded);
      setShowAdvancedCanvas(true);
    },
    [applySnapshotWithoutHistory],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const nextEdges = addEdge(params, edges);
      commitGraphChange(nodes, nextEdges, selectedNodeId);
    },
    [commitGraphChange, edges, nodes, selectedNodeId],
  );

  const onSelectionChange = useCallback((params: { nodes?: ReactFlowNode[] }) => {
    const selectedNodes = Array.isArray(params?.nodes) ? params.nodes : [];
    setSelectedNodeId(selectedNodes[0]?.id ?? null);
  }, []);

  const updateNodeData = useCallback(
    (id: string, newData: any) => {
      const nextNodes = nodes.map((node) => (node.id === id ? { ...node, data: newData } : node));
      commitGraphChange(nextNodes, edges, id);
    },
    [commitGraphChange, edges, nodes],
  );

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const nextNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...(node.data ?? {}), ...patch } } : node,
      );
      commitGraphChange(nextNodes, edges, id);
    },
    [commitGraphChange, edges, nodes],
  );

  const canvasNodes = useMemo(() => nodes.map(toCanvasNode), [nodes]);
  const canvasEdges = useMemo(() => edges.map(toCanvasEdge), [edges]);

  const selectedCanvasNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => node.id === selectedNodeId);
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes, selectedNodeId]);

  const driverNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => node.id === 'node_driver_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const volumeNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => node.id === 'node_volume_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const radiatorNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => node.id === 'node_radiator_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const portNode = useMemo<CanvasNode | null>(() => {
    const rfNode = nodes.find((node) => node.id === 'node_port_1');
    return rfNode ? toCanvasNode(rfNode) : null;
  }, [nodes]);

  const seedStructureSignature = useMemo(
    () => graphStructureSignature(seedGraph.nodes, seedGraph.edges),
    [seedGraph.edges, seedGraph.nodes],
  );
  const workingStructureSignature = useMemo(
    () => graphStructureSignature(nodes, edges),
    [edges, nodes],
  );
  const isCompositionMode = workingStructureSignature !== seedStructureSignature;
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.stack.length - 1;
  const canRunSimulation = selectedTopology === 'closed_box' && !isCompositionMode;

  const runtimeReason = useMemo(() => {
    if (selectedTopology === 'closed_box' && !isCompositionMode) {
      return 'Validated seeded Closed Box anchor';
    }
    if (selectedTopology === 'closed_box' && isCompositionMode) {
      return 'Composition mode — structural edits moved beyond the validated seeded anchor';
    }
    if (selectedTopology === 'bass_reflex') {
      return 'Bass Reflex remains gated until a validated first-class combined system SPL path exists';
    }
    if (selectedTopology === 'transmission_line') {
      return 'Transmission Line is still a seed preview only in this line';
    }
    return 'Horn is still a seed preview only in this line';
  }, [isCompositionMode, selectedTopology]);

  const handleSimulate = useCallback(async () => {
    if (!canRunSimulation) {
      window.alert(runtimeReason);
      return;
    }

    const frequencies = Array.from({ length: 150 }, (_, index) => 20 * Math.pow(1000 / 20, index / 149));
    const payload = {
      model_dict: buildModelDict(canvasNodes, canvasEdges),
      frequencies_hz: frequencies,
      experimental_mode: false,
    };

    try {
      const response = await fetch('http://localhost:8000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSimulationResult(data.data);
      } else {
        window.alert(`Solver Error: ${JSON.stringify(data)}`);
      }
    } catch (_error) {
      window.alert('Failed to connect to backend.');
    }
  }, [canRunSimulation, canvasEdges, canvasNodes, runtimeReason]);

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      return;
    }
    const nextIndex = historyState.index - 1;
    const snapshot = historyState.stack[nextIndex];
    setHistoryState({ ...historyState, index: nextIndex });
    applySnapshotWithoutHistory(snapshot);
  }, [applySnapshotWithoutHistory, canUndo, historyState]);

  const handleRedo = useCallback(() => {
    if (!canRedo) {
      return;
    }
    const nextIndex = historyState.index + 1;
    const snapshot = historyState.stack[nextIndex];
    setHistoryState({ ...historyState, index: nextIndex });
    applySnapshotWithoutHistory(snapshot);
  }, [applySnapshotWithoutHistory, canRedo, historyState]);

  const handleResetToSeed = useCallback(() => {
    commitGraphChange(seedGraph.nodes, seedGraph.edges, seedGraph.selectedNodeId);
  }, [commitGraphChange, seedGraph.edges, seedGraph.nodes, seedGraph.selectedNodeId]);

  const handleInsertChild = useCallback(() => {
    const parent = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
    if (!parent) {
      return;
    }

    const childId = nextNodeId('node_inserted', nodes);
    const childNode: ReactFlowNode = {
      id: childId,
      type: 'default',
      position: { x: parent.position.x + 220, y: parent.position.y + 80 },
      data: {
        type: 'volume',
        label: 'Inserted Volume',
        Vb: 10,
        _seedAnchor: false,
        _seedTopology: selectedTopology,
      },
    };
    const childEdge: ReactFlowEdge = {
      id: nextEdgeId(edges),
      source: String(parent.id),
      target: childId,
    };

    commitGraphChange([...nodes, childNode], [...edges, childEdge], childId);
  }, [commitGraphChange, edges, nodes, selectedNodeId, selectedTopology]);

  const handleSplitSelectedPath = useCallback(() => {
    const target = nodes.find((node) => node.id === selectedNodeId);
    if (!target) {
      window.alert('Select a node whose incoming path should be split.');
      return;
    }

    const incomingEdge = edges.find((edge) => edge.target === target.id);
    if (!incomingEdge) {
      window.alert('The selected node has no incoming path to split.');
      return;
    }

    const splitNodeId = nextNodeId('node_split', nodes);
    const splitNode: ReactFlowNode = {
      id: splitNodeId,
      type: 'default',
      position: {
        x: ((nodes.find((node) => node.id === incomingEdge.source)?.position.x ?? 0) + target.position.x) / 2,
        y: ((nodes.find((node) => node.id === incomingEdge.source)?.position.y ?? 0) + target.position.y) / 2,
      },
      data: {
        type: 'duct',
        label: 'Inserted Split Path',
        areaCm2: 80,
        lengthCm: 15,
        _seedAnchor: false,
        _seedTopology: selectedTopology,
      },
    };

    const nextEdges = edges
      .filter((edge) => edge.id !== incomingEdge.id)
      .concat([
        { id: nextEdgeId(edges), source: incomingEdge.source, target: splitNodeId },
        { id: `edge-${String(edges.length + 2)}`, source: splitNodeId, target: String(target.id) },
      ]);

    commitGraphChange([...nodes, splitNode], nextEdges, splitNodeId);
  }, [commitGraphChange, edges, nodes, selectedNodeId, selectedTopology]);

  const handleDeleteSelectedLeaf = useCallback(() => {
    const selected = nodes.find((node) => node.id === selectedNodeId);
    if (!selected) {
      return;
    }
    if (selected.data?._seedAnchor) {
      window.alert('Seed anchor nodes are protected. Reset to Seed if you want the original topology back.');
      return;
    }

    const outgoingEdges = edges.filter((edge) => edge.source === selected.id);
    if (outgoingEdges.length > 0) {
      window.alert('Only leaf nodes can be deleted in this bounded editing foundation.');
      return;
    }

    const incomingEdge = edges.find((edge) => edge.target === selected.id) ?? null;
    const nextNodes = nodes.filter((node) => node.id !== selected.id);
    const nextEdges = edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id);
    const fallbackSelection = incomingEdge?.source ? String(incomingEdge.source) : nextNodes[0]?.id ?? null;
    commitGraphChange(nextNodes, nextEdges, fallbackSelection);
  }, [commitGraphChange, edges, nodes, selectedNodeId]);

  const renderClosedBoxEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode) {
      return <div style={{ color: '#991b1b', lineHeight: 1.5 }}>The current closed-box seed is incomplete.</div>;
    }

    return (
      <>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 14 }}>
          Closed Box remains the validated seeded runtime anchor. Parameter edits stay on the working graph while
          structural edits move the graph into composition mode.
        </div>
        <LabeledInput
          label="Driver Re"
          value={driverNode.data.Re ?? 5.0}
          suffix="ohm"
          onChange={(value) => patchNodeData(driverNode.id, { Re: parsePositiveNumber(value, 5.0) })}
        />
        <LabeledInput
          label="Driver Le"
          value={driverNode.data.Le ?? 1.4}
          suffix="mH"
          onChange={(value) => patchNodeData(driverNode.id, { Le: parsePositiveNumber(value, 1.4) })}
        />
        <LabeledInput
          label="Driver Sd"
          value={driverNode.data.Sd ?? 531}
          suffix="cm²"
          onChange={(value) => patchNodeData(driverNode.id, { Sd: parsePositiveNumber(value, 531) })}
        />
        <LabeledInput
          label="Rear Chamber Volume"
          value={volumeNode.data.Vb ?? 50}
          suffix="liters"
          onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 50) })}
        />
        <LabeledInput
          label="Front Radiation Area"
          value={radiatorNode.data.Sd ?? 531}
          suffix="cm²"
          onChange={(value) => patchNodeData(radiatorNode.id, { Sd: parsePositiveNumber(value, 531) })}
        />
      </>
    );
  };

  const renderBassReflexEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode || !portNode) {
      return <div style={{ color: '#991b1b', lineHeight: 1.5 }}>The current Bass Reflex seed is incomplete.</div>;
    }

    return (
      <>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 14 }}>
          Bass Reflex is a truthful seeded graph path, but runtime remains gated until a validated first-class combined
          system SPL path exists.
        </div>
        <LabeledInput
          label="Rear Chamber Volume"
          value={volumeNode.data.Vb ?? 65}
          suffix="liters"
          onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 65) })}
        />
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
        <LabeledInput
          label="Front Radiation Area"
          value={radiatorNode.data.Sd ?? 531}
          suffix="cm²"
          onChange={(value) => patchNodeData(radiatorNode.id, { Sd: parsePositiveNumber(value, 531) })}
        />
      </>
    );
  };

  const renderTopologyEditor = () => {
    if (selectedTopology === 'closed_box') {
      return renderClosedBoxEditor();
    }
    if (selectedTopology === 'bass_reflex') {
      return renderBassReflexEditor();
    }
    if (selectedTopology === 'transmission_line') {
      return (
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          Transmission Line remains a seed preview. This line does not yet claim truthful runtime support.
        </div>
      );
    }
    return (
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
        Horn remains a seed preview. This line does not yet claim truthful runtime support.
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>os-lem Studio</div>
          <div style={{ fontSize: 12, color: '#cbd5e1' }}>
            Template-seeded acoustic topology composition workbench
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 999,
              background: isCompositionMode ? '#7c2d12' : '#14532d',
            }}
          >
            {isCompositionMode ? 'Composition Mode' : 'Seeded Anchor Mode'}
          </span>
          <button
            onClick={handleSimulate}
            disabled={!canRunSimulation}
            title={runtimeReason}
            style={{
              padding: '8px 14px',
              cursor: canRunSimulation ? 'pointer' : 'not-allowed',
              background: canRunSimulation ? '#22c55e' : '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
            }}
          >
            Run Simulation
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: 390,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            borderRight: '1px solid #dbe3ef',
            overflowY: 'auto',
            background: '#f8fafc',
          }}
        >
          <SectionCard title="Topology Seeds">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TopologyCard
                title="Closed Box"
                subtitle="Validated seeded anchor"
                status="Runnable while structure remains seeded"
                active={selectedTopology === 'closed_box'}
                onClick={() => reseedTopology('closed_box')}
              />
              <TopologyCard
                title="Bass Reflex"
                subtitle="Guided seeded path"
                status="Runtime gated honestly"
                active={selectedTopology === 'bass_reflex'}
                onClick={() => reseedTopology('bass_reflex')}
              />
              <TopologyCard
                title="Transmission Line"
                subtitle="Seed preview"
                status="Not runnable in this line"
                active={selectedTopology === 'transmission_line'}
                onClick={() => reseedTopology('transmission_line')}
              />
              <TopologyCard
                title="Horn"
                subtitle="Seed preview"
                status="Not runnable in this line"
                active={selectedTopology === 'horn'}
                onClick={() => reseedTopology('horn')}
              />
            </div>
          </SectionCard>

          <SectionCard title="Runtime Truth">
            <RuntimeStatusRow
              label="Current graph"
              value={isCompositionMode ? 'Composition / not guaranteed runnable' : 'Matches current seed'}
              tone={isCompositionMode ? 'warning' : 'good'}
            />
            <RuntimeStatusRow label="Selected topology" value={selectedTopology.replace('_', ' ')} />
            <RuntimeStatusRow
              label="Runtime eligibility"
              value={canRunSimulation ? 'Validated anchor path' : 'Gated / partial / preview'}
              tone={canRunSimulation ? 'good' : 'warning'}
            />
            <div style={{ fontSize: 12, color: '#475569', marginTop: 10, lineHeight: 1.5 }}>{runtimeReason}</div>
          </SectionCard>

          <SectionCard title="Graph History & Recovery">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                style={{
                  padding: '8px 12px',
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
                  padding: '8px 12px',
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
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Reset to Seed
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              Seed and working graph are stored separately. Undo/redo operate on working graph snapshots only. Reset reuses
              the preserved seed snapshot for the selected topology.
            </div>
          </SectionCard>

          <SectionCard title="Topology-Aware Working Parameters">{renderTopologyEditor()}</SectionCard>

          <SectionCard title="Structural Graph Operations">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                onClick={handleInsertChild}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Insert Child
              </button>
              <button
                onClick={handleSplitSelectedPath}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Split Path
              </button>
              <button
                onClick={handleDeleteSelectedLeaf}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete Leaf
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              Structural edits operate on the working graph only. They are captured in history and may move the graph out
              of the currently validated seeded runtime anchor.
            </div>
          </SectionCard>

          <SectionCard title="Graph Surface">
            <button
              onClick={() => setShowAdvancedCanvas((current) => !current)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {showAdvancedCanvas ? 'Hide Graph Surface' : 'Show Graph Surface'}
            </button>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginTop: 10 }}>
              The graph is the primary working object. Templates seed it, structural edits transform it, and history keeps
              the session controlled.
            </div>
          </SectionCard>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', borderBottom: '1px solid #dbe3ef' }}>
            <div style={{ flex: 1, minWidth: 0, background: '#ffffff' }}>
              {showAdvancedCanvas ? (
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
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    fontSize: 14,
                  }}
                >
                  Graph surface hidden. Re-open it from the sidebar when you want to edit the working graph directly.
                </div>
              )}
            </div>
            <Inspector selectedNode={selectedCanvasNode} updateNodeData={updateNodeData} />
          </div>

          <div style={{ height: '36%', minHeight: 260, width: '100%', background: '#fff' }}>
            <ChartPanel simulationData={simulationResult} />
          </div>
        </div>
      </div>
    </div>
  );
}
