export type CanonicalModelSourceKind = 'graph-derived' | 'loaded-override';

export type RunnerStateTruth = {
  resultLifecycleIsAbsent: boolean;
  resultLifecycleIsCurrent: boolean;
  resultLifecycleIsStale: boolean;
  rerunNeeded: boolean;
  canonicalModelSourceLabel: string;
  canonicalModelSourceDetail: string;
  resultStateLabel: string;
  resultOwnershipLabel: string;
};

type RunnerStateTruthInput = {
  simulationResult: unknown;
  latestResultCanonicalModelSnapshotKey: string | null;
  latestResultSourceKind: CanonicalModelSourceKind | null;
  currentCanonicalModelSnapshotKey: string;
  currentCanonicalModelSourceKind: CanonicalModelSourceKind;
};

function canonicalModelSourceLabelFor(kind: CanonicalModelSourceKind): string {
  return kind === 'loaded-override'
    ? 'Loaded override is authoritative'
    : 'Graph-derived model is authoritative';
}

function canonicalModelSourceDetailFor(kind: CanonicalModelSourceKind): string {
  return kind === 'loaded-override'
    ? 'The loaded canonical model file is currently the active thin-runner source. New runs and fresh result ownership stay attached to this loaded override until you explicitly revert.'
    : 'The working graph currently derives the active thin-runner source. New runs and fresh result ownership stay attached to the graph-derived canonical model unless you load an override.';
}

function describeResultOwner(kind: CanonicalModelSourceKind): string {
  return kind === 'loaded-override' ? 'loaded override' : 'graph-derived model';
}

function resultOwnershipLabelFor({
  hasResult,
  resultSourceKind,
  currentCanonicalModelSourceKind,
  snapshotMatchesCurrent,
  sourceMatchesCurrent,
}: {
  hasResult: boolean;
  resultSourceKind: CanonicalModelSourceKind | null;
  currentCanonicalModelSourceKind: CanonicalModelSourceKind;
  snapshotMatchesCurrent: boolean;
  sourceMatchesCurrent: boolean;
}): string {
  if (!hasResult) {
    return 'No result owner recorded yet';
  }

  if (resultSourceKind == null) {
    return 'Unknown prior source';
  }

  const owner = describeResultOwner(resultSourceKind);

  if (snapshotMatchesCurrent && sourceMatchesCurrent) {
    return `Current ${owner}`;
  }

  if (sourceMatchesCurrent && !snapshotMatchesCurrent) {
    return resultSourceKind === 'loaded-override'
      ? 'Earlier loaded override (override content changed)'
      : 'Earlier graph-derived model (graph changed after run)';
  }

  if (!sourceMatchesCurrent && snapshotMatchesCurrent) {
    return resultSourceKind === 'loaded-override'
      ? 'Earlier loaded override (authority reverted)'
      : 'Earlier graph-derived model (authority moved away from graph-derived source)';
  }

  if (resultSourceKind === 'loaded-override' && currentCanonicalModelSourceKind === 'graph-derived') {
    return 'Earlier loaded override (authority reverted; active graph differs)';
  }

  if (resultSourceKind === 'graph-derived' && currentCanonicalModelSourceKind === 'loaded-override') {
    return 'Earlier graph-derived model (loaded override replaced active source)';
  }

  return `Earlier ${owner} (snapshot changed)`;
}

export function computeRunnerStateTruth({
  simulationResult,
  latestResultCanonicalModelSnapshotKey,
  latestResultSourceKind,
  currentCanonicalModelSnapshotKey,
  currentCanonicalModelSourceKind,
}: RunnerStateTruthInput): RunnerStateTruth {
  const resultLifecycleIsAbsent = simulationResult == null;
  const snapshotMatchesCurrent =
    !resultLifecycleIsAbsent && latestResultCanonicalModelSnapshotKey === currentCanonicalModelSnapshotKey;
  const sourceMatchesCurrent =
    !resultLifecycleIsAbsent && latestResultSourceKind === currentCanonicalModelSourceKind;
  const resultLifecycleIsCurrent = !resultLifecycleIsAbsent && snapshotMatchesCurrent && sourceMatchesCurrent;
  const resultLifecycleIsStale = !resultLifecycleIsAbsent && (!snapshotMatchesCurrent || !sourceMatchesCurrent);

  return {
    resultLifecycleIsAbsent,
    resultLifecycleIsCurrent,
    resultLifecycleIsStale,
    rerunNeeded: resultLifecycleIsStale,
    canonicalModelSourceLabel: canonicalModelSourceLabelFor(currentCanonicalModelSourceKind),
    canonicalModelSourceDetail: canonicalModelSourceDetailFor(currentCanonicalModelSourceKind),
    resultStateLabel: resultLifecycleIsAbsent
      ? 'No result yet'
      : resultLifecycleIsCurrent
        ? 'Current result available'
        : 'Stale result — rerun needed',
    resultOwnershipLabel: resultOwnershipLabelFor({
      hasResult: !resultLifecycleIsAbsent,
      resultSourceKind: latestResultSourceKind,
      currentCanonicalModelSourceKind,
      snapshotMatchesCurrent,
      sourceMatchesCurrent,
    }),
  };
}
