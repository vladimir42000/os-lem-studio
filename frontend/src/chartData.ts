import { selectSplSeries } from './chartSeries';
export type ObservableId = 'spl' | 'impedance' | 'phase' | 'displacement' | 'group_delay' | 'spl_front' | 'spl_port' | 'spl_mouth';

type ObservableOption = {
  id: ObservableId;
  label: string;
  unit: string;
  values: number[];
  reason?: string;
};

export function toNumericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const numeric = typeof entry === 'number' ? entry : Number(entry);
      return Number.isFinite(numeric) ? numeric : null;
    })
    .filter((entry): entry is number => entry !== null);
}

function computePhaseDegrees(zinComplex: unknown): number[] {
  if (!Array.isArray(zinComplex)) return [];

  return zinComplex
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const real = Number((entry as Record<string, unknown>).real);
      const imag = Number((entry as Record<string, unknown>).imag);
      if (!Number.isFinite(real) || !Number.isFinite(imag)) return null;
      return (Math.atan2(imag, real) * 180) / Math.PI;
    })
    .filter((entry): entry is number => entry !== null);
}

export function buildObservableOptions(simulationData: any): ObservableOption[] {
  const series = simulationData?.series ?? {};
  const properties = simulationData?.properties ?? {};

  const splValues = selectSplSeries(series, simulationData?.frequencies_hz?.length ?? 0);

  const impedanceValues = toNumericArray(properties.zin_mag_ohm);
  const phaseValues = computePhaseDegrees(properties.zin_complex_ohm);
  const displacementValues =
    toNumericArray(properties.cone_excursion_mm).length > 0
      ? toNumericArray(properties.cone_excursion_mm)
      : toNumericArray(series.cone_excursion_mm);
  const groupDelayValues =
    toNumericArray(series.group_delay).length > 0
      ? toNumericArray(series.group_delay).map(v=>1000*v)
      : toNumericArray(properties.group_delay_ms);

  return [
    {
      id: 'spl',
      label: Array.isArray(series.spl_sum) ? 'SPL — combined' : 'SPL',
      unit: 'dB',
      values: splValues,
      reason: splValues.length > 0 ? undefined : 'No trusted SPL series is available in the current result.',
    },
    ...(['spl_front', 'spl_port', 'spl_mouth'] as const)
      .filter(id => Array.isArray(series.spl_sum) && Array.isArray(series[id]))
      .map(id => ({ id, label: id === 'spl_front' ? 'SPL — driver' : id === 'spl_port' ? 'SPL — port' : 'SPL — line mouth',
        unit: 'dB', values: toNumericArray(series[id]) })),
    {
      id: 'impedance',
      label: 'Impedance Magnitude',
      unit: 'Ω',
      values: impedanceValues,
      reason: impedanceValues.length > 0 ? undefined : 'No impedance magnitude data is available in the current result.',
    },
    {
      id: 'phase',
      label: 'Impedance phase',
      unit: 'deg',
      values: phaseValues,
      reason: phaseValues.length > 0 ? undefined : 'No complex impedance data is available to derive phase.',
    },
    {
      id: 'displacement',
      label: 'Displacement',
      unit: 'mm',
      values: displacementValues,
      reason: displacementValues.length > 0 ? undefined : 'Displacement is not exposed by the current result payload.',
    },
    {
      id: 'group_delay',
      label: 'Acoustic group delay (flight time excluded)',
      unit: 'ms',
      values: groupDelayValues,
      reason: groupDelayValues.length > 0 ? undefined : 'Group delay is not exposed by the current result payload.',
    },
  ];
}


export type Overlay = { id: number; label: string; data: any; reference: boolean; previous?: boolean };
const colours = ['#d97706','#059669','#9333ea','#dc2626','#0891b2','#be185d','#4d7c0f','#a16207','#475569'];
export function overlaySeries(overlays: Overlay[], observable: ObservableId) {
  return overlays.flatMap(overlay => {
    const frequencies = toNumericArray(overlay.data?.frequencies_hz);
    const values = buildObservableOptions(overlay.data).find(o=>o.id===observable)?.values ?? [];
    if (!frequencies.length || values.length !== frequencies.length) return [];
    return [{ name: `${overlay.label}${overlay.reference ? ' (reference)' : ''}`, type: 'line', showSymbol: false,
      data: frequencies.map((f,i)=>[f,values[i]]), smooth: false,
      lineStyle: { type: overlay.previous ? 'dashed' : overlay.reference ? 'dotted' : 'solid', width: overlay.reference ? 3 : 1.5, color: overlay.previous ? '#9ca3af' : colours[(overlay.id-1)%colours.length] },
      itemStyle: { color: overlay.previous ? '#9ca3af' : colours[(overlay.id-1)%colours.length] }, z: overlay.reference ? 5 : 1 }];
  });
}
