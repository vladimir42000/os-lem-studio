# Studio canonical-model workflow polish

This patch tightens the near-term Studio workflow around the canonical model and thin runner without expanding scope.

## What it improves

- makes the active canonical-model source more explicit
- reduces ambiguity between graph-derived model and loaded override model
- keeps runner state, warnings, and result export tied to the same current simulation result
- improves wording so the thin-runner slice reads as one workflow rather than several disconnected controls

## What it does not change

- no runtime capability broadening
- no topology support expansion
- no YAML editor
- no backend API growth
- no graph-workbench reopening

## Near-term workflow after this patch

1. inspect or load the canonical model
2. confirm the active canonical-model source
3. run the thin runner
4. inspect result curves and warnings
5. export current simulation results if needed
