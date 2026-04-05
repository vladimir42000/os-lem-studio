import { useCallback, useMemo, useState } from 'react';
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

function seedTemplateGraph(template: TemplateGraph, topology: TopologyId): TemplateGraph {
  const seedStamp = `${topology}:${Date.now()}`;

  return {
    nodes: template.nodes.map((node, index) => ({
      ...node,
      position: { ...node.position },
      data: {
        ...node.data,
        __seed: {
          topology,
          source: 'template',
          stamp: seedStamp,
          templateNodeId: node.id,
          seedIndex: index,
        },
      },
    })),
    edges: template.edges.map((edge, index) => ({
      ...edge,
      data: {
        ...(edge.data ?? {}),
        __seed: {
          topology,
          source: 'template',
          stamp: seedStamp,
          templateEdgeId: edge.id,
          seedIndex: index,
        },
      },
    })),
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

function ValidationStatusRow({
  label,
  status,
  tone = 'neutral',
}: {
  label: string;
  status: string;
  tone?: 'good' | 'warning' | 'neutral';
}) {
  const toneColor = tone === 'good' ? '#166534' : tone === 'warning' ? '#9a3412' : '#475569';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.45,
        padding: '6px 0',
        borderBottom: '1px solid #fed7aa',
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700, color: toneColor, textAlign: 'right' }}>{status}</span>
    </div>
  );
}

function toCanvasNode(node: any): CanvasNode {
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

function toCanvasEdge(edge: any): CanvasEdge {
  return {
    id: String(edge.id),
    source: String(edge.source),
    sourceHandle: edge.sourceHandle ?? null,
    target: String(edge.target),
    targetHandle: edge.targetHandle ?? null,
  };
}

const initialSeededClosedBoxGraph = seedTemplateGraph(closedBoxTemplate, 'closed_box');

export default function App() {
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [showAdvancedCanvas, setShowAdvancedCanvas] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialSeededClosedBoxGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialSeededClosedBoxGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node_driver_1');
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const canRunSimulation = selectedTopology === 'closed_box';

  const applyTemplate = useCallback(
    (topology: TopologyId) => {
      const graph =
        topology === 'closed_box'
          ? seedTemplateGraph(closedBoxTemplate, 'closed_box')
          : topology === 'bass_reflex'
            ? seedTemplateGraph(bassReflexTemplate, 'bass_reflex')
            : topology === 'transmission_line'
              ? seedTemplateGraph(placeholderTemplate('Transmission Line template preview'), 'transmission_line')
              : seedTemplateGraph(placeholderTemplate('Horn template preview'), 'horn');

      setNodes(graph.nodes);
      setEdges(graph.edges);
      setSelectedNodeId(graph.nodes[0]?.id ?? null);
    },
    [setEdges, setNodes],
  );

  const handleTopologySelect = useCallback(
    (topology: TopologyId) => {
      setSelectedTopology(topology);
      if (topology !== 'closed_box') {
        setSimulationResult(null);
      }
      applyTemplate(topology);
      setShowAdvancedCanvas(true);
    },
    [applyTemplate],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((currentEdges) => addEdge(params, currentEdges));
    },
    [setEdges],
  );

  const onSelectionChange = useCallback((params: any) => {
    const selectedNodes = Array.isArray(params?.nodes) ? params.nodes : [];
    setSelectedNodeId(selectedNodes[0]?.id ?? null);
  }, []);

  const updateNodeData = useCallback(
    (id: string, newData: any) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === id ? { ...node, data: newData } : node)),
      );
    },
    [setNodes],
  );

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === id ? { ...node, data: { ...(node.data ?? {}), ...patch } } : node,
        ),
      );
    },
    [setNodes],
  );

  const resetCurrentTemplate = useCallback(() => {
    applyTemplate(selectedTopology);
  }, [applyTemplate, selectedTopology]);

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

  const topologyRuntimeMessage =
    selectedTopology === 'closed_box'
      ? 'Closed Box is the current stable runnable Studio workflow.'
      : selectedTopology === 'bass_reflex'
        ? 'Bass Reflex guided editing is available, but simulation stays disabled because the current translator/backend line is not yet validated as a trustworthy ported-box run path. Missing displacement and group delay do not block the first bass-reflex bring-up; the unresolved port branch and observation path do.'
        : selectedTopology === 'transmission_line'
          ? 'Transmission Line remains upcoming in the current Studio line.'
          : 'Horn remains upcoming in the current Studio line.';

  const handleSimulate = useCallback(async () => {
    if (!canRunSimulation) {
      alert('Closed Box remains the only runnable workflow in the current Studio line. Bass Reflex stays guided-only until the port branch and observation path are validated end-to-end. Displacement and group delay can land later; they are not the blocker for the first truthful Bass Reflex bring-up.');
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
        alert(`Solver Error: ${JSON.stringify(data)}`);
      }
    } catch (_error) {
      alert('Failed to connect to backend.');
    }
  }, [canRunSimulation, canvasEdges, canvasNodes]);

  const renderClosedBoxEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode) {
      return (
        <div style={{ color: '#991b1b', lineHeight: 1.5 }}>
          The closed-box template is incomplete. Switch to Advanced Canvas to inspect the raw nodes.
        </div>
      );
    }

    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Closed Box Editor</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            This remains the safe end-to-end Studio workflow. Edit the main enclosure parameters here, then run
            the simulation and inspect the plots below.
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
  };

  const renderBassReflexEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode || !portNode) {
      return (
        <div style={{ color: '#991b1b', lineHeight: 1.5 }}>
          The bass-reflex template is incomplete. Switch to Advanced Canvas to inspect the raw nodes.
        </div>
      );
    }

    return (
      <>
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 10,
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bass Reflex validation status</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>
            Bass Reflex is intentionally still partial in this Studio line. The guided editor and template graph are
            available, but the runtime stays disabled until the Studio translator/backend path is validated as a
            trustworthy ported-box simulation path.
          </div>
          <ValidationStatusRow label="Guided editor" status="Ready now" tone="good" />
          <ValidationStatusRow label="Advanced canvas / template view" status="Aligned enough" tone="good" />
          <ValidationStatusRow label="Port branch translation" status="Not yet validated" tone="warning" />
          <ValidationStatusRow label="Trustworthy BR SPL / impedance run path" status="Still gated" tone="warning" />
          <div style={{ fontSize: 12, lineHeight: 1.55, marginTop: 10, color: '#7c2d12' }}>
            Note: displacement and group delay are still absent from the current payload, but they are not the blocker
            for the first truthful Bass Reflex workflow. The blocking issue is the unresolved ported-box translation and
            observation path.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Bass Reflex Editor</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            Use this panel to set the main ported-box parameters while validation stays explicit. Bass Reflex is now a
            real guided workflow in the UI, but not yet a claimed end-to-end simulation path.
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
            value={volumeNode.data.Vb ?? 65}
            suffix="liters"
            onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 65) })}
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Port</div>
          <LabeledInput
            label="Port area"
            value={portNode.data.areaCm2 ?? 120}
            suffix="cm²"
            onChange={(value) => patchNodeData(portNode.id, { areaCm2: parsePositiveNumber(value, 120) })}
          />
          <LabeledInput
            label="Port length"
            value={portNode.data.lengthCm ?? 20}
            suffix="cm"
            onChange={(value) => patchNodeData(portNode.id, { lengthCm: parsePositiveNumber(value, 20) })}
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
            label="Radiating area"
            value={radiatorNode.data.Sd ?? 531}
            suffix="cm²"
            onChange={(value) => patchNodeData(radiatorNode.id, { Sd: parsePositiveNumber(value, 531) })}
          />
        </div>
      </>
    );
  };

  const renderPlaceholderEditor = (title: string, body: string) => (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{body}</div>
      <div
        style={{
          marginTop: 18,
          padding: '12px 14px',
          borderRadius: 10,
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          color: '#475569',
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        This topology remains upcoming. The Studio intentionally keeps the workflow honest here rather than
        pretending backend support already exists.
      </div>
    </div>
  );

  const renderGuidedEditor = () => {
    if (selectedTopology === 'closed_box') {
      return renderClosedBoxEditor();
    }
    if (selectedTopology === 'bass_reflex') {
      return renderBassReflexEditor();
    }
    if (selectedTopology === 'transmission_line') {
      return renderPlaceholderEditor(
        'Transmission Line workflow',
        'Transmission Line remains an upcoming guided topology. The current Studio line does not yet expose a trustworthy end-to-end TL path.',
      );
    }
    return renderPlaceholderEditor(
      'Horn workflow',
      'Horn remains an upcoming guided topology. The current Studio line does not yet expose a trustworthy end-to-end horn path.',
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}>
      <div
        style={{
          padding: '15px',
          background: '#282c34',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <strong>os-lem Studio</strong>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{topologyRuntimeMessage}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowAdvancedCanvas((value) => !value)}
            style={{
              padding: '5px 15px',
              cursor: 'pointer',
              background: '#475569',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
            }}
          >
            {showAdvancedCanvas ? 'Hide Advanced Canvas' : 'Show Advanced Canvas'}
          </button>
          <button
            onClick={handleSimulate}
            disabled={!canRunSimulation}
            title={
              canRunSimulation
                ? 'Run the current supported topology.'
                : 'Bass Reflex remains guided-only until the port branch and observation path are validated end-to-end. Closed Box is the only runnable workflow in the current line.'
            }
            style={{
              padding: '5px 15px',
              cursor: canRunSimulation ? 'pointer' : 'not-allowed',
              background: canRunSimulation ? '#4CAF50' : '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              opacity: canRunSimulation ? 1 : 0.85,
            }}
          >
            {canRunSimulation ? 'Run Simulation' : 'Run Simulation (Closed Box only)'}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10 }}>Choose topology</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TopologyCard
            title="Closed Box"
            subtitle="Stable runnable workflow"
            status="Supported now"
            active={selectedTopology === 'closed_box'}
            onClick={() => handleTopologySelect('closed_box')}
          />
          <TopologyCard
            title="Bass Reflex"
            subtitle="Guided editor with validation gating"
            status="Partial: runtime validation pending"
            active={selectedTopology === 'bass_reflex'}
            onClick={() => handleTopologySelect('bass_reflex')}
          />
          <TopologyCard
            title="Transmission Line"
            subtitle="Upcoming guided workflow"
            status="Upcoming"
            active={selectedTopology === 'transmission_line'}
            onClick={() => handleTopologySelect('transmission_line')}
          />
          <TopologyCard
            title="Horn"
            subtitle="Upcoming guided workflow"
            status="Upcoming"
            active={selectedTopology === 'horn'}
            onClick={() => handleTopologySelect('horn')}
          />
        </div>
      </div>

      <div style={{ display: 'flex', height: '60%', borderBottom: '2px solid #ccc' }}>
        <div style={{ flexGrow: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
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
            <div style={{ padding: '20px 24px', overflow: 'auto' }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {selectedTopology === 'closed_box'
                  ? 'Closed Box workflow'
                  : selectedTopology === 'bass_reflex'
                    ? 'Bass Reflex workflow'
                    : selectedTopology === 'transmission_line'
                      ? 'Transmission Line workflow'
                      : 'Horn workflow'}
              </div>
              <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, maxWidth: 800 }}>
                {topologyRuntimeMessage}
              </div>
              {selectedTopology === 'bass_reflex' ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #fdba74',
                    background: '#fff7ed',
                    color: '#9a3412',
                    maxWidth: 820,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  Bass Reflex remains guided-only in this line. The next truthful enabling step is not extra UI polish;
                  it is validating the ported-box translator/backend run path so SPL and impedance are trustworthy.
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 18,
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  maxWidth: 820,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Workflow mode</div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
                  Studio now starts topology-first. Guided editing is the primary path. Advanced Canvas remains
                  available for direct graph inspection and manual node editing when needed. Bass Reflex stays visibly
                  partial until the translator/backend path is validated, rather than being presented as if it already
                  had Closed Box parity.
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowAdvancedCanvas(true)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Open Advanced Canvas
                  </button>
                  <button
                    onClick={resetCurrentTemplate}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Reset Current Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            width: '360px',
            background: '#fff',
            padding: '20px',
            borderLeft: '1px solid #ccc',
            overflow: 'auto',
          }}
        >
          {showAdvancedCanvas ? (
            <Inspector selectedNode={selectedCanvasNode} updateNodeData={updateNodeData} />
          ) : (
            renderGuidedEditor()
          )}
        </div>
      </div>

      <div style={{ height: '40%', width: '100%', background: '#fff' }}>
        <ChartPanel simulationData={simulationResult} />
      </div>
    </div>
  );
}
