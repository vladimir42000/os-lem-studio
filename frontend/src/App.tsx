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

const initialClosedBoxNodes: CanvasNode[] = [
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
  } as CanvasNode,
  {
    id: 'node_volume_1',
    type: 'default',
    position: { x: 500, y: 50 },
    data: {
      type: 'volume',
      label: 'Rear Chamber',
      Vb: 50.0,
    },
  } as CanvasNode,
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
  } as CanvasNode,
];

const initialClosedBoxEdges: CanvasEdge[] = [
  { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' } as CanvasEdge,
  { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' } as CanvasEdge,
];

function cloneClosedBoxNodes(): CanvasNode[] {
  return initialClosedBoxNodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  })) as CanvasNode[];
}

function cloneClosedBoxEdges(): CanvasEdge[] {
  return initialClosedBoxEdges.map((edge) => ({ ...edge })) as CanvasEdge[];
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

export default function App() {
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [showAdvancedCanvas, setShowAdvancedCanvas] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState(cloneClosedBoxNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(cloneClosedBoxEdges());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node_driver_1');
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const closedBoxSupported = selectedTopology === 'closed_box';

  type FlowNode = (typeof nodes)[number];
  type FlowEdge = (typeof edges)[number];

  const toCanvasNode = useCallback(
    (node: FlowNode): CanvasNode => ({
      id: node.id,
      type: (node.type as CanvasNode['type']) ?? 'default',
      position: { ...node.position },
      data: node.data ?? {},
    }),
    [],
  );

  const toCanvasEdge = useCallback(
    (edge: FlowEdge): CanvasEdge => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? null,
      target: edge.target,
      targetHandle: edge.targetHandle ?? null,
    }),
    [],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((currentEdges) => addEdge(params, currentEdges));
    },
    [setEdges],
  );

  const replaceNodeData = useCallback(
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
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      );
    },
    [setNodes],
  );

  const resetClosedBoxTemplate = useCallback(() => {
    setNodes(cloneClosedBoxNodes());
    setEdges(cloneClosedBoxEdges());
    setSelectedNodeId('node_driver_1');
  }, [setEdges, setNodes]);

  const handleTopologySelect = useCallback((topology: TopologyId) => {
    setSelectedTopology(topology);
    if (topology !== 'closed_box') {
      setShowAdvancedCanvas(false);
    }
  }, []);

  const handleSimulate = useCallback(async () => {
    if (!closedBoxSupported) {
      alert('Only the closed-box Studio workflow is supported in the current line.');
      return;
    }

    const frequencies = Array.from({ length: 150 }, (_, index) => 20 * Math.pow(1000 / 20, index / 149));
    const payload = {
      model_dict: buildModelDict(nodes.map(toCanvasNode), edges.map(toCanvasEdge)),
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
  }, [closedBoxSupported, edges, nodes, toCanvasEdge, toCanvasNode]);

  const selectedNode = useMemo<CanvasNode | null>(() => {
    const node = nodes.find((candidate) => candidate.id === selectedNodeId);
    return node ? toCanvasNode(node) : null;
  }, [nodes, selectedNodeId, toCanvasNode]);

  const driverNode = useMemo<CanvasNode | null>(() => {
    const node = nodes.find((candidate) => candidate.id === 'node_driver_1');
    return node ? toCanvasNode(node) : null;
  }, [nodes, toCanvasNode]);
  const volumeNode = useMemo<CanvasNode | null>(() => {
    const node = nodes.find((candidate) => candidate.id === 'node_volume_1');
    return node ? toCanvasNode(node) : null;
  }, [nodes, toCanvasNode]);
  const radiatorNode = useMemo<CanvasNode | null>(() => {
    const node = nodes.find((candidate) => candidate.id === 'node_radiator_1');
    return node ? toCanvasNode(node) : null;
  }, [nodes, toCanvasNode]);

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
            The supported Studio path is still the closed-box workflow. Use this focused panel for the common
            parameters, and switch to Advanced Canvas only when you need direct graph edits.
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

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
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
            onClick={resetClosedBoxTemplate}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Reset Closed Box Template
          </button>
        </div>
      </>
    );
  };

  const renderTopologyPlaceholder = (topology: Exclude<TopologyId, 'closed_box'>) => {
    const labels: Record<Exclude<TopologyId, 'closed_box'>, { title: string; summary: string; focus: string }> = {
      bass_reflex: {
        title: 'Bass Reflex',
        summary: 'The Studio entry path now recognizes bass-reflex as a first-class topology family.',
        focus: 'Next implementation step: topology-aware bass-reflex controls and validated backend support.',
      },
      transmission_line: {
        title: 'Transmission Line',
        summary: 'Transmission-line workflows are planned, but the current Studio line does not expose a stable TL solver path yet.',
        focus: 'Next implementation step: guided TL parameters and validated line-oriented backend integration.',
      },
      horn: {
        title: 'Horn',
        summary: 'Horn is visible as a product direction, but this Studio line does not yet provide a trustworthy horn editing path.',
        focus: 'Next implementation step: horn-specific guided inputs and an honest advanced-mode transition.',
      },
    };

    const content = labels[topology];

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{content.title}</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{content.summary}</div>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: '1px dashed #94a3b8',
            background: '#f8fafc',
            color: '#334155',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Status</div>
          <div>Upcoming / partial workflow. Studio shows this topology honestly but does not fake solver completeness.</div>
          <div style={{ marginTop: 10 }}>{content.focus}</div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>
            Advanced Canvas remains reserved for the supported closed-box workflow in the current line.
          </div>
        </div>
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
        background: '#ffffff',
      }}
    >
      <div
        style={{
          padding: '15px 18px',
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
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
            Topology-first entry with guided editing for the supported closed-box path.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowAdvancedCanvas((current) => (closedBoxSupported ? !current : false))}
            disabled={!closedBoxSupported}
            style={{
              padding: '7px 12px',
              cursor: closedBoxSupported ? 'pointer' : 'not-allowed',
              background: showAdvancedCanvas && closedBoxSupported ? '#2563eb' : '#1e293b',
              color: 'white',
              border: '1px solid #475569',
              borderRadius: 6,
              opacity: closedBoxSupported ? 1 : 0.6,
            }}
          >
            {showAdvancedCanvas && closedBoxSupported ? 'Hide Advanced Canvas' : 'Show Advanced Canvas'}
          </button>
          <button
            onClick={handleSimulate}
            disabled={!closedBoxSupported}
            style={{
              padding: '8px 14px',
              cursor: closedBoxSupported ? 'pointer' : 'not-allowed',
              background: closedBoxSupported ? '#22c55e' : '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              opacity: closedBoxSupported ? 1 : 0.8,
            }}
          >
            Run Simulation
          </button>
        </div>
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#334155' }}>Choose enclosure family</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TopologyCard
            title="Closed Box"
            subtitle="Supported and ready for guided editing."
            status="Stable current Studio path"
            active={selectedTopology === 'closed_box'}
            onClick={() => handleTopologySelect('closed_box')}
          />
          <TopologyCard
            title="Bass Reflex"
            subtitle="Visible product path, not fully implemented yet."
            status="Upcoming / partial"
            active={selectedTopology === 'bass_reflex'}
            onClick={() => handleTopologySelect('bass_reflex')}
          />
          <TopologyCard
            title="Transmission Line"
            subtitle="Recognized as a first-class topology family."
            status="Upcoming / partial"
            active={selectedTopology === 'transmission_line'}
            onClick={() => handleTopologySelect('transmission_line')}
          />
          <TopologyCard
            title="Horn"
            subtitle="Visible direction, still incomplete in this Studio line."
            status="Upcoming / partial"
            active={selectedTopology === 'horn'}
            onClick={() => handleTopologySelect('horn')}
          />
        </div>
      </div>

      <div style={{ display: 'flex', height: '60%', borderBottom: '2px solid #e2e8f0' }}>
        <div
          style={{
            width: 360,
            borderRight: '1px solid #e2e8f0',
            padding: 16,
            overflowY: 'auto',
            background: '#fafafa',
          }}
        >
          {selectedTopology === 'closed_box' ? renderClosedBoxEditor() : renderTopologyPlaceholder(selectedTopology)}
        </div>

        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {closedBoxSupported && showAdvancedCanvas ? (
            <div style={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
                  fitView
                >
                  <Background />
                  <Controls />
                </ReactFlow>
              </div>
              <Inspector selectedNode={selectedNode} updateNodeData={replaceNodeData} />
            </div>
          ) : (
            <div style={{ padding: 22, color: '#334155', lineHeight: 1.6 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Guided topology workflow</div>
              {closedBoxSupported ? (
                <>
                  <div>
                    Closed Box is the supported path in the current Studio line. The focused editor on the left exposes
                    the primary parameters, while the chart area below remains available for engineering inspection.
                  </div>
                  <div style={{ marginTop: 12 }}>
                    Use <strong>Show Advanced Canvas</strong> only when you need direct node-level inspection or manual
                    graph edits.
                  </div>
                </>
              ) : (
                <>
                  <div>
                    {selectedTopology === 'bass_reflex' &&
                      'Bass reflex is visible as the next topology family, but its guided editor and backend path are not landed yet.'}
                    {selectedTopology === 'transmission_line' &&
                      'Transmission line remains an upcoming path. Studio shows it now to make topology choice explicit, not to imply finished support.'}
                    {selectedTopology === 'horn' &&
                      'Horn remains an upcoming path. The current Studio line keeps this option visible without pretending it is already complete.'}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    Keep using the supported closed-box workflow for live simulation runs in this phase.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ height: '40%', width: '100%', background: '#fff' }}>
        <ChartPanel simulationData={simulationResult} />
      </div>
    </div>
  );
}
