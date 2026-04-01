import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Connection,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Inspector from './Inspector';
import ChartPanel from './ChartPanel';
import { buildModelDict } from './translator';
import { CanvasEdge, CanvasNode } from './types';

type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

interface TemplateSpec {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
}

const closedBoxTemplate: TemplateSpec = {
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
  selectedNodeId: 'node_driver_1',
};

const bassReflexTemplate: TemplateSpec = {
  nodes: [
    {
      id: 'node_driver_1',
      type: 'default',
      position: { x: 220, y: 150 },
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
      position: { x: 470, y: 40 },
      data: {
        type: 'volume',
        label: 'Rear Chamber',
        Vb: 42.0,
      },
    },
    {
      id: 'node_port_1',
      type: 'default',
      position: { x: 470, y: 150 },
      data: {
        type: 'duct',
        label: 'Port',
        areaCm2: 18.0,
        lengthCm: 18.0,
      },
    },
    {
      id: 'node_radiator_1',
      type: 'default',
      position: { x: 470, y: 260 },
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
  selectedNodeId: 'node_driver_1',
};

function cloneNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  }));
}

function cloneEdges(edges: CanvasEdge[]): CanvasEdge[] {
  return edges.map((edge) => ({ ...edge }));
}

function getTemplate(topology: TopologyId): TemplateSpec {
  if (topology === 'bass_reflex') {
    return {
      nodes: cloneNodes(bassReflexTemplate.nodes),
      edges: cloneEdges(bassReflexTemplate.edges),
      selectedNodeId: bassReflexTemplate.selectedNodeId,
    };
  }

  return {
    nodes: cloneNodes(closedBoxTemplate.nodes),
    edges: cloneEdges(closedBoxTemplate.edges),
    selectedNodeId: closedBoxTemplate.selectedNodeId,
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

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontWeight: 700, marginBottom: 12 }}>{children}</div>;
}

export default function App() {
  const initialTemplate = useMemo(() => getTemplate('closed_box'), []);
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [showAdvancedCanvas, setShowAdvancedCanvas] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialTemplate.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialTemplate.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialTemplate.selectedNodeId);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const isClosedBox = selectedTopology === 'closed_box';
  const isBassReflex = selectedTopology === 'bass_reflex';
  const hasGuidedTemplate = isClosedBox || isBassReflex;
  const simulationSupported = isClosedBox;

  const toCanvasNode = useCallback((node: any): CanvasNode => ({
    id: String(node.id),
    type: (node.type ?? 'default') as CanvasNode['type'],
    position: {
      x: Number(node.position?.x ?? 0),
      y: Number(node.position?.y ?? 0),
    },
    data: node.data,
  }), []);

  const toCanvasEdge = useCallback((edge: any): CanvasEdge => ({
    id: String(edge.id),
    source: String(edge.source),
    sourceHandle: edge.sourceHandle ?? null,
    target: String(edge.target),
    targetHandle: edge.targetHandle ?? null,
  }), []);

  const canvasNodes = useMemo(() => nodes.map((node) => toCanvasNode(node)), [nodes, toCanvasNode]);
  const canvasEdges = useMemo(() => edges.map((edge) => toCanvasEdge(edge)), [edges, toCanvasEdge]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((currentEdges) => addEdge(params, currentEdges));
    },
    [setEdges],
  );

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
      );
    },
    [setNodes],
  );

  const replaceNodeData = useCallback(
    (id: string, newData: any) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === id ? { ...node, data: newData } : node)),
      );
    },
    [setNodes],
  );

  const loadTopologyTemplate = useCallback(
    (topology: TopologyId) => {
      const template = getTemplate(topology);
      setSelectedTopology(topology);
      setNodes(template.nodes);
      setEdges(template.edges);
      setSelectedNodeId(template.selectedNodeId);
      setSimulationResult(null);
      setShowAdvancedCanvas(false);
    },
    [setEdges, setNodes],
  );

  const resetCurrentTemplate = useCallback(() => {
    loadTopologyTemplate(selectedTopology);
  }, [loadTopologyTemplate, selectedTopology]);

  const handleSimulate = useCallback(async () => {
    if (!simulationSupported) {
      alert('Bass Reflex editing is now available, but simulation support for this topology lands in a follow-up patch. Closed Box remains the current supported run path.');
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
  }, [canvasEdges, canvasNodes, simulationSupported]);

  const selectedNode = useMemo<CanvasNode | null>(() => {
    const match = nodes.find((node) => node.id === selectedNodeId);
    return match ? toCanvasNode(match) : null;
  }, [nodes, selectedNodeId, toCanvasNode]);

  const driverNode = useMemo<CanvasNode | null>(
    () => canvasNodes.find((node) => node.id === 'node_driver_1') ?? null,
    [canvasNodes],
  );
  const volumeNode = useMemo<CanvasNode | null>(
    () => canvasNodes.find((node) => node.id === 'node_volume_1') ?? null,
    [canvasNodes],
  );
  const radiatorNode = useMemo<CanvasNode | null>(
    () => canvasNodes.find((node) => node.id === 'node_radiator_1') ?? null,
    [canvasNodes],
  );
  const portNode = useMemo<CanvasNode | null>(
    () => canvasNodes.find((node) => node.id === 'node_port_1') ?? null,
    [canvasNodes],
  );

  const renderClosedBoxEditor = () => {
    if (!driverNode || !volumeNode || !radiatorNode) {
      return <div style={{ color: '#991b1b', lineHeight: 1.5 }}>The closed-box template is incomplete.</div>;
    }

    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Closed Box Editor</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            Closed Box remains the stable supported Studio workflow. Use this guided panel for fast edits, then switch to the advanced canvas only when you need direct graph inspection.
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <SectionTitle>Driver</SectionTitle>
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
          <SectionTitle>Rear Chamber</SectionTitle>
          <LabeledInput
            label="Volume"
            value={volumeNode.data.Vb ?? 50}
            suffix="liters"
            onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 50) })}
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
          <SectionTitle>Front Radiation</SectionTitle>
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
      return <div style={{ color: '#991b1b', lineHeight: 1.5 }}>The bass-reflex template is incomplete.</div>;
    }

    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Bass Reflex Editor</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            Bass Reflex is now a guided Studio workflow instead of a bare label. This patch surfaces the core enclosure and port parameters and keeps the advanced canvas available, while staying honest that simulation support has not landed yet.
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            background: '#fff7ed',
            color: '#9a3412',
            border: '1px solid #fdba74',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          Bass Reflex editing is supported in the UI in this patch. Simulation remains disabled for this topology until the translator/kernel path is extended in a later bounded step.
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <SectionTitle>Driver</SectionTitle>
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
          <SectionTitle>Rear Chamber</SectionTitle>
          <LabeledInput
            label="Volume"
            value={volumeNode.data.Vb ?? 42}
            suffix="liters"
            onChange={(value) => patchNodeData(volumeNode.id, { Vb: parsePositiveNumber(value, 42) })}
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
          <SectionTitle>Port</SectionTitle>
          <LabeledInput
            label="Label"
            value={portNode.data.label ?? ''}
            onChange={(value) => patchNodeData(portNode.id, { label: value || 'Port' })}
          />
          <LabeledInput
            label="Port Area"
            value={portNode.data.areaCm2 ?? 18}
            suffix="cm²"
            onChange={(value) => patchNodeData(portNode.id, { areaCm2: parsePositiveNumber(value, 18) })}
          />
          <LabeledInput
            label="Port Length"
            value={portNode.data.lengthCm ?? 18}
            suffix="cm"
            onChange={(value) => patchNodeData(portNode.id, { lengthCm: parsePositiveNumber(value, 18) })}
          />
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
          <SectionTitle>Front Radiation</SectionTitle>
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

  const renderPlaceholderEditor = (title: string, message: string) => (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{message}</div>
    </div>
  );

  const guidedEditor = isClosedBox
    ? renderClosedBoxEditor()
    : isBassReflex
      ? renderBassReflexEditor()
      : selectedTopology === 'transmission_line'
        ? renderPlaceholderEditor(
            'Transmission Line',
            'Transmission Line is still upcoming. The topology family is visible in Studio now so the workflow is honest, but guided parameter editing and simulation support have not landed yet.',
          )
        : renderPlaceholderEditor(
            'Horn',
            'Horn is still upcoming. The topology family is visible in Studio now so the workflow is honest, but guided parameter editing and simulation support have not landed yet.',
          );

  const guidedWorkspaceNote = isClosedBox
    ? 'Guided closed-box editing is active. Open the advanced canvas only when you need direct graph inspection.'
    : isBassReflex
      ? 'Bass Reflex guided editing is active. The advanced canvas shows the current driver / rear chamber / port / front-radiation template.'
      : 'This topology is still upcoming. Studio keeps the product direction visible without pretending the workflow is complete.';

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
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            Topology-first workflow with guided editing and advanced canvas fallback
          </div>
        </div>
        <button
          onClick={handleSimulate}
          disabled={!simulationSupported}
          title={simulationSupported ? 'Run the current supported topology.' : 'Only Closed Box simulation is supported in the current line.'}
          style={{
            padding: '8px 14px',
            cursor: simulationSupported ? 'pointer' : 'not-allowed',
            background: simulationSupported ? '#4CAF50' : '#64748b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            opacity: simulationSupported ? 1 : 0.75,
          }}
        >
          Run Simulation
        </button>
      </div>

      <div style={{ padding: '16px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Choose Topology</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TopologyCard
            title="Closed Box"
            subtitle="Stable supported workflow"
            status="Supported now"
            active={selectedTopology === 'closed_box'}
            onClick={() => loadTopologyTemplate('closed_box')}
          />
          <TopologyCard
            title="Bass Reflex"
            subtitle="First guided next topology"
            status="Guided editor now, simulation next"
            active={selectedTopology === 'bass_reflex'}
            onClick={() => loadTopologyTemplate('bass_reflex')}
          />
          <TopologyCard
            title="Transmission Line"
            subtitle="Upcoming topology family"
            status="Not yet supported"
            active={selectedTopology === 'transmission_line'}
            onClick={() => loadTopologyTemplate('transmission_line')}
          />
          <TopologyCard
            title="Horn"
            subtitle="Upcoming topology family"
            status="Not yet supported"
            active={selectedTopology === 'horn'}
            onClick={() => loadTopologyTemplate('horn')}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: 360,
            background: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            padding: 18,
            overflowY: 'auto',
          }}
        >
          {guidedEditor}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAdvancedCanvas((value) => !value)}
              disabled={!hasGuidedTemplate}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: hasGuidedTemplate ? 'pointer' : 'not-allowed',
                opacity: hasGuidedTemplate ? 1 : 0.6,
              }}
            >
              {showAdvancedCanvas ? 'Hide Advanced Canvas' : 'Open Advanced Canvas'}
            </button>
            <button
              onClick={resetCurrentTemplate}
              disabled={!hasGuidedTemplate}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                cursor: hasGuidedTemplate ? 'pointer' : 'not-allowed',
                opacity: hasGuidedTemplate ? 1 : 0.6,
              }}
            >
              Reset Current Template
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Workspace</div>
            <div style={{ fontSize: 13, color: '#475569' }}>{guidedWorkspaceNote}</div>
          </div>

          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {showAdvancedCanvas && hasGuidedTemplate ? (
                <div style={{ flex: 1 }}>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => setSelectedNodeId(null)}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    color: '#475569',
                    padding: 24,
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}
                >
                  {showAdvancedCanvas
                    ? 'Advanced canvas is available only for the current guided template topologies.'
                    : 'Guided editing is active. Use the topology-aware panel on the left, or open the advanced canvas when you need raw node inspection.'}
                </div>
              )}
            </div>

            {showAdvancedCanvas && hasGuidedTemplate ? (
              <Inspector selectedNode={selectedNode} updateNodeData={replaceNodeData} />
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ height: '40%', width: '100%', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
        <ChartPanel simulationData={simulationResult} />
      </div>
    </div>
  );
}
