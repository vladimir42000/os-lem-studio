import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';

type ObservableId = 'spl' | 'impedance' | 'phase' | 'displacement' | 'group_delay';

type ObservableOption = {
  id: ObservableId;
  label: string;
  unit: string;
  values: number[];
  reason?: string;
};

interface ChartPanelProps {
  simulationData: any;
}

function toNumericArray(value: unknown): number[] {
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

function buildObservableOptions(simulationData: any): ObservableOption[] {
  const series = simulationData?.series ?? {};
  const properties = simulationData?.properties ?? {};

  const splValues =
    toNumericArray(series.spl_sum) ||
    toNumericArray(series.spl_front) ||
    toNumericArray(series.spl) ||
    [];

  const impedanceValues = toNumericArray(properties.zin_mag_ohm);
  const phaseValues = computePhaseDegrees(properties.zin_complex_ohm);
  const displacementValues =
    toNumericArray(properties.cone_excursion_mm).length > 0
      ? toNumericArray(properties.cone_excursion_mm)
      : toNumericArray(series.cone_excursion_mm);
  const groupDelayValues =
    toNumericArray(series.group_delay).length > 0
      ? toNumericArray(series.group_delay)
      : toNumericArray(properties.group_delay_ms);

  return [
    {
      id: 'spl',
      label: 'SPL',
      unit: 'dB',
      values: splValues,
      reason: splValues.length > 0 ? undefined : 'No trusted SPL series is available in the current result.',
    },
    {
      id: 'impedance',
      label: 'Impedance Magnitude',
      unit: 'Ω',
      values: impedanceValues,
      reason: impedanceValues.length > 0 ? undefined : 'No impedance magnitude data is available in the current result.',
    },
    {
      id: 'phase',
      label: 'Phase',
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
      label: 'Group Delay',
      unit: 'ms',
      values: groupDelayValues,
      reason: groupDelayValues.length > 0 ? undefined : 'Group delay is not exposed by the current result payload.',
    },
  ];
}

function defaultObservableId(options: ObservableOption[]): ObservableId {
  return options.find((option) => option.values.length > 0)?.id ?? 'spl';
}

export default function ChartPanel({ simulationData }: ChartPanelProps) {
  const [selectedObservableId, setSelectedObservableId] = useState<ObservableId>('spl');

  const freqs = useMemo(() => toNumericArray(simulationData?.frequencies_hz), [simulationData]);
  const observableOptions = useMemo(() => buildObservableOptions(simulationData), [simulationData]);
  const selectedObservable = useMemo(
    () => observableOptions.find((option) => option.id === selectedObservableId) ?? observableOptions[0],
    [observableOptions, selectedObservableId],
  );

  useEffect(() => {
    const nextId = defaultObservableId(observableOptions);
    const current = observableOptions.find((option) => option.id === selectedObservableId);
    if (!current || (current.values.length === 0 && nextId !== selectedObservableId)) {
      setSelectedObservableId(nextId);
    }
  }, [observableOptions, selectedObservableId]);

  if (!simulationData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#f9fafb',
          color: '#64748b',
          padding: 24,
          textAlign: 'center',
        }}
      >
        Run the canonical model through the thin runner to inspect numeric curves.
      </div>
    );
  }

  const availablePointCount = Math.min(freqs.length, selectedObservable?.values.length ?? 0);
  const seriesValues = (selectedObservable?.values ?? []).slice(0, availablePointCount);
  const xValues = freqs.slice(0, availablePointCount);
  const availabilityText =
    selectedObservable && selectedObservable.values.length > 0
      ? `${selectedObservable.values.length} points available from current simulation result.`
      : selectedObservable?.reason ?? 'Observable is unavailable for the current result.';

  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value: number) =>
        Number.isFinite(value) ? `${value.toFixed(3)} ${selectedObservable?.unit ?? ''}`.trim() : '',
    },
    grid: { left: '6%', right: '4%', top: 36, bottom: 60 },
    xAxis: {
      type: 'category',
      data: xValues,
      name: 'Frequency (Hz)',
      nameLocation: 'middle',
      nameGap: 34,
      axisLabel: {
        formatter: (value: string) => `${Number(value)}`,
      },
    },
    yAxis: {
      type: 'value',
      name: selectedObservable ? `${selectedObservable.label} (${selectedObservable.unit})` : 'Value',
      axisLabel: {
        formatter: (value: number) => `${value}`,
      },
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', height: 22, bottom: 18 },
    ],
    series: [
      {
        name: selectedObservable?.label ?? 'Observable',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: seriesValues,
        lineStyle: { width: 2 },
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px 6px 14px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Result Observable</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>{availabilityText}</div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Current observable</span>
          <select
            value={selectedObservableId}
            onChange={(event) => setSelectedObservableId(event.target.value as ObservableId)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
            }}
          >
            {observableOptions.map((option) => {
              const unavailableSuffix = option.values.length > 0 ? '' : ' (unavailable)';
              return (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {unavailableSuffix}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {availablePointCount === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: '#f8fafc',
            color: '#64748b',
            padding: 24,
            textAlign: 'center',
          }}
        >
          {selectedObservable?.reason ?? 'No numeric data is available for the selected observable.'}
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      )}
    </div>
  );
}
