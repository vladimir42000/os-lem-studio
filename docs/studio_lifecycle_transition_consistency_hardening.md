# Studio lifecycle transition consistency hardening

Patch: feat/studio-lifecycle-transition-consistency-hardening

## Scope

This patch performs one bounded validation and hardening pass over the already-landed App-level lifecycle model.

It does **not** expand topology support, runtime behavior, backend scope, or UI workflow concepts.

## Intent

Keep App.tsx as the semantic authority for lifecycle truth while extracting one tiny pure helper so the surfaced runner-state outputs continue to come from one explicit computation path.

The helper is intentionally narrow:

- it accepts explicit App-owned lifecycle inputs
- it returns the surfaced runner-state outputs only
- it does not hold state
- it does not move truth into UI surfaces

## Transition matrix validated by this hardening pass

| Transition | Canonical source after transition | Result state | Displayed result belongs to | Rerun needed |
|---|---|---|---|---|
| no-result initialization | current App authority | No result yet | No result owner recorded yet | no |
| override -> run | loaded override | Current result available | Current loaded override | no |
| override -> run -> revert | graph-derived model | Stale result — rerun needed | Earlier loaded override (authority reverted; active graph differs) or Earlier loaded override (authority reverted) when snapshots still match | yes |
| graph edit after run | graph-derived model | Stale result — rerun needed | Earlier graph-derived model (graph changed after run) | yes |
| override replacement after run | loaded override | Stale result — rerun needed | Earlier loaded override (override content changed) | yes |

## Hardening outcome

The following surfaced outputs continue to be derived together from one explicit lifecycle computation block:

- `canonicalModelSourceLabel`
- `resultStateLabel`
- `resultOwnershipLabel`
- `rerunNeeded`

The hardening also keeps these distinctions explicit:

- **source authority** answers which canonical model is currently authoritative
- **result ownership** answers what the displayed result belongs to
- **result state** answers whether that result is current or stale relative to the active authority
- **rerunNeeded** is derived from lifecycle mismatch, never from UI strings
