import { useMemo } from 'react';

interface SimulationResultExportControlsProps {
  simulationResult: any;
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

export default function SimulationResultExportControls({
  simulationResult,
}: SimulationResultExportControlsProps) {
  const exportPayload = useMemo(() => {
    if (!simulationResult) {
      return null;
    }

    return {
      exported_at: new Date().toISOString(),
      export_type: 'studio_simulation_result',
      result: simulationResult,
    };
  }, [simulationResult]);

  const handleExportJson = () => {
    if (!exportPayload) {
      return;
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });

    const timestamp = sanitizeFilenamePart(new Date().toISOString().replace(/[:.]/g, '-'));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `studio-simulation-result-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        borderBottom: '1px solid #e5e7eb',
        background: '#f8fafc',
      }}
    >
      <div style={{ fontSize: 12, color: '#475569' }}>
        Simulation result export
        {simulationResult ? ' ready from current result state.' : ' unavailable until a simulation has been run.'}
      </div>
      <button
        onClick={handleExportJson}
        disabled={!simulationResult}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid #cbd5e1',
          background: simulationResult ? '#ffffff' : '#f1f5f9',
          color: simulationResult ? '#0f172a' : '#94a3b8',
          cursor: simulationResult ? 'pointer' : 'not-allowed',
        }}
      >
        Export Results JSON
      </button>
    </div>
  );
}
