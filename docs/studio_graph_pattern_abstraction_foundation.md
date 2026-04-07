# Studio graph pattern abstraction foundation

This patch introduces a minimal graph-pattern abstraction layer for the current truthful Studio line.

## Purpose

Prevent uncontrolled growth of hardcoded motif checks by expressing the current known motifs as explicit frontend-side graph patterns.

## Current patterns

- `closed_box_anchor`
  - validated runnable anchor
  - still the only truthful runnable path in the current Studio line
- `bass_reflex_seeded`
  - explicit seeded/gated pattern
  - not runnable in the current line

## Scope limits

This is not a generic graph-matching engine.
It only provides the minimal representation needed to express the current motifs and route primitive/constraint truth through them.

## Effect on compiler boundary

The compiler-boundary assessment now depends on:

1. pattern recognition
2. primitive/constraint validation
3. exact seed-vs-working-graph truth

This preserves current runtime behavior:

- Closed Box exact seed remains the compilable anchor
- Bass Reflex remains seeded/gated
- structurally edited graphs remain honestly classified
