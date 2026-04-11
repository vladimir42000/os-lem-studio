# Studio thin-runner result lifecycle hardening

This patch hardens the result lifecycle semantics around the thin-runner path.

## Frozen truth in this line

- canonical model remains the primary saved and loaded truth
- the thin runner executes a canonical model snapshot
- the latest simulation result belongs to the canonical model snapshot used at run time
- current UI state must not imply that an old result is still current after the canonical model changes

## Bounded lifecycle states

The frontend now distinguishes only three result lifecycle states:

- absent: no simulation result yet
- current: latest result matches the current canonical model snapshot
- stale: latest result belongs to an earlier canonical model snapshot and rerun is needed

## Surface alignment

The following surfaces now consume real lifecycle state from `App.tsx`:

- runner state summary
- warning surface
- result export controls

## Non-goals

This patch does not broaden runtime capability, add topology support, or add backend API surface.
