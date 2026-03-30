import { CanvasNode } from './types';

interface InspectorProps {
  selectedNode: CanvasNode | null;
  updateNodeData: (nodeId: string, newData: any) => void;
}

export default function Inspector({ selectedNode, updateNodeData }: InspectorProps) {
  if (!selectedNode) return <div style={{ width: '300px', background: '#eee', padding: '20px' }}>Select a node to edit.</div>;

  const { id, data } = selectedNode;
  const handleChange = (field: string, value: string) => updateNodeData(id, { ...data, [field]: Number(value) });

  return (
    <div style={{ width: '300px', background: '#fff', padding: '20px', borderLeft: '1px solid #ccc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3>{data.label}</h3>
      {data.type === 'volume' && (
        <label>Volume (Liters): <input type="number" value={data.Vb} onChange={e => handleChange('Vb', e.target.value)} /></label>
      )}
      {data.type === 'driver' && (
        <>
          <label>Sd (cm²): <input type="number" value={data.Sd} onChange={e => handleChange('Sd', e.target.value)} /></label>
          <label>Bl (Tm): <input type="number" value={data.Bl} onChange={e => handleChange('Bl', e.target.value)} /></label>
          <label>Mms (g): <input type="number" value={data.Mms} onChange={e => handleChange('Mms', e.target.value)} /></label>
        </>
      )}
      {data.type === 'radiator' && (
        <label>Area Sd (cm²): <input type="number" value={data.Sd} onChange={e => handleChange('Sd', e.target.value)} /></label>
      )}
    </div>
  );
}
