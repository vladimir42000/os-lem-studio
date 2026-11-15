import { CanvasNode, CanvasEdge } from './types';

type NodeData = Record<string, any>;

function readText(data: NodeData, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return fallback;
}

function readNumber(data: NodeData, keys: string[], fallback: number): number {
  for (const key of keys) {
    const raw = data[key];
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function withUnit(value: number, unit: string): string {
  return `${value} ${unit}`;
}

function firstNode(nodes: CanvasNode[], predicate: (node: CanvasNode) => boolean): CanvasNode | null {
  return nodes.find(predicate) ?? null;
}

function buildDriver(driverNode: CanvasNode | null) {
  const data = driverNode?.data ?? {};

  return {
    id: 'drv1',
    model: readText(data, ['model'], 'ts_classic'),
    Re: withUnit(readNumber(data, ['Re'], 5.8), 'ohm'),
    Le: withUnit(readNumber(data, ['Le'], 0.35), 'mH'),
    Fs: withUnit(readNumber(data, ['Fs'], 34), 'Hz'),
    Qes: readNumber(data, ['Qes'], 0.42),
    Qms: readNumber(data, ['Qms'], 4.1),
    Vas: withUnit(readNumber(data, ['Vas'], 55), 'l'),
    Sd: withUnit(readNumber(data, ['Sd'], 132), 'cm2'),
    source_voltage_rms: readNumber(data, ['source_voltage_rms'], 2.83),
    node_front: 'front',
    node_rear: 'rear',
  };
}

function buildClosedBoxModel(nodes: CanvasNode[]) {
  const driverNode = firstNode(nodes, (node) => node.data?.type === 'driver');
  const volumeNode = firstNode(nodes, (node) => node.data?.type === 'volume');
  const frontRadiatorNode = firstNode(
    nodes,
    (node) => node.data?.type === 'radiator',
  );

  const modelDict: any = {
    meta: {
      name: 'studio_simulation',
      radiation_space: '2pi',
      studio_topology: 'closed_box',
    },
    driver: buildDriver(driverNode),
    elements: [],
    observations: [],
  };

  modelDict.observations.push({
    id: 'zin',
    type: 'input_impedance',
    target: 'drv1',
  });

  modelDict.elements.push({
    id: 'rear_box',
    type: 'volume',
    node: 'rear',
    value: withUnit(readNumber(volumeNode?.data ?? {}, ['Vb', 'volume_l'], 18), 'l'),
  });

  modelDict.elements.push({
    id: 'front_rad',
    type: 'radiator',
    node: 'front',
    model: readText(frontRadiatorNode?.data ?? {}, ['model'], 'infinite_baffle_piston'),
    area: withUnit(readNumber(frontRadiatorNode?.data ?? {}, ['Sd', 'area_cm2'], 132), 'cm2'),
  });

  modelDict.observations.push({
    id: 'spl_front',
    type: 'spl',
    target: 'front_rad',
    distance: '1 m',
  });

  return modelDict;
}

function buildBassReflexModel(nodes: CanvasNode[]) {
  const driverNode = firstNode(nodes, (node) => node.data?.type === 'driver');
  const volumeNode = firstNode(nodes, (node) => node.data?.type === 'volume');
  const ductNode = firstNode(nodes, node => node.data?.type === 'duct');
  const frontRadiatorNode = firstNode(nodes, node => node.data?.type === 'radiator');
  const ductData = ductNode?.data ?? {};
  const portAreaCm2 = readNumber(
    ductData,
    ['areaCm2', 'area_cm2', 'Area', 'Sd', 'portAreaCm2', 'Ap', 'port_area_cm2'],
    25,
  );
  const portLengthCm = readNumber(
    ductData,
    ['lengthCm', 'length_cm', 'Length', 'Lp', 'portLengthCm', 'port_length_cm', 'L'],
    15,
  );

  const portRadiatorData = {
    type: 'radiator',
    label: 'Port Radiation',
    model: 'unflanged_piston',
    Sd: portAreaCm2,
  };

  const modelDict: any = {
    meta: {
      name: 'studio_simulation',
      radiation_space: '2pi',
      studio_topology: 'bass_reflex',
    },
    driver: buildDriver(driverNode),
    elements: [],
    observations: [],
  };

  modelDict.observations.push({
    id: 'zin',
    type: 'input_impedance',
    target: 'drv1',
  });

  modelDict.elements.push({
    id: 'rear_box',
    type: 'volume',
    node: 'rear',
    value: withUnit(readNumber(volumeNode?.data ?? {}, ['Vb', 'volume_l'], 18), 'l'),
  });

  modelDict.elements.push({
    id: 'front_rad',
    type: 'radiator',
    node: 'front',
    model: readText(frontRadiatorNode?.data ?? {}, ['model'], 'infinite_baffle_piston'),
    area: withUnit(readNumber(driverNode?.data ?? {}, ['Sd'], 132), 'cm2'),
  });

  // Fixed vented-box path:
  // rear chamber -> duct vent -> vent mouth radiator
  modelDict.elements.push({
    id: 'vent_duct',
    type: 'duct',
    node_a: 'rear',
    node_b: 'vent_mouth',
    area: withUnit(portAreaCm2, 'cm2'),
    length: withUnit(portLengthCm, 'cm'),
  });

  modelDict.elements.push({
    id: 'port_rad',
    type: 'radiator',
    node: 'vent_mouth',
    model: readText(portRadiatorData, ['model'], 'infinite_baffle_piston'),
    area: withUnit(readNumber(portRadiatorData, ['Sd', 'area_cm2'], portAreaCm2), 'cm2'),
  });

  modelDict.observations.push({
    id: 'spl_front',
    type: 'spl',
    target: 'front_rad',
    distance: '1 m',
  });

  modelDict.observations.push({
    id: 'spl_port',
    type: 'spl',
    target: 'port_rad',
    distance: '1 m',
  });

  modelDict.observations.push({ id: 'cone_displacement', type: 'cone_displacement', target: 'drv1' });
  modelDict.observations.push({ id: 'spl_sum', type: 'spl_sum', terms: [
    { target: 'front_rad', distance: '1 m' }, { target: 'port_rad', distance: '1 m' },
  ] });

  return modelDict;
}

function buildTransmissionLineModel(nodes: CanvasNode[]) {
  const driver = firstNode(nodes, node => node.data?.type === 'driver');
  const line = firstNode(nodes, node => node.data?.type === 'waveguide_1d');
  const area = readNumber(line?.data ?? {}, ['areaCm2'], 132);
  return {
    meta: { name: 'studio_transmission_line', radiation_space: '2pi', studio_topology: 'transmission_line' },
    driver: buildDriver(driver),
    elements: [
      { id: 'front_rad', type: 'radiator', node: 'front', model: 'infinite_baffle_piston',
        area: withUnit(readNumber(driver?.data ?? {}, ['Sd'], 132), 'cm2') },
      { id: 'rear_line', type: 'waveguide_1d', node_a: 'rear', node_b: 'mouth',
        length: withUnit(readNumber(line?.data ?? {}, ['lengthCm'], 160), 'cm'),
        area_start: withUnit(area, 'cm2'), area_end: withUnit(area, 'cm2'), profile: 'conical', segments: 16 },
      { id: 'mouth_rad', type: 'radiator', node: 'mouth', model: 'unflanged_piston', area: withUnit(area, 'cm2') },
    ],
    observations: [
      { id: 'zin', type: 'input_impedance', target: 'drv1' },
      { id: 'cone_displacement', type: 'cone_displacement', target: 'drv1' },
      { id: 'spl_front', type: 'spl', target: 'front_rad', distance: '1 m' },
      { id: 'spl_mouth', type: 'spl', target: 'mouth_rad', distance: '1 m' },
      { id: 'spl_sum', type: 'spl_sum', terms: [
        { target: 'front_rad', distance: '1 m' }, { target: 'mouth_rad', distance: '1 m' },
      ] },
    ],
  };
}

export function buildModelDict(nodes: CanvasNode[], _edges: CanvasEdge[]) {
  // Dispatch on primitives, never on user-editable display labels.
  if (nodes.some(node => node.data?.type === 'waveguide_1d')) return buildTransmissionLineModel(nodes);
  if (nodes.some(node => node.data?.type === 'duct')) return buildBassReflexModel(nodes);
  return buildClosedBoxModel(nodes);
}
