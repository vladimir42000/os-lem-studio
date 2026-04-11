import { useRef } from 'react';

interface CanonicalModelFileControlsProps {
  canonicalModel: Record<string, unknown>;
  onLoadCanonicalModel: (model: Record<string, unknown>) => void;
  onLoadCanonicalModelError: (message: string) => void;
  onClearLoadedCanonicalModel: () => void;
  hasLoadedOverride: boolean;
  loadError: string | null;
  [key: string]: unknown;
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
        padding: '10px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        background: '#f8fafc',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Canonical Model File</div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10, lineHeight: 1.45 }}>
        Export the active canonical model as JSON, or load a previously exported canonical model back into the thin-runner path.
        When a loaded canonical model override is active, it becomes the canonical truth for new runs until you explicitly revert.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={exportCanonicalModel}
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
        >
          Save Canonical Model
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
        >
          Load Canonical Model
        </button>
        {hasLoadedOverride ? (
          <button
            onClick={onClearLoadedCanonicalModel}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Revert to Graph-Derived Model
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
      {hasLoadedOverride ? (
        <div style={{ marginTop: 10, fontSize: 12, color: '#9a3412', lineHeight: 1.45 }}>
          Loaded canonical model override active. New runs, current-result ownership, and stale/current lifecycle are now evaluated against the loaded canonical model, not the graph-derived model.
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
          Graph-derived canonical model active. New runs and result ownership currently follow the graph-derived canonical model.
        </div>
      )}
      {loadError ? <div style={{ marginTop: 10, fontSize: 12, color: '#991b1b' }}>{loadError}</div> : null}
    </div>
  );
}
