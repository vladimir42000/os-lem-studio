# Studio thin runner proof path

This patch adds a minimal explicit proof path for the revised Studio direction:

- canonical model = YAML-equivalent dict structure
- thin backend runner = `/api/simulate`
- result = numeric response arrays suitable for plotting

## What is added

- `frontend/src/thinRunner.ts`
  - `runSimulationThin(...)`
  - explicit `canonicalModel` naming
  - direct POST of canonical model + frequency sweep to backend
- minimal frontend integration in `App.tsx`
  - current simulation flow continues to work
  - the execution path is now explicit as:
    - canonical model -> backend -> numeric curves

## What is not added

- no YAML parser
- no YAML editor
- no new UI panels
- no topology expansion
- no backend contract expansion

## Current truthful scope

- Closed Box remains the truthful runnable anchor
- non-anchor paths remain gated according to current compiler/runtime truth
