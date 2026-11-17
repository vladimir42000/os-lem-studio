import type { Node } from 'reactflow';
export type Parameter = { id: string; nodeId: string; key: string; group: string; label: string; unit: string; value: number; allowZero: boolean };
export function parametersFor(nodes: Node[], topology: string): Parameter[] {
  if (topology === 'horn') return [];
  return nodes.flatMap(node => {
    const d = node.data || {};
    let fields: [string,string,string,number,boolean?][] = [];
    let group = '';
    if (d.type === 'driver') { group = 'Loudspeaker'; fields = [
      ['Re','Re','ohm',5.8],['Le','Le','mH',.35],['Fs','Fs','Hz',34],['Qes','Qes','',.42],['Qms','Qms','',4.1],
      ['Vas','Vas','liters',55],['Sd','Sd','cm²',132],['source_voltage_rms','Drive voltage','V RMS',2.83],['series_resistance_ohm','Series resistance','Ω',0,true],
    ]; }
    if (d.type === 'volume') { group = 'Box'; fields = [['Vb','Volume','liters',18]]; }
    if (d.type === 'radiator' && topology === 'closed_box') { group = 'Box'; fields = [['Sd','Radiating area','cm²',132]]; }
    if (d.type === 'duct') { group = 'Box'; fields = [['areaCm2','Port area','cm²',24],['lengthCm','Port length','cm',18]]; }
    if (d.type === 'waveguide_1d') { group = 'Box'; fields = [
      ['areaCm2','Closed-end area','cm²',132],['mouthAreaCm2','Mouth area','cm²',d.areaCm2 ?? 132],['lengthCm','Line length','cm',160],
      ['driverOffsetCm','Driver distance from closed end','cm',0,true],['lossNpPerM','Attenuation','Np/m',0,true],
    ]; }
    if(d.type === 'waveguide_1d') {
      fields.push(['stuffingReferenceDensity','Material reference density','kg/m³',30],['stuffingReferenceResistivity','Material reference resistivity','Pa·s/m²',10000],['stuffingDensityExponent','Density scaling exponent','',1.5]);
      for(let i=1;i<=3;i++) fields.push(
        [`stuffing${i}Start`,`Stuffing ${i} start`,'%',(i-1)*100/3,true],
        [`stuffing${i}End`,`Stuffing ${i} end`,'%',i*100/3,true],
        [`stuffing${i}Density`,`Stuffing ${i} density`,'kg/m³',0,true]);
    }
    return fields.map(([key,label,unit,fallback,allowZero]) => ({id:`${topology}:${node.id}:${key}`,nodeId:node.id,key,group:['source_voltage_rms','series_resistance_ohm'].includes(key)?'Amplifier':group,label,unit,value:d[key] ?? fallback,allowZero:!!allowZero}));
  });
}

export function boxSummary(nodes:Node[],topology:string):string {
 const line=nodes.find(n=>n.data.type==='waveguide_1d')?.data;
 if(line) return `Line air volume: ${((Number(line.areaCm2??132)+Number(line.mouthAreaCm2??line.areaCm2??132))/2*Number(line.lengthCm??160)/1000).toFixed(2)} L (linear area taper; before driver displacement)`;
 const box=nodes.find(n=>n.data.type==='volume')?.data;
 if(box) {const port=nodes.find(n=>n.data.type==='duct')?.data;return `Net box air volume: ${Number(box.Vb??18).toFixed(2)} L${topology==='bass_reflex'&&port?`; port air volume: ${(Number(port.areaCm2??24)*Number(port.lengthCm??18)/1000).toFixed(2)} L`:''} (excludes walls and driver displacement)`;}
 return '';
}
