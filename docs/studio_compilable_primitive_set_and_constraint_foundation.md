# Studio compilable primitive set and constraint foundation

This patch makes the current truthful compiler line more explicit in the frontend editor layer.

## Current explicit primitive set

The bounded primitive vocabulary recognized in the current Studio truthful line is:

- `driver`
- `volume`
- `radiator`
- `duct`

These primitives do **not** all mean the same thing in every topology state.

### Primitive support status by current truthful line

#### Closed Box validated runnable anchor

- `driver` → validated runnable anchor
- `volume` → validated runnable anchor
- `radiator` → validated runnable anchor
- `duct` → unsupported in current truthful Closed Box line

#### Bass Reflex seeded/gated path

- `driver` → seeded/gated
- `volume` → seeded/gated
- `radiator` → seeded/gated
- `duct` → seeded/gated

#### Transmission Line / Horn current line

- primitives are not yet compilable in the current truthful line
- template presence does not imply runnable support

## Current explicit graph constraints

The current frontend-side compiler-boundary truth now checks bounded constraints such as:

- empty graph
- unsupported primitive types in the current truthful line
- required motif members present
- required anchor/gated path connections present
- no unsupported extra primitive for the Closed Box anchor
- exact validated Closed Box anchor recognition
- exact seeded Bass Reflex graph recognition

These checks are intentionally explicit and enumerated rather than generalized.

## Runtime truth integration

Graph compilability assessment now flows through the primitive/constraint layer before assigning:

- `compilable_anchor`
- `seeded_but_not_runnable`
- `composition_not_yet_compilable`
- `invalid_graph`

This keeps the current truthful line centralized:

- Closed Box exact motif remains the only validated runnable anchor
- Bass Reflex remains seeded/gated
- Transmission Line remains non-runnable
- Horn remains non-runnable

## Why this patch matters

This patch does not expand topology support.
It makes the current compiler truth more explicit inside the editor/workbench layer so the graph is assessed against a bounded primitive and constraint contract instead of looser ad hoc checks.
