function stringifyCanonicalModel(canonicalModel: unknown): string {
  try {
    return JSON.stringify(canonicalModel, null, 2);
  } catch (_error) {
    return '{\n  "error": "Unable to stringify canonical model"\n}';
  }
}

interface CanonicalModelInspectionProps {
  canonicalModel: unknown;
}

export default function CanonicalModelInspection({ canonicalModel }: CanonicalModelInspectionProps) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 40,
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.18)',
      }}
    >
      <details
        style={{
          background: 'rgba(255, 255, 255, 0.97)',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            padding: '10px 12px',
            fontWeight: 700,
            fontSize: 13,
            color: '#0f172a',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          Canonical model inspection
        </summary>
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 8 }}>
            Read-only inspection surface for the canonical model used by the thin runner.
          </div>
          <textarea
            readOnly
            value={stringifyCanonicalModel(canonicalModel)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 220,
              maxHeight: '42vh',
              resize: 'vertical',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#0f172a',
              color: '#e2e8f0',
              padding: 10,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          />
        </div>
      </details>
    </div>
  );
}
