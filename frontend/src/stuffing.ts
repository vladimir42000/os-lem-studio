export const stuffingKeys=['stuffingReferenceDensity','stuffingReferenceResistivity','stuffingDensityExponent',...[1,2,3].flatMap(i=>[`stuffing${i}Start`,`stuffing${i}End`,`stuffing${i}Density`])];
export function stuffingZones(d:Record<string,any>) {
 const zones=[1,2,3].map(i=>({start:Number(d[`stuffing${i}Start`]??(i-1)*100/3),end:Number(d[`stuffing${i}End`]??i*100/3),density:Number(d[`stuffing${i}Density`]??0)}));
 for(const z of zones) if(![z.start,z.end,z.density].every(Number.isFinite)||z.start<0||z.end>100||z.end<=z.start||z.density<0) throw new Error('Stuffing zones require 0 ≤ start < end ≤ 100% and nonnegative density.');
 const active=zones.filter(z=>z.density>0).sort((a,b)=>a.start-b.start);
 if(active.some((z,i)=>i>0&&z.start<active[i-1].end-1e-9))throw new Error('Active stuffing zones must not overlap.');
 const density=Number(d.stuffingReferenceDensity??30),sigma=Number(d.stuffingReferenceResistivity??10000),exponent=Number(d.stuffingDensityExponent??1.5);
 if(![density,sigma,exponent].every(v=>Number.isFinite(v)&&v>0))throw new Error('Material reference density, resistivity and exponent must be positive.');
 const calibrated=active.map(z=>({...z,resistivity:sigma*Math.pow(z.density/density,exponent)}));
 if(calibrated.some(z=>!Number.isFinite(z.resistivity)||z.resistivity<=0))throw new Error('Material calibration produced invalid flow resistivity.');
 return calibrated;
}
