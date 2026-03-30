import { useCallback, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge, Connection, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import Inspector from './Inspector';
import ChartPanel from './ChartPanel';
import { buildModelDict } from './translator';

const initialNodes = [
  { id: 'node_driver_1', position: { x: 250, y: 150 }, data: { type: 'driver', label: '12NW100 Driver', model: 'ts_classic', Sd: 531, Bl: 21.3, Re: 5.0, Mms: 94, Cms: 0.15, Rms: 4.1, Le: 1.4 } },
  { id: 'node_volume_1', position: { x: 500, y: 50 }, data: { type: 'volume', label: 'Rear Chamber', Vb: 50.0 } },
  { id: 'node_radiator_1', position: { x: 500, y: 250 }, data: { type: 'radiator', label: 'Front Radiation', model: 'infinite_baffle_piston', Sd: 531 } }
];

const initialEdges = [
  { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' },
  { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' }
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const onSelectionChange = useCallback((params: any) => setSelectedNodeId(params.nodes.length > 0 ? params.nodes[0].id : null), []);
  const updateNodeData = (id: string, newData: any) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: newData } : n)));

  const handleSimulate = async () => {
    // Generate a proper logarithmic frequency sweep array (20Hz to 1000Hz)
    const freqs = Array.from({ length: 150 }, (_, i) => 20 * Math.pow(1000 / 20, i / 149));
    const payload = { model_dict: buildModelDict(nodes, edges), frequencies_hz: freqs, experimental_mode: false };
    
    try {
      const res = await fetch('http://localhost:8000/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'success') setSimulationResult(data.data);
      else alert("Solver Error: " + JSON.stringify(data));
    } catch (e) { alert("Failed to connect to backend."); }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0 }}>
      <div style={{ padding: '15px', background: '#282c34', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
        <strong>os-lem Studio (Contract v1)</strong>
        <button onClick={handleSimulate} style={{ padding: '5px 15px', cursor: 'pointer', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px' }}>Run Simulation</button>
      </div>
      <div style={{ display: 'flex', height: '60%', borderBottom: '2px solid #ccc' }}>
        <div style={{ flexGrow: 1 }}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={onSelectionChange} fitView>
            <Background /><Controls />
          </ReactFlow>
        </div>
        <Inspector selectedNode={nodes.find(n => n.id === selectedNodeId) || null} updateNodeData={updateNodeData} />
      </div>
      <div style={{ height: '40%', width: '100%', background: '#fff' }}>
        <ChartPanel simulationData={simulationResult} />
      </div>
    </div>
  );
}
