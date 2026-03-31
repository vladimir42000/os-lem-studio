import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Inspector from './Inspector';
import ChartPanel from './ChartPanel';
import { buildModelDict } from './translator';
import type { CanvasEdge, CanvasNode } from './types';

type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

type TopologyMeta = {
  id: TopologyId;
  label: string;
  status: 'supported' | 'upcoming';
  summary: string;
  detail: string;
};

const TOPOLOGIES: TopologyMeta[] = [
  {
    id: 'closed_box',
    label: 'Closed Box',
    status: 'supported',
    summary: 'Fully supported default path for this Studio build.',
    detail:
      'Choose a closed-box template first, then refine parameters and inspect the plots. This is the recommended working path today.',
  },
  {
    id: 'bass_reflex',
    label: 'Bass Reflex',
    status: 'upcoming',
    summary: 'Visible as a near-term topology family, but not productized yet.',
    detail:
      'The guided entry exists now so the workflow is topology-first, but the solver-backed Studio path remains upcoming in a later bounded patch.',
  },
  {
    id: 'transmission_line',
    label: 'Transmission Line',
    status: 'upcoming',
    summary: 'Visible now for workflow direction; supported implementation comes later.',
    detail:
      'Transmission line remains a planned near-term family. The current Studio build does not yet expose a guided, supported TL editing path.',
  },
  {
    id: 'horn',
    label: 'Horn',
    status: 'upcoming',
    summary: 'Reserved as a first-class family, but still upcoming in Studio.',
    detail:
      'Horn design is explicitly in scope for the product direction, but this build keeps the entry honest and avoids claiming a finished guided horn workflow.',
  },
];

function createClosedBoxNodes(): CanvasNode[] {
  return [
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
}

function createClosedBoxEdges(): CanvasEdge[] {
  return [
    { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' } as CanvasEdge,
    { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' } as CanvasEdge,
  ];
}

export default function App() {
  const [nodes, setNodes] = useState<CanvasNode[]>(createClosedBoxNodes());
  const [edges, setEdges] = useState<CanvasEdge[]>(createClosedBoxEdges());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node_driver_1');
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [selectedTopology, setSelectedTopology] = useState<TopologyId>('closed_box');
  const [showAdvancedCanvas, setShowAdvancedCanvas] = useState<boolean>(false);

  const activeTopology = useMemo(
    () => TOPOLOGIES.find((topology) => topology.id === selectedTopology) ?? TOPOLOGIES[0],
    [selectedTopology]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes) as CanvasNode[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges) as CanvasEdge[]);
  }, []);

  const onConnect = useCallback((params: Edge | Connection) => {
    setEdges((currentEdges) => addEdge(params, currentEdges) as CanvasEdge[]);
  }, []);

  const onSelectionChange = useCallback((params: { nodes?: Array<{ id: string }> }) => {
    setSelectedNodeId(params.nodes && params.nodes.length > 0 ? params.nodes[0].id : null);
  }, []);

  const updateNodeData = useCallback((id: string, newData: CanvasNode['data']) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => (node.id === id ? ({ ...node, data: newData } as CanvasNode) : node))
    );
  }, []);

  const applyClosedBoxTemplate = useCallback(() => {
    setSelectedTopology('closed_box');
    setNodes(createClosedBoxNodes());
    setEdges(createClosedBoxEdges());
    setSelectedNodeId('node_driver_1');
    setShowAdvancedCanvas(false);
  }, []);

  const handleSimulate = async () => {
    if (selectedTopology !== 'closed_box') {
      alert(
        `${activeTopology.label} is not yet a supported Studio simulation path. Switch back to Closed Box to use the validated workflow in this build.`
      );
      return;
    }

    const freqs = Array.from({ length: 150 }, (_, i) => 20 * Math.pow(1000 / 20, i / 149));
    const payload = {
      model_dict: buildModelDict(nodes, edges),
      frequencies_hz: freqs,
      experimental_mode: false,
    };

    try {
      const res = await fetch('http://localhost:8000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSimulationResult(data.data);
      } else {
        alert(`Solver Error: ${JSON.stringify(data)}`);
      }
    } catch {
      alert('Failed to connect to backend.');
    }
  };

  const runButtonDisabled = selectedTopology !== 'closed_box';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        background: '#f4f6f8',
      }}
    >
      <div
        style={{
          padding: '15px 18px',
          background: '#282c34',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <strong>os-lem Studio</strong>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
            Topology-first guided entry with advanced canvas kept available.
          </div>
        </div>
        <button
          onClick={handleSimulate}
          disabled={runButtonDisabled}
          title={
            runButtonDisabled
              ? 'Only Closed Box is a validated Studio simulation path in this build.'
              : 'Run the current closed-box Studio simulation.'
          }
          style={{
            padding: '8px 16px',
            cursor: runButtonDisabled ? 'not-allowed' : 'pointer',
            background: runButtonDisabled ? '#7b838f' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          Run Simulation
        </button>
      </div>

      <div style={{ padding: '16px 18px 12px 18px', borderBottom: '1px solid #d8dde3', background: '#fff' }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Start from a topology template</div>
          <div style={{ fontSize: '13px', color: '#55606d' }}>
            Choose the enclosure family first. Closed Box is the polished working path today; the canvas remains available as an advanced mode.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {TOPOLOGIES.map((topology) => {
            const isSelected = topology.id === selectedTopology;
            const isSupported = topology.status === 'supported';
            return (
              <button
                key={topology.id}
                onClick={() => setSelectedTopology(topology.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #2f6fed' : '1px solid #cfd6de',
                  background: isSelected ? '#eef4ff' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 700, color: '#1f2933' }}>{topology.label}</div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: isSupported ? '#daf5dd' : '#fff1cc',
                      color: isSupported ? '#1f6b2d' : '#8a5a00',
                    }}
                  >
                    {isSupported ? 'Supported' : 'Upcoming'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#52606d', lineHeight: 1.45 }}>{topology.summary}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: activeTopology.status === 'supported' ? '#edf8ee' : '#fff7df',
            border: activeTopology.status === 'supported' ? '1px solid #cfe8d1' : '1px solid #f1d38b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', color: '#1f2933' }}>{activeTopology.label}</div>
            <div style={{ fontSize: '13px', color: '#52606d', lineHeight: 1.45 }}>{activeTopology.detail}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={applyClosedBoxTemplate}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #2f6fed',
                background: activeTopology.id === 'closed_box' ? '#2f6fed' : '#ffffff',
                color: activeTopology.id === 'closed_box' ? '#ffffff' : '#2f6fed',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Apply Closed Box Template
            </button>
            <button
              onClick={() => setShowAdvancedCanvas((current) => !current)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #c0c9d2',
                background: '#ffffff',
                color: '#1f2933',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showAdvancedCanvas ? 'Hide Advanced Canvas' : 'Open Advanced Canvas'}
            </button>
          </div>
        </div>
      </div>

      {showAdvancedCanvas ? (
        <div style={{ display: 'flex', height: '40%', borderBottom: '2px solid #d8dde3', background: '#fff' }}>
          <div style={{ flexGrow: 1, borderRight: '1px solid #e3e7eb' }}>
            <div
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#52606d',
                borderBottom: '1px solid #eef2f5',
                background: '#fafbfc',
              }}
            >
              Advanced Canvas Mode
            </div>
            <div style={{ height: 'calc(100% - 38px)' }}>
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
          </div>
          <Inspector selectedNode={selectedNode} updateNodeData={updateNodeData} />
        </div>
      ) : (
        <div
          style={{
            padding: '16px 18px',
            background: '#fff',
            borderBottom: '2px solid #d8dde3',
            color: '#52606d',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#1f2933' }}>Advanced Canvas is currently hidden.</strong> Use it for node-level editing and free-form graph inspection.
          The recommended Studio entry path in this phase is topology first, then simulate and inspect the plots.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, background: '#fff' }}>
        <ChartPanel simulationData={simulationResult} />
      </div>
    </div>
  );
}
