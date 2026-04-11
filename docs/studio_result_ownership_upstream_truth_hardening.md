# Studio result ownership upstream truth hardening

## Scope

This patch hardens the runner-state truth production inside `frontend/src/App.tsx`.

It does not change backend behavior, topology scope, graph-workbench scope, or the visible summary surface contract.

## What changed

A single upstream computation block now derives:

- `canonicalModelSourceLabel`
- `canonicalModelSourceDetail`
- `resultStateLabel`
- `resultOwnershipLabel`
- `rerunNeeded`

The computation now uses explicit lifecycle inputs:

- current canonical-model snapshot key
- current canonical-model source kind
- latest result snapshot key
- latest result source kind
- result presence

## Why

Previously, the labels were assembled inline from multiple local branches. The result remained readable, but the source-of-truth logic was spread across the component.

This patch centralizes that truth so downstream UI remains a thin consumer and rerun semantics are derived from lifecycle facts rather than presentation strings.

## Behavioral effect

- result ownership now states what source the visible result belongs to
- stale ownership can distinguish source drift from snapshot drift
- result state stays separate from ownership
- `rerunNeeded` is driven by source/snapshot mismatch, not by UI copy

## Boundary

This is still the YAML-first thin-runner line.
No backend expansion or topology broadening is introduced.
