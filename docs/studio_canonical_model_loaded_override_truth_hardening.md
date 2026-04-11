# Studio Canonical Model Loaded Override Truth Hardening

## Purpose

This patch hardens the truth boundary between the graph-derived canonical model and a loaded canonical model override.

The goal is not to broaden runtime capability. The goal is to make the current thin-runner workflow more explicit about which canonical model is authoritative for:

- new runs,
- current result ownership,
- stale/current lifecycle interpretation.

## Frozen truth

The active canonical model remains the primary frontend truth for the thin-runner workflow.

When a loaded canonical model override is active:

- the loaded canonical model becomes the canonical truth for new runs,
- result ownership must be interpreted against that loaded canonical model,
- stale/current lifecycle checks must follow that loaded canonical model rather than the graph-derived model.

When no loaded override is active:

- the graph-derived canonical model remains the canonical truth for new runs,
- result ownership follows the graph-derived canonical model.

## Implementation surface

This patch is intentionally small.

It hardens the existing thin-runner surfaces by:

- clarifying loaded override truth in `CanonicalModelFileControls.tsx`,
- clarifying canonical model source and result ownership semantics in `RunnerStateSummary.tsx`.

## Non-goals

This patch does not:

- add YAML editing,
- broaden topology/runtime support,
- redesign layout,
- expand backend API,
- reopen graph-workbench-first direction.
