interface RunnerStateSummaryProps {
  canonicalModelSourceLabel: string;
  resultStateLabel: string;
  warningCount: number;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 0',
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>{value}</span>
    </div>
  );
}

export default function RunnerStateSummary({
  canonicalModelSourceLabel,
  resultStateLabel,
  warningCount,
}: RunnerStateSummaryProps) {
  const warningLabel = warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : 'No warnings';
  const runnerInterpretation =
    resultStateLabel.toLowerCase().includes('no result')
      ? 'Inspect the canonical model first, then run the thin runner to produce numeric curves.'
      : 'The current result, warnings, and export path all refer to the latest thin-runner simulation state.';

  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 14px',
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>
        Canonical model / thin runner state
      </div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45, marginBottom: 8 }}>
        This summary keeps the current canonical-model source, latest result state, and warning surface aligned.
      </div>
      <SummaryRow label="Canonical model source" value={canonicalModelSourceLabel} />
      <SummaryRow label="Simulation result" value={resultStateLabel} />
      <SummaryRow label="Warnings" value={warningLabel} />
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{runnerInterpretation}</div>
    </div>
  );
}
