interface SimulationWarningsSurfaceProps {
  warnings: string[];
}

export default function SimulationWarningsSurface({ warnings }: SimulationWarningsSurfaceProps) {
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
        Thin-runner warnings
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#842029', fontSize: 12, lineHeight: 1.45 }}>
        {cleanedWarnings.map((warning, index) => (
          <li key={`${index}-${warning.slice(0, 24)}`}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
