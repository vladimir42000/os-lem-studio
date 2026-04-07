# Studio compiler-boundary consolidation

This patch consolidates Studio compiler-boundary truth so the final compilability decision is layered as:

1. **Pattern layer** — structural classification (`graphPatterns.ts`)
2. **Constraint layer** — validity filter (`graphPrimitiveConstraints.ts`)
3. **Compilability layer** — final runnable/gated decision (`graphCompilability.ts`)

## Frozen behavior

- Closed Box remains the only validated runnable anchor.
- Bass Reflex remains seeded and gated.
- Transmission Line and Horn remain non-runnable in this line.
- Invalid graphs still come from constraint failures.

## Consolidation result

`graphCompilability.ts` no longer performs direct motif counting for Closed Box or Bass Reflex.
It now uses the matched pattern returned by the primitive/constraint layer as the primary structural truth.

The exact-anchor requirement is preserved:

- pattern must match the Closed Box anchor
- topology must be `closed_box`
- current working graph must exactly match the stored seed snapshot

If those conditions are not all true, the graph is not treated as a runnable anchor.
