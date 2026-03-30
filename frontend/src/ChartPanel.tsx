import ReactECharts from 'echarts-for-react';

interface ChartPanelProps {
  simulationData: any;
}

export default function ChartPanel({ simulationData }: ChartPanelProps) {
  if (!simulationData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f9f9f9', color: '#888' }}>
        Click "Run Simulation" to generate acoustic graphs.
      </div>
    );
  }

  // Extract the stable arrays from Contract v1 (with fallbacks for our mock data if os-lem is missing)
  const freqs = simulationData.frequencies_hz || [20, 50, 100, 1000];
  const spl = simulationData.spl || simulationData.mock_spl || [];
  const zin = simulationData.zin_mag_ohm || [];

  const options = {
    animation: false, // Turn off animation for maximum "real-time" performance later
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['SPL (dB)', 'Impedance (Ohm)'],
      bottom: 0
    },
    grid: { left: '5%', right: '5%', top: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      name: 'Frequency (Hz)',
      nameLocation: 'middle',
      nameGap: 25,
      data: freqs,
      axisLabel: {
        formatter: (value: string) => `${Number(value)}`
      }
    },
    yAxis: [
      {
        type: 'value',
        name: 'SPL (dB)',
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#5470C6' } },
        axisLabel: { formatter: '{value} dB' }
      },
      {
        type: 'value',
        name: 'Zin (Ohm)',
        position: 'right',
        axisLine: { show: true, lineStyle: { color: '#91CC75' } },
        axisLabel: { formatter: '{value} Ω' }
      }
    ],
    series: [
      {
        name: 'SPL (dB)',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: spl,
        lineStyle: { width: 2, color: '#5470C6' }
      },
      {
        name: 'Impedance (Ohm)',
        type: 'line',
        yAxisIndex: 1, // Map this to the right-side Y axis
        smooth: true,
        showSymbol: false,
        data: zin,
        lineStyle: { width: 2, color: '#91CC75' }
      }
    ]
  };

  return <ReactECharts option={options} style={{ height: '100%', width: '100%' }} />;
}
