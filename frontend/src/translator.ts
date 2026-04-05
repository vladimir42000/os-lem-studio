import { CanvasNode, CanvasEdge } from './types';

type NodeData = Record<string, any>;

function pickDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

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

function labelIncludes(data: NodeData, needles: string[]): boolean {
  const label = String(pickDefined(data.label, data.role, data.name, '')).toLowerCase();
  return needles.some((needle) => label.includes(needle));
}

function firstNode(nodes: CanvasNode[], predicate: (node: CanvasNode) => boolean): CanvasNode | null {
  return nodes.find(predicate) ?? null;
}

function allNodes(nodes: CanvasNode[], predicate: (node: CanvasNode) => boolean): CanvasNode[] {
  return nodes.filter(predicate);
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
    node_front: 'front',
    node_rear: 'rear',
  };
}

function buildClosedBoxModel(nodes: CanvasNode[]) {
  const driverNode = firstNode(nodes, (node) => node.data?.type === 'driver');
  const volumeNode = firstNode(nodes, (node) => node.data?.type === 'volume');
  const frontRadiatorNode = firstNode(
    nodes,
    (node) => node.data?.type === 'radiator' && !labelIncludes(node.data ?? {}, ['port', 'vent']),
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
  const ductNode = firstNode(
    nodes,
    (node) =>
      node.data?.type === 'duct' ||
      labelIncludes(node.data ?? {}, ['port', 'vent']) ||
      pickDefined(node.data?.portAreaCm2, node.data?.portLengthCm, node.data?.Ap, node.data?.Lp) !== undefined,
  );

  const radiatorNodes = allNodes(nodes, (node) => node.data?.type === 'radiator');
  const explicitPortRadiator = firstNode(
    radiatorNodes,
    (node) => labelIncludes(node.data ?? {}, ['port', 'vent']),
  );
  const frontRadiatorNode =
    firstNode(radiatorNodes, (node) => !labelIncludes(node.data ?? {}, ['port', 'vent'])) ?? radiatorNodes[0] ?? null;

  const ductData = ductNode?.data ?? {};
  const portAreaCm2 = readNumber(
    ductData,
    ['area_cm2', 'Area', 'Sd', 'portAreaCm2', 'Ap', 'port_area_cm2'],
    25,
  );
  const portLengthCm = readNumber(
    ductData,
    ['length_cm', 'Length', 'Lp', 'portLengthCm', 'port_length_cm', 'L'],
    15,
  );

  const portRadiatorData = explicitPortRadiator?.data ?? {
    type: 'radiator',
    label: 'Port Radiation',
    model: 'infinite_baffle_piston',
    Sd: portAreaCm2,
  };

  const modelDict: any = {
    meta: {
      name: 'studio_simulation',
      radiation_space: '2pi',
      studio_topology: 'bass_reflex',
      studio_br_minimum_runnable_candidate: true,
      studio_br_validation_note:
        'Bass reflex remains gated. The current Studio line emits separate front and port SPL traces plus impedance, but does not yet expose a validated first-class combined system SPL observable.',
      studio_br_system_spl_status: 'blocked',
      studio_br_system_spl_blocker:
        'A truthful BR system SPL path still requires either a kernel-native summed radiation observable or another validated phase-aware system-pressure contract. The current separate spl_front and spl_port traces are not yet sufficient to ungate BR runtime.',
      studio_br_system_spl_next_patch: 'audit/studio-bass-reflex-kernel-summed-observable-contract',
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

  // Minimum vented-box candidate path:
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

  return modelDict;
}

export function buildModelDict(nodes: CanvasNode[], _edges: CanvasEdge[]) {
  const hasDuctNode = nodes.some((node) => node.data?.type === 'duct');
  const hasPortHint = nodes.some(
    (node) =>
      labelIncludes(node.data ?? {}, ['port', 'vent']) ||
      pickDefined(node.data?.portAreaCm2, node.data?.portLengthCm, node.data?.Ap, node.data?.Lp) !== undefined,
  );

  if (hasDuctNode || hasPortHint) {
    return buildBassReflexModel(nodes);
  }

  return buildClosedBoxModel(nodes);
}
