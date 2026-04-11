interface RunnerStateSummaryProps {
  canonicalModelSourceLabel: string;
  canonicalModelSourceDetail: string;
  resultStateLabel: string;
  resultOwnershipLabel: string;
  warningCount: number;
  rerunNeeded: boolean;
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
  canonicalModelSourceDetail,
  resultStateLabel,
  resultOwnershipLabel,
  warningCount,
  rerunNeeded,
}: RunnerStateSummaryProps) {
  const warningLabel = warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : 'no warnings';
  const rerunLabel = rerunNeeded ? 'yes' : 'no';

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
      <SummaryRow label="Simulation result state" value={resultStateLabel} />
      <SummaryRow label="Displayed result belongs to" value={resultOwnershipLabel} />
      <SummaryRow label="Rerun needed" value={rerunLabel} />
      <SummaryRow label="Warnings" value={warningLabel} />
      <div style={{ marginTop: 10, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
        {canonicalModelSourceDetail}
      </div>
    </div>
  );
}
