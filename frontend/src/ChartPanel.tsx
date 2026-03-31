import { useMemo, useState, type CSSProperties } from 'react';
import ReactECharts from 'echarts-for-react';

interface ChartPanelProps {
  simulationData: any;
}

type ObservableKey = 'spl' | 'zin_mag' | 'phase' | 'displacement' | 'group_delay';

type ObservableSpec = {
  key: ObservableKey;
  label: string;
  yAxisLabel: string;
  unit: string;
  values: number[];
  available: boolean;
  availabilityNote?: string;
};

const OBSERVABLE_LABELS: Record<ObservableKey, string> = {
  spl: 'SPL',
  zin_mag: 'Impedance Magnitude',
  phase: 'Phase',
  displacement: 'Displacement',
  group_delay: 'Group Delay',
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toFiniteNumber(entry))
    .filter((entry): entry is number => entry !== null);
}

function findSeriesByType(simulationData: any, requestedType: string): number[] {
  const observationTypes = simulationData?.observation_types;
  const series = simulationData?.series;

  if (!observationTypes || !series || typeof observationTypes !== 'object' || typeof series !== 'object') {
    return [];
  }

  for (const [observationId, observationType] of Object.entries(observationTypes)) {
    if (observationType === requestedType) {
      const values = toNumberArray(series[observationId]);
      if (values.length > 0) {
        return values;
      }
    }
  }

  return [];
}

function complexPairFromValue(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const real = toFiniteNumber(value[0]);
    const imag = toFiniteNumber(value[1]);
    if (real !== null && imag !== null) {
      return [real, imag];
    }
  }

  if (value && typeof value === 'object') {
    const candidate = value as { real?: unknown; imag?: unknown };
    const real = toFiniteNumber(candidate.real);
    const imag = toFiniteNumber(candidate.imag);
    if (real !== null && imag !== null) {
      return [real, imag];
    }
  }

  return null;
}

function computePhaseDegrees(complexValues: unknown): number[] {
  if (!Array.isArray(complexValues)) {
    return [];
  }

  const output: number[] = [];
  for (const entry of complexValues) {
    const pair = complexPairFromValue(entry);
    if (pair) {
      output.push((Math.atan2(pair[1], pair[0]) * 180) / Math.PI);
    }
  }

  return output;
}

function toSeriesPairs(frequenciesHz: number[], values: number[]): Array<[number, number]> {
  const pairCount = Math.min(frequenciesHz.length, values.length);
  const pairs: Array<[number, number]> = [];

  for (let index = 0; index < pairCount; index += 1) {
    pairs.push([frequenciesHz[index], values[index]]);
  }

  return pairs;
}

function parseAxisBound(input: string, requirePositive: boolean): number | undefined {
  if (input.trim() === '') {
    return undefined;
  }

  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (requirePositive && parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function buildObservableSpecs(simulationData: any): Record<ObservableKey, ObservableSpec> {
  const splDirect = toNumberArray(simulationData?.series?.spl_front);
  const splByType = findSeriesByType(simulationData, 'spl');
  const splValues = splDirect.length > 0 ? splDirect : splByType;

  const impedanceMagnitude = toNumberArray(simulationData?.properties?.zin_mag_ohm);
  const phaseDegrees = computePhaseDegrees(simulationData?.properties?.zin_complex_ohm);
  const displacement = toNumberArray(simulationData?.properties?.cone_excursion_mm);

  const groupDelayByType = findSeriesByType(simulationData, 'group_delay');
  const groupDelayFromProperties = toNumberArray(
    simulationData?.properties?.group_delay_ms ?? simulationData?.properties?.group_delay_s,
  );
  const groupDelay = groupDelayByType.length > 0 ? groupDelayByType : groupDelayFromProperties;

  return {
    spl: {
      key: 'spl',
      label: OBSERVABLE_LABELS.spl,
      yAxisLabel: 'SPL (dB)',
      unit: 'dB',
      values: splValues,
      available: splValues.length > 0,
      availabilityNote: 'No SPL series is currently present in the backend response.',
    },
    zin_mag: {
      key: 'zin_mag',
      label: OBSERVABLE_LABELS.zin_mag,
      yAxisLabel: 'Impedance (Ohm)',
      unit: 'Ω',
      values: impedanceMagnitude,
      available: impedanceMagnitude.length > 0,
      availabilityNote: 'No impedance magnitude array is currently present in the backend response.',
    },
    phase: {
      key: 'phase',
      label: OBSERVABLE_LABELS.phase,
      yAxisLabel: 'Phase (deg)',
      unit: 'deg',
      values: phaseDegrees,
      available: phaseDegrees.length > 0,
      availabilityNote: 'Phase is only available when complex impedance values are returned.',
    },
    displacement: {
      key: 'displacement',
      label: OBSERVABLE_LABELS.displacement,
      yAxisLabel: 'Displacement (mm)',
      unit: 'mm',
      values: displacement,
      available: displacement.length > 0,
      availabilityNote: 'Displacement is not yet present in the current backend payload for this simulation.',
    },
    group_delay: {
      key: 'group_delay',
      label: OBSERVABLE_LABELS.group_delay,
      yAxisLabel: 'Group Delay',
      unit: 'ms',
      values: groupDelay,
      available: groupDelay.length > 0,
      availabilityNote: 'Group delay is not yet exposed by the current backend payload.',
    },
  };
}

function cloneSimulationData(simulationData: any): any {
  if (simulationData == null) {
    return null;
  }

  return JSON.parse(JSON.stringify(simulationData));
}

export default function ChartPanel({ simulationData }: ChartPanelProps) {
  const [selectedObservable, setSelectedObservable] = useState<ObservableKey>('spl');
  const [isExpanded, setIsExpanded] = useState(false);
  const [xMinInput, setXMinInput] = useState('');
  const [xMaxInput, setXMaxInput] = useState('');
  const [yMinInput, setYMinInput] = useState('');
  const [yMaxInput, setYMaxInput] = useState('');
  const [chartResetNonce, setChartResetNonce] = useState(0);
  const [frozenReferenceData, setFrozenReferenceData] = useState<any>(null);

  const frequenciesHz = useMemo(() => toNumberArray(simulationData?.frequencies_hz), [simulationData]);
  const observableSpecs = useMemo(() => buildObservableSpecs(simulationData), [simulationData]);
  const activeObservable = observableSpecs[selectedObservable];
  const activePairs = useMemo(
    () => toSeriesPairs(frequenciesHz, activeObservable.values),
    [frequenciesHz, activeObservable],
  );

  const referenceFrequenciesHz = useMemo(
    () => toNumberArray(frozenReferenceData?.frequencies_hz),
    [frozenReferenceData],
  );
  const referenceObservableSpecs = useMemo(
    () => buildObservableSpecs(frozenReferenceData),
    [frozenReferenceData],
  );
  const referenceObservable = referenceObservableSpecs[selectedObservable];
  const referencePairs = useMemo(
    () => toSeriesPairs(referenceFrequenciesHz, referenceObservable.values),
    [referenceFrequenciesHz, referenceObservable],
  );

  const availableObservableLabels = (Object.values(observableSpecs) as ObservableSpec[])
    .filter((entry) => entry.available)
    .map((entry) => entry.label);

  const xMin = parseAxisBound(xMinInput, true);
  const xMax = parseAxisBound(xMaxInput, true);
  const yMin = parseAxisBound(yMinInput, false);
  const yMax = parseAxisBound(yMaxInput, false);

  const resetZoomOnly = () => {
    setChartResetNonce((value) => value + 1);
  };

  const resetAxesAndZoom = () => {
    setXMinInput('');
    setXMaxInput('');
    setYMinInput('');
    setYMaxInput('');
    setChartResetNonce((value) => value + 1);
  };

  const freezeCurrentAsReference = () => {
    setFrozenReferenceData(cloneSimulationData(simulationData));
  };

  const clearReference = () => {
    setFrozenReferenceData(null);
  };

  const chartSeries = [];
  if (activePairs.length > 0) {
    chartSeries.push({
      name: `${activeObservable.label} - Current`,
      type: 'line',
      smooth: false,
      showSymbol: false,
      data: activePairs,
      lineStyle: { width: 2 },
    });
  }

  if (referencePairs.length > 0) {
    chartSeries.push({
      name: `${referenceObservable.label} - Frozen Reference`,
      type: 'line',
      smooth: false,
      showSymbol: false,
      data: referencePairs,
      lineStyle: { width: 2, type: 'dashed' },
    });
  }

  const chartOptions = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value: unknown) => {
        const numeric = toFiniteNumber(value);
        return numeric === null ? '' : `${numeric.toFixed(3)} ${activeObservable.unit}`;
      },
    },
    legend: {
      bottom: 4,
      data: chartSeries.map((series) => series.name),
    },
    grid: {
      left: '7%',
      right: '4%',
      top: '10%',
      bottom: '18%',
    },
    dataZoom: [
      {
        type: 'inside',
        filterMode: 'none',
      },
      {
        type: 'slider',
        filterMode: 'none',
        bottom: 42,
      },
    ],
    xAxis: {
      type: 'log',
      logBase: 10,
      name: 'Frequency (Hz)',
      nameLocation: 'middle',
      nameGap: 28,
      min: xMin,
      max: xMax,
      minorSplitLine: { show: true },
      splitLine: { show: true },
      axisLabel: {
        formatter: (value: number) => `${value}`,
      },
    },
    yAxis: {
      type: 'value',
      name: activeObservable.yAxisLabel,
      min: yMin,
      max: yMax,
      splitLine: { show: true },
      axisLabel: {
        formatter: (value: number) => `${value}`,
      },
    },
    series: chartSeries,
  };

  const panelStyle: CSSProperties = isExpanded
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#ffffff',
        padding: '12px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }
    : {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px',
        boxSizing: 'border-box',
      };

  const controlsRowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'center',
    padding: '8px 10px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    background: '#fafafa',
  };

  const labelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '12px',
    color: '#333',
  };

  const inputStyle: CSSProperties = {
    width: '92px',
    padding: '6px 8px',
    border: '1px solid #bfbfbf',
    borderRadius: '4px',
  };

  const buttonStyle: CSSProperties = {
    padding: '7px 10px',
    border: '1px solid #bfbfbf',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
  };

  if (!simulationData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f9f9f9', color: '#888' }}>
        Click &quot;Run Simulation&quot; to generate acoustic graphs.
      </div>
    );
  }

  const hasCurrentSeries = activePairs.length > 0;
  const hasReferenceSeries = referencePairs.length > 0;
  const hasRenderableSeries = hasCurrentSeries || hasReferenceSeries;
  const currentAvailabilityText = hasCurrentSeries ? 'available' : activeObservable.availabilityNote;
  const referenceAvailabilityText = frozenReferenceData
    ? hasReferenceSeries
      ? 'available'
      : referenceObservable.availabilityNote
    : 'none frozen';

  return (
    <div style={panelStyle}>
      <div style={controlsRowStyle}>
        <label style={labelStyle}>
          Observable
          <select
            value={selectedObservable}
            onChange={(event) => setSelectedObservable(event.target.value as ObservableKey)}
            style={{ ...inputStyle, width: '220px' }}
          >
            {(Object.entries(OBSERVABLE_LABELS) as Array<[ObservableKey, string]>).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          X min (Hz)
          <input type="number" value={xMinInput} onChange={(event) => setXMinInput(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          X max (Hz)
          <input type="number" value={xMaxInput} onChange={(event) => setXMaxInput(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Y min
          <input type="number" value={yMinInput} onChange={(event) => setYMinInput(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Y max
          <input type="number" value={yMaxInput} onChange={(event) => setYMaxInput(event.target.value)} style={inputStyle} />
        </label>

        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" onClick={freezeCurrentAsReference} style={buttonStyle}>
            {frozenReferenceData ? 'Replace Frozen Reference' : 'Freeze Current as Reference'}
          </button>
          <button type="button" onClick={clearReference} style={buttonStyle} disabled={!frozenReferenceData}>
            Clear Reference
          </button>
          <button type="button" onClick={resetZoomOnly} style={buttonStyle}>
            Reset Zoom
          </button>
          <button type="button" onClick={resetAxesAndZoom} style={buttonStyle}>
            Reset Axes
          </button>
          <button type="button" onClick={() => setIsExpanded((value) => !value)} style={buttonStyle}>
            {isExpanded ? 'Restore Panel' : 'Maximize Plot'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span>Active observable: <strong>{activeObservable.label}</strong></span>
        <span>Available now: {availableObservableLabels.length > 0 ? availableObservableLabels.join(', ') : 'none'}</span>
      </div>

      <div style={{ fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span>Current run: <strong>solid</strong> ({currentAvailabilityText})</span>
        <span>Frozen reference: <strong>dashed</strong> ({referenceAvailabilityText})</span>
      </div>

      <div style={{ flexGrow: 1, minHeight: 0, border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden', background: '#fff' }}>
        {hasRenderableSeries ? (
          <ReactECharts
            key={`${selectedObservable}-${chartResetNonce}-${hasReferenceSeries ? 'ref' : 'noref'}`}
            option={chartOptions}
            notMerge={true}
            lazyUpdate={true}
            style={{ height: '100%', width: '100%' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f9f9f9', color: '#666', padding: '20px', textAlign: 'center', gap: '8px' }}>
            <strong>{activeObservable.label} is not available for either the current run or the frozen reference.</strong>
            <span>Current: {currentAvailabilityText}</span>
            <span>Frozen reference: {referenceAvailabilityText}</span>
          </div>
        )}
      </div>

      {Array.isArray(simulationData?.warnings) && simulationData.warnings.length > 0 ? (
        <div style={{ fontSize: '12px', color: '#8a6d3b', background: '#fcf8e3', border: '1px solid #faebcc', borderRadius: '6px', padding: '8px 10px' }}>
          Backend warnings: {simulationData.warnings.join(' | ')}
        </div>
      ) : null}
    </div>
  );
}
