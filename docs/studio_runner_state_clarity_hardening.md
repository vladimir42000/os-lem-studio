# Studio runner state clarity hardening

This patch adds a small frontend-side runner-state summary for the current thin-runner line.

## Purpose

Make the current thin-runner/result state more visible without broadening runtime claims or redesigning the UI.

## What is shown

- canonical model source
  - loaded canonical model override active
  - graph-derived canonical model active
- simulation result state
  - no result yet
  - result available
- current warning count from the current simulation result

## Scope boundary

This patch does not change backend behavior, plotting contracts, topology support, or canonical-model truth hierarchy.
