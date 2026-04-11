# Studio Override Revert and Current Source Clarity Hardening

This patch hardens the near-term canonical-model workflow around one specific truth boundary:

- when a loaded canonical model override is active, it is the authoritative thin-runner source
- when the user explicitly reverts, authority returns to the graph-derived canonical model
- result ownership and stale/current semantics must be read against that active source boundary

## What changed

The patch keeps the workflow bounded and frontend-only.

- `CanonicalModelFileControls.tsx` now states more explicitly:
  - when the loaded override is authoritative
  - what "revert" actually does
  - that reverting returns authority to the graph-derived canonical model
  - that results produced from the override may become stale after revert until rerun

- `RunnerStateSummary.tsx` now states more explicitly:
  - which canonical model source currently owns the next run
  - how to interpret current vs stale result ownership relative to that source

## What did not change

- no backend behavior changed
- no topology/runtime capability broadened
- no merge semantics were introduced between graph-derived and loaded canonical model sources
- loaded override remains authoritative only while active
- graph-derived canonical model becomes authoritative again only after explicit revert

## Outcome

The current active source and the consequences of explicit revert should now be less ambiguous without expanding the product surface.
