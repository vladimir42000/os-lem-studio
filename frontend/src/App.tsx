import { useCallback, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge, Connection, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import Inspector from './Inspector';
import ChartPanel from './ChartPanel';
import { buildModelDict } from './translator';

type TopologyKey = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

const initialNodes = [
  {
    id: 'node_driver_1',
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
    position: { x: 500, y: 50 },
    data: { type: 'volume', label: 'Rear Chamber', Vb: 50.0 },
  },
  {
    id: 'node_radiator_1',
    position: { x: 500, y: 250 },
    data: { type: 'radiator', label: 'Front Radiation', model: 'infinite_baffle_piston', Sd: 531 },
  },
];

const initialEdges = [
  { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' },
  { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' },
];

const TOPOLOGY_OPTIONS: Array<{
  key: TopologyKey;
  title: string;
  subtitle: string;
  status: 'supported' | 'upcoming';
  description: string;
}> = [
  {
    key: 'closed_box',
    title: 'Closed Box',
    subtitle: 'Stable supported path',
    status: 'supported',
    description:
      'Use the current validated Studio workflow: choose the closed-box family, run simulation manually, and inspect plots.',
  },
  {
    key: 'bass_reflex',
    title: 'Bass Reflex',
    subtitle: 'Upcoming topology family',
    status: 'upcoming',
    description:
      'Visible as a near-term template option, but not yet implemented as a complete Studio solver workflow in this patch.',
  },
  {
    key: 'transmission_line',
    title: 'Transmission Line',
    subtitle: 'Upcoming topology family',
    status: 'upcoming',
    description:
      'Reserved for the guided topology workflow phase. Shown honestly here without pretending that support already exists.',
  },
  {
    key: 'horn',
    title: 'Horn',
    subtitle: 'Upcoming topology family',
    status: 'upcoming',
    description:
      'Intended as a later topology-first entry option. This patch only establishes the entry framing, not horn implementation.',
  },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as any);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [activeTopology, setActiveTopology] = useState<TopologyKey>('closed_box');
  const [showAdvancedCanvas, setShowAdvancedCanvas] = useState(false);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onSelectionChange = useCallback((params: any) => {
    setSelectedNodeId(params.nodes.length > 0 ? params.nodes[0].id : null);
  }, []);

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: newData } : n)));
  };

  const activeTemplate = TOPOLOGY_OPTIONS.find((option) => option.key === activeTopology) ?? TOPOLOGY_OPTIONS[0];
  const closedBoxSelected = activeTopology === 'closed_box';

  const handleSimulate = async () => {
    if (!closedBoxSelected) {
      alert(`${activeTemplate.title} is not implemented yet in Studio. Switch back to Closed Box to run the current supported workflow.`);
      return;
    }

    const freqs = Array.from({ length: 150 }, (_, i) => 20 * Math.pow(1000 / 20, i / 149));
    const payload = {
      model_dict: buildModelDict(nodes as any, edges as any),
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
      if (data.status === 'success') setSimulationResult(data.data);
      else alert(`Solver Error: ${JSON.stringify(data)}`);
    } catch {
      alert('Failed to connect to backend.');
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0, background: '#f4f6f8' }}>
      <div
        style={{
          padding: '15px 18px',
          background: '#282c34',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>os-lem Studio</strong>
          <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
            Topology-first workflow with the canvas preserved as advanced mode.
          </div>
        </div>
        <button
          onClick={handleSimulate}
          disabled={!closedBoxSelected}
          title={
            closedBoxSelected
              ? 'Run the current supported closed-box simulation workflow.'
              : `${activeTemplate.title} is not implemented yet.`
          }
          style={{
            padding: '7px 16px',
            cursor: closedBoxSelected ? 'pointer' : 'not-allowed',
            background: closedBoxSelected ? '#4CAF50' : '#7b7f87',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {closedBoxSelected ? 'Run Simulation' : `${activeTemplate.title} Not Yet Runnable`}
        </button>
      </div>

      <div style={{ padding: '16px 18px 14px 18px', borderBottom: '1px solid #d7dde5', background: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '6px', color: '#1f2937' }}>Choose a topology template first</div>
            <div style={{ fontSize: '13px', color: '#5b6470', maxWidth: '880px' }}>
              Studio now starts from enclosure family selection. Closed Box is the current supported path. Bass Reflex,
              Transmission Line, and Horn are shown as honest near-term template directions rather than hidden future work.
            </div>
          </div>
          <button
            onClick={() => setShowAdvancedCanvas((value) => !value)}
            style={{
              padding: '7px 12px',
              borderRadius: '4px',
              border: '1px solid #b9c2ce',
              background: showAdvancedCanvas ? '#eef4ff' : '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showAdvancedCanvas ? 'Hide Advanced Canvas' : 'Show Advanced Canvas'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '14px' }}>
          {TOPOLOGY_OPTIONS.map((option) => {
            const selected = option.key === activeTopology;
            const supported = option.status === 'supported';
            return (
              <button
                key={option.key}
                onClick={() => setActiveTopology(option.key)}
                style={{
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: '8px',
                  border: selected ? '2px solid #2563eb' : '1px solid #cfd8e3',
                  background: selected ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{option.title}</div>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: supported ? '#dcfce7' : '#fef3c7',
                      color: supported ? '#166534' : '#92400e',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {supported ? 'SUPPORTED' : 'UPCOMING'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px', fontWeight: 600 }}>{option.subtitle}</div>
                <div style={{ fontSize: '12px', color: '#5b6470', marginTop: '10px', lineHeight: 1.45 }}>{option.description}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: '14px',
            padding: '10px 12px',
            borderRadius: '6px',
            background: closedBoxSelected ? '#ecfdf3' : '#fff7ed',
            color: closedBoxSelected ? '#166534' : '#9a3412',
            fontSize: '13px',
            lineHeight: 1.45,
          }}
        >
          {closedBoxSelected ? (
            <>
              <strong>Current supported workflow:</strong> Closed Box is the validated path. Run Simulation updates the current
              result, and the plot workflow remains available for observable selection and reference comparison.
            </>
          ) : (
            <>
              <strong>{activeTemplate.title} is not implemented yet.</strong> This template is shown intentionally to establish
              topology-first entry. Use Closed Box for the current working simulation path. The advanced canvas remains available
              for inspection of the existing graph-based seed model.
            </>
          )}
        </div>
      </div>

      {showAdvancedCanvas ? (
        <div style={{ display: 'flex', height: '38%', borderBottom: '2px solid #d7dde5', background: '#fff' }}>
          <div style={{ flexGrow: 1 }}>
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
          <Inspector selectedNode={(nodes.find((n) => n.id === selectedNodeId) as any) || null} updateNodeData={updateNodeData} />
        </div>
      ) : (
        <div
          style={{
            padding: '18px',
            borderBottom: '2px solid #d7dde5',
            background: '#ffffff',
            color: '#4b5563',
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: '#1f2937' }}>Advanced Canvas is hidden.</strong> The topology template selector is now the primary
          entry path. Open the advanced canvas when you want to inspect or edit the current graph-based seed model directly.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, width: '100%', background: '#fff' }}>
        <ChartPanel simulationData={simulationResult} />
      </div>
    </div>
  );
}
