import { useRef } from 'react';

interface CanonicalModelFileControlsProps {
  canonicalModel: Record<string, unknown>;
  onLoadCanonicalModel: (model: Record<string, unknown>) => void;
  onLoadCanonicalModelError: (message: string) => void;
  onClearLoadedCanonicalModel: () => void;
  hasLoadedOverride: boolean;
  loadError: string | null;
}

function SourceBadge({ hasLoadedOverride }: { hasLoadedOverride: boolean }) {
  const active = hasLoadedOverride
    ? { label: 'Loaded canonical model override active', bg: '#ffedd5', fg: '#9a3412' }
    : { label: 'Graph-derived canonical model active', bg: '#dcfce7', fg: '#166534' };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: active.bg,
        color: active.fg,
      }}
    >
      {active.label}
    </span>
  );
}

export default function CanonicalModelFileControls({
  canonicalModel,
  onLoadCanonicalModel,
  onLoadCanonicalModelError,
  onClearLoadedCanonicalModel,
  hasLoadedOverride,
  loadError,
}: CanonicalModelFileControlsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const exportCanonicalModel = () => {
    const blob = new Blob([JSON.stringify(canonicalModel, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'os-lem-studio-canonical-model.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Canonical model file must contain a top-level object.');
      }
      onLoadCanonicalModel(parsed as Record<string, unknown>);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load canonical model file.';
      onLoadCanonicalModelError(message);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 12,
        padding: '12px 14px',
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Canonical model file</div>
        <SourceBadge hasLoadedOverride={hasLoadedOverride} />
      </div>

      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
        Save the current canonical model or load a previously exported canonical model into the same thin-runner path.
        The canonical model remains the primary saved and loaded truth for this workflow.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={exportCanonicalModel}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Save canonical model JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Load canonical model JSON
        </button>
        {hasLoadedOverride ? (
          <button
            onClick={onClearLoadedCanonicalModel}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Revert to graph-derived model
          </button>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <div style={{ marginTop: 10, fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
        {hasLoadedOverride
          ? 'A loaded canonical model currently overrides the graph-derived model for thin-runner execution.'
          : 'The thin runner currently derives its canonical model from the active frontend graph state.'}
      </div>

      {loadError ? <div style={{ marginTop: 10, fontSize: 12, color: '#991b1b' }}>{loadError}</div> : null}
    </div>
  );
}
