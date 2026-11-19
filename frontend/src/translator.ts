import {stuffingZones} from './stuffing';
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

function requiredPositiveNumber(data: NodeData, keys: string[], name: string): number {
  let selected: number | undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const raw = data[key];
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (raw === '' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a positive finite number.`);
      }
      if (selected !== undefined && selected !== value) {
        throw new Error(`Conflicting values for ${name}; parameter aliases must agree.`);
      }
      selected = value;
    }
  }
  if (selected === undefined) throw new Error(`Missing required ${name}.`);
  return selected;
}

function withUnit(value: number, unit: string): string {
  return `${value} ${unit}`;
}

function firstNode(nodes: CanvasNode[], predicate: (node: CanvasNode) => boolean): CanvasNode | null {
  return nodes.find(predicate) ?? null;
}

function buildDriver(driverNode: CanvasNode | null) {
  if (!driverNode || driverNode.data?.model !== 'ts_classic') {
    throw new Error('A supported ts_classic driver with complete parameters is required.');
  }
  const data = driverNode.data;
  if (['Bl', 'Mms', 'Cms', 'Rms'].some(key => Object.prototype.hasOwnProperty.call(data, key))) {
    throw new Error('Mixed explicit driver coefficients cannot be silently substituted into ts_classic.');
  }

  return {
    id: 'drv1',
    model: data.model,
    Re: withUnit(requiredPositiveNumber(data, ['Re'], 'driver Re'), 'ohm'),
    Le: withUnit(requiredPositiveNumber(data, ['Le'], 'driver Le'), 'mH'),
    Fs: withUnit(requiredPositiveNumber(data, ['Fs'], 'driver Fs'), 'Hz'),
    Qes: requiredPositiveNumber(data, ['Qes'], 'driver Qes'),
    Qms: requiredPositiveNumber(data, ['Qms'], 'driver Qms'),
    Vas: withUnit(requiredPositiveNumber(data, ['Vas'], 'driver Vas'), 'l'),
    Sd: withUnit(requiredPositiveNumber(data, ['Sd'], 'driver Sd'), 'cm2'),
    source_voltage_rms: requiredPositiveNumber(data, ['source_voltage_rms'], 'driver source_voltage_rms'),
    ...(readNumber(data,['series_resistance_ohm'],0)>0 ? {series_resistance_ohm:readNumber(data,['series_resistance_ohm'],0)} : {}),
    node_front: 'front',
    node_rear: 'rear',
  };
}

function matchedFrontRadiatorArea(driverNode: CanvasNode | null, radiatorNode: CanvasNode | null): number {
  // In the fixed BR/TL configurations the front radiator is the driver's
  // diaphragm. Its separately editable area must not be silently ignored.
  const driverSd = requiredPositiveNumber(driverNode?.data ?? {}, ['Sd'], 'driver Sd');
  const radiatorSd = requiredPositiveNumber(radiatorNode?.data ?? {}, ['Sd', 'area_cm2'], 'front radiator area');
  if (radiatorSd !== driverSd) {
    throw new Error('Front radiator area must match driver Sd.');
  }
  return radiatorSd;
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
    value: withUnit(requiredPositiveNumber(volumeNode?.data ?? {}, ['Vb', 'volume_l'], 'rear chamber volume'), 'l'),
  });

  modelDict.elements.push({
    id: 'front_rad',
    type: 'radiator',
    node: 'front',
    model: readText(frontRadiatorNode?.data ?? {}, ['model'], 'infinite_baffle_piston'),
    area: withUnit(requiredPositiveNumber(frontRadiatorNode?.data ?? {}, ['Sd', 'area_cm2'], 'front radiator area'), 'cm2'),
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
  const portAreaCm2 = requiredPositiveNumber(
    ductData,
    ['areaCm2', 'area_cm2', 'Area', 'Sd', 'portAreaCm2', 'Ap', 'port_area_cm2'],
    'port area',
  );
  const portLengthCm = requiredPositiveNumber(
    ductData,
    ['lengthCm', 'length_cm', 'Length', 'Lp', 'portLengthCm', 'port_length_cm', 'L'],
    'port length',
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
    value: withUnit(requiredPositiveNumber(volumeNode?.data ?? {}, ['Vb', 'volume_l'], 'rear chamber volume'), 'l'),
  });

  modelDict.elements.push({
    id: 'front_rad',
    type: 'radiator',
    node: 'front',
    model: readText(frontRadiatorNode?.data ?? {}, ['model'], 'infinite_baffle_piston'),
    area: withUnit(matchedFrontRadiatorArea(driverNode, frontRadiatorNode), 'cm2'),
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
  const frontRadiator = firstNode(nodes, node => node.data?.type === 'radiator');
  const line = firstNode(nodes, node => node.data?.type === 'waveguide_1d');
  const data = line?.data ?? {};
  const area = requiredPositiveNumber(data, ['areaCm2'], 'transmission line area');
  // Missing end area preserves legacy uniform-line graphs.
  const mouthArea = readNumber(data, ['mouthAreaCm2'], area);
  const lengthCm = requiredPositiveNumber(data, ['lengthCm'], 'transmission line length');
  const offsetCm = readNumber(data, ['driverOffsetCm'], 0);
  const lineSegments=readNumber(data,['lineSegments'],64);
  if(!Number.isInteger(lineSegments)||lineSegments<16||lineSegments>512)throw new Error('Line segments must be an integer from 16 to 512.');
  const loss = readNumber(data, ['lossNpPerM'], 0);
  // Kernel 'conical' currently means linear AREA, not linear radius.
  const driverArea = area + (mouthArea - area) * offsetCm / lengthCm;
  const section = (id: string, nodeA: string, nodeB: string, length: number, start: number, end: number) => ({
    id, type: 'waveguide_1d', node_a: nodeA, node_b: nodeB,
    length: withUnit(length, 'cm'), area_start: withUnit(start, 'cm2'), area_end: withUnit(end, 'cm2'),
    profile: 'conical', segments: Math.max(1, Math.ceil(lineSegments * length / lengthCm)), loss,
  });
  let sections: any[] = offsetCm > 0 ? [
    section('closed_stub', 'closed_end', 'rear', offsetCm, area, driverArea),
    section('rear_line', 'rear', 'mouth', lengthCm - offsetCm, driverArea, mouthArea),
  ] : [section('rear_line', 'rear', 'mouth', lengthCm, area, mouthArea)];
  const zones=stuffingZones(data);
  if(zones.length) {
    const epsilon=lengthCm*1e-10;
    const boundaries=[0,lengthCm,offsetCm,...zones.flatMap(z=>[z.start*lengthCm/100,z.end*lengthCm/100])].sort((a,b)=>a-b).filter((x,i,a)=>i===0||x-a[i-1]>epsilon);
    const nodeAt=(x:number)=>Math.abs(x-offsetCm)<=epsilon?'rear':x===0?'closed_end':Math.abs(x-lengthCm)<=epsilon?'mouth':`stuffing_boundary_${boundaries.indexOf(x)}`;
    sections=boundaries.slice(0,-1).map((a,i)=>{
      const b=boundaries[i+1],mid=(a+b)/2/lengthCm*100;
      const zone=zones.find(z=>mid>=z.start&&mid<=z.end);
      return {...section(`line_section_${i}`,nodeAt(a),nodeAt(b),b-a,area+(mouthArea-area)*a/lengthCm,area+(mouthArea-area)*b/lengthCm),...(zone?{flow_resistivity:zone.resistivity}:{})};
    });
  }
  return {
    meta: { name: 'studio_transmission_line', radiation_space: '2pi', studio_topology: 'transmission_line',
      studio_line_assumptions: zones.length ? 'Linear area taper; Miki equivalent-fluid full-fill zones; user-calibrated density power law; additional uniform attenuation' : 'Linear area taper; uniform attenuation alpha in Np/m; unchanged sound speed; no material-density calibration',
      studio_driver_offset_cm: offsetCm, ...(zones.length?{studio_stuffing: {model:'Miki 1990 equivalent fluid; full cross-section zones',calibration:'User power law: sigma=sigma_ref*(density/density_ref)^exponent. Defaults illustrative, not material measurements.',zones}}:{}) },
    driver: buildDriver(driver),
    elements: [
      { id: 'front_rad', type: 'radiator', node: 'front', model: 'infinite_baffle_piston',
        area: withUnit(matchedFrontRadiatorArea(driver, frontRadiator), 'cm2') },
      ...sections,
      { id: 'mouth_rad', type: 'radiator', node: 'mouth', model: 'unflanged_piston', area: withUnit(mouthArea, 'cm2') },
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
