import type { Node, Edge } from 'reactflow';
type GraphSnapshot = { nodes: Node[]; edges: Edge[] };
export const closedBoxTemplate: GraphSnapshot = {
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

export const bassReflexTemplate: GraphSnapshot = {
  nodes: [
    {
      id: 'node_driver_1',
      type: 'default',
      position: { x: 240, y: 160 },
      data: {
        type: 'driver', label: 'Reference TS driver', model: 'ts_classic',
        Re: 5.8, Le: 0.35, Fs: 34, Qes: 0.42, Qms: 4.1, Vas: 55, Sd: 132, source_voltage_rms: 2.83,
      },
    },
    {
      id: 'node_volume_1',
      type: 'default',
      position: { x: 500, y: 50 },
      data: {
        type: 'volume',
        label: 'Rear Chamber',
        Vb: 28,
      },
    },
    {
      id: 'node_port_1',
      type: 'default',
      position: { x: 520, y: 165 },
      data: {
        type: 'duct',
        label: 'Port',
        areaCm2: 24,
        lengthCm: 18,
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
        Sd: 132,
      },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'node_driver_1', target: 'node_volume_1' },
    { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' },
    { id: 'edge-3', source: 'node_volume_1', target: 'node_port_1' },
  ],
};

export const transmissionLineTemplate: GraphSnapshot = {
  nodes: [
    { ...bassReflexTemplate.nodes[0], data: { ...bassReflexTemplate.nodes[0].data } },
    { id: 'node_port_1', type: 'default', position: { x: 520, y: 50 },
      data: { type: 'waveguide_1d', label: 'Transmission line + open mouth', areaCm2: 132, mouthAreaCm2: 132, lengthCm: 160, driverOffsetCm: 0, lossNpPerM: 0 } },
    { ...bassReflexTemplate.nodes[3], data: { ...bassReflexTemplate.nodes[3].data } },
  ],
  edges: [
    { id: 'edge-1', source: 'node_driver_1', target: 'node_port_1' },
    { id: 'edge-2', source: 'node_driver_1', target: 'node_radiator_1' },
  ],
};
