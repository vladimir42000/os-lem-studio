import type { Node } from 'reactflow';
export type Parameter = { id: string; nodeId: string; key: string; group: string; label: string; unit: string; value: number; allowZero: boolean };
export function parametersFor(nodes: Node[], topology: string): Parameter[] {
  if (topology === 'horn') return [];
  return nodes.flatMap(node => {
    const d = node.data || {};
    let fields: [string,string,string,number,boolean?][] = [];
    let group = '';
    if (d.type === 'driver') { group = 'Driver'; fields = [
      ['Re','Re','ohm',5.8],['Le','Le','mH',.35],['Fs','Fs','Hz',34],['Qes','Qes','',.42],['Qms','Qms','',4.1],
      ['Vas','Vas','liters',55],['Sd','Sd','cm²',132],['source_voltage_rms','Drive voltage','V RMS',2.83],
    ]; }
    if (d.type === 'volume') { group = 'Enclosure'; fields = [['Vb','Volume','liters',18]]; }
    if (d.type === 'radiator' && topology === 'closed_box') { group = 'Front radiation'; fields = [['Sd','Radiating area','cm²',132]]; }
    if (d.type === 'duct') { group = 'Port'; fields = [['areaCm2','Port area','cm²',24],['lengthCm','Port length','cm',18]]; }
    if (d.type === 'waveguide_1d') { group = 'Transmission line'; fields = [
      ['areaCm2','Closed-end area','cm²',132],['mouthAreaCm2','Mouth area','cm²',d.areaCm2 ?? 132],['lengthCm','Line length','cm',160],
      ['driverOffsetCm','Driver distance from closed end','cm',0,true],['lossNpPerM','Attenuation','Np/m',0,true],
    ]; }
    return fields.map(([key,label,unit,fallback,allowZero]) => ({id:`${topology}:${node.id}:${key}`,nodeId:node.id,key,group,label,unit,value:d[key] ?? fallback,allowZero:!!allowZero}));
  });
}
