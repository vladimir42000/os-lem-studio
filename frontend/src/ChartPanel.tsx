import { memo, useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { buildObservableOptions, toNumericArray, overlaySeries, type Overlay, type ObservableId } from './chartData';
type ObservableOption = ReturnType<typeof buildObservableOptions>[number];

interface ChartPanelProps { simulationData: any; overlays?: Overlay[]; stale?: boolean }

function defaultObservableId(options: ObservableOption[]): ObservableId {
  return options.find((option) => option.values.length > 0)?.id ?? 'spl';
}

export default memo(function ChartPanel({ simulationData, overlays = [], stale = false }: ChartPanelProps) {
  const [selectedObservableId, setSelectedObservableId] = useState<ObservableId>('spl');

  const freqs = useMemo(() => toNumericArray(simulationData?.frequencies_hz), [simulationData]);
  const displayData = simulationData ?? overlays[0]?.data;
  const observableOptions = useMemo(() => buildObservableOptions(displayData), [displayData]);
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

  if (!simulationData && overlays.length === 0) {
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

  const comparisonSeries = overlaySeries(overlays, selectedObservableId);
  const missing = overlays.filter(o=>!comparisonSeries.some(s=>s.name===`${o.label}${o.reference ? ' (reference)' : ''}`));
  const allX = [...xValues, ...comparisonSeries.flatMap(s=>s.data.map(p=>p[0]))];
  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value: number | number[]) => {
        const ordinate = Array.isArray(value) ? value[1] : value;
        return Number.isFinite(ordinate) ? `${ordinate.toFixed(3)} ${selectedObservable?.unit ?? ''}`.trim() : '';
      },
    },
    legend: { type: 'scroll', top: 0, selectedMode: false },
    grid: { left: 65, right: 28, top: 60, bottom: 90 },
    xAxis: {
      type: 'log',
      logBase: 10,
      min: allX.reduce((a,b)=>Math.min(a,b),Infinity),
      max: allX.reduce((a,b)=>Math.max(a,b),-Infinity),
      minorTick: { show: true },
      minorSplitLine: { show: true },
      name: 'Frequency (Hz)',
      nameLocation: 'middle',
      nameGap: 34,
      axisLabel: {
        hideOverlap: true,
        formatter: (value: string) => Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}k` : `${Math.round(Number(value))}`,
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
      ...(simulationData ? [{
        name: stale ? 'Current model (previous calculation)' : 'Current model',
        type: 'line',
        smooth: false,
        showSymbol: false,
        data: seriesValues.map((value, index) => [xValues[index], value]),
        lineStyle: { width: 3, color: stale ? '#94a3b8' : '#2563eb', type: stale ? 'dashed' : 'solid' },
        itemStyle: { color: stale ? '#94a3b8' : '#2563eb' },
        z: 4,
      }] : []),
      ...comparisonSeries,
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

      {missing.length > 0 && <p role="status">{missing.map(m=>m.label).join(', ')}: this observable is unavailable in the saved result.</p>}
      {availablePointCount === 0 && comparisonSeries.length === 0 ? (
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
        <ReactECharts className="main-response-chart" notMerge option={option} style={{ height: '100%', minHeight: 280, width: '100%' }} />
      )}
    </div>
  );
});
