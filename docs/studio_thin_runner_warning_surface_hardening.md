# Studio thin-runner warning surface hardening

This patch adds a small, factual warning surface for the current thin-runner result path.

## Scope

- show backend/runtime warnings from the current simulation result
- keep warnings secondary to the numeric result itself
- keep the wiring tied to the existing in-memory simulation result state
- avoid backend expansion and avoid UI redesign

## Truth boundary

Warnings shown in the Studio UI come directly from the current simulation result payload.
This patch does not synthesize new diagnostic warnings client-side beyond simple empty-state handling.

## Outcome

- current-result warnings are visible
- warning display remains bounded and factual
- thin-runner / canonical-model direction remains intact
