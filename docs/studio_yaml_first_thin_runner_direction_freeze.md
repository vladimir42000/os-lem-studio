# Studio YAML-first thin-runner direction freeze

Status: frozen near-term Studio direction

## Core direction

Studio near-term direction is now:

- canonical model = YAML
- backend = thin simulation runner around the canonical model
- frontend = strong plotting and inspection surface
- near-term authoring modes = seed generator and YAML edit/inspect
- graph editor / composition workbench = deferred to a later phase

This is a direction freeze for near-term product and implementation triage. It does not broaden current runtime truth.

## In scope now

Near-term Studio work should prioritize:

- load a seed or YAML model
- edit parameters in a simple authoring flow
- optionally inspect or edit YAML directly
- run simulation through a thin backend runner
- show first-class plots for:
  - SPL
  - phase
  - impedance
  - excursion
- save/load model files
- save/export simulation results

## Out of scope now

The following are not the near-term Studio priority line:

- broad topology-composition workbench ambition
- large semantic frontend/backend API surface growth
- proving many enclosure families in the UI ahead of kernel maturity
- shell/product expansion ahead of kernel benchmark maturity
- reopening graph-workbench expansion as the primary direction

## Truthful runtime posture

Current truthful product claims remain:

- Closed Box remains the current truthful runnable anchor
- nontrivial other workflows remain gated unless explicitly validated
- this direction freeze does not broaden frontend runtime claims

## Implementation priority order

Near-term Studio patches should prefer:

1. YAML-first canonical model handling
2. thin backend runner hardening
3. strong plotting and result inspection
4. simple authoring modes on top of YAML
5. save/load/export around the canonical model

Graph-editor/workbench growth is deferred until the YAML-first thin-runner line is operationally solid.

## Triage rule for future Studio patches

Before opening a new Studio patch, ask:

- does this move Studio toward a YAML-first canonical model with a thin runner and strong plotting?
- or is it drifting back into premature graph-workbench expansion or product shell growth?

If it is the latter, it is out of near-term priority unless leadership explicitly reopens that line.
