interface SimulationWarningsSurfaceProps {
  warnings: string[];
  isStale: boolean;
}

export default function SimulationWarningsSurface({ warnings, isStale }: SimulationWarningsSurfaceProps) {
  const cleanedWarnings = Array.isArray(warnings)
    ? warnings.filter((warning) => typeof warning === 'string' && warning.trim().length > 0)
    : [];

  if (cleanedWarnings.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: 10,
        padding: '10px 12px',
        border: '1px solid #f5c2c7',
        borderRadius: 8,
        background: '#fff5f5',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#842029', marginBottom: 6 }}>
        {isStale ? 'Thin-runner warnings from stale result' : 'Thin-runner warnings'}
      </div>
      {isStale ? (
        <div style={{ fontSize: 12, color: '#842029', lineHeight: 1.45, marginBottom: 6 }}>
          These warnings belong to the latest available result, but that result no longer matches the current canonical model.
        </div>
      ) : null}
      <ul style={{ margin: 0, paddingLeft: 18, color: '#842029', fontSize: 12, lineHeight: 1.45 }}>
        {cleanedWarnings.map((warning, index) => (
          <li key={`${index}-${warning.slice(0, 24)}`}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
