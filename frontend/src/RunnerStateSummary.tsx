interface RunnerStateSummaryProps {
  canonicalModelSourceLabel: string;
  resultStateLabel: string;
  warningCount: number;
  rerunNeeded?: boolean;
  hasLoadedOverride?: boolean;
  [key: string]: unknown;
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

function sourceTruthCopy(
  canonicalModelSourceLabel: string,
  hasLoadedOverride?: boolean,
): { title: string; detail: string } {
  const normalized = canonicalModelSourceLabel.toLowerCase();
  const loaded = hasLoadedOverride ?? normalized.includes('loaded');

  if (loaded) {
    return {
      title: 'Loaded canonical model override active',
      detail:
        'The loaded canonical model is currently the thin-runner truth. New runs and current-result ownership follow the loaded override until you revert to the graph-derived canonical model.',
    };
  }

  return {
    title: 'Graph-derived canonical model active',
    detail:
      'The editable Studio state is currently contributing the graph-derived canonical model. New runs and current-result ownership follow that graph-derived canonical model.',
  };
}

function resultTruthCopy(resultStateLabel: string, rerunNeeded?: boolean): string {
  const normalized = resultStateLabel.toLowerCase();
  const stale = rerunNeeded ?? normalized.includes('stale') ?? normalized.includes('rerun');

  if (normalized.includes('no result')) {
    return 'No current simulation result is available yet for the active canonical model.';
  }

  if (stale) {
    return 'The displayed result no longer matches the active canonical model. Rerun the thin runner to refresh ownership and make the result current again.';
  }

  return 'The displayed result belongs to the active canonical model and is currently valid for inspection and export.';
}

export default function RunnerStateSummary({
  canonicalModelSourceLabel,
  resultStateLabel,
  warningCount,
  rerunNeeded,
  hasLoadedOverride,
}: RunnerStateSummaryProps) {
  const warningLabel = warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : 'no warnings';
  const sourceCopy = sourceTruthCopy(canonicalModelSourceLabel, hasLoadedOverride);
  const resultCopy = resultTruthCopy(resultStateLabel, rerunNeeded);

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
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
        Thin runner state
      </div>
      <SummaryRow label="Canonical model source" value={canonicalModelSourceLabel} />
      <SummaryRow label="Simulation result" value={resultStateLabel} />
      <SummaryRow label="Warnings" value={warningLabel} />

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid #e2e8f0',
          display: 'grid',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
            {sourceCopy.title}
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{sourceCopy.detail}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
            Result ownership
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{resultCopy}</div>
        </div>
      </div>
    </div>
  );
}
