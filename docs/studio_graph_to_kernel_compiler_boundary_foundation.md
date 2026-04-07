# Studio graph-to-kernel compiler boundary foundation

This patch freezes a bounded frontend-side compiler-boundary assessment for the current Studio line.

## Purpose

Studio now evaluates the current working graph through one explicit assessment layer before allowing runtime claims.

The current frontend assessment classifies the graph into:

- `compilable_anchor`
- `seeded_but_not_runnable`
- `composition_not_yet_compilable`
- `invalid_graph`

## Current truthful line

### Compilable anchor
Only the validated Closed Box anchor motif is treated as runnable in this line.

### Seeded but not runnable
Seeded Bass Reflex, Transmission Line, and Horn paths remain explicit seed paths without runtime claims.

### Composition not yet compilable
Structural edits may move the graph beyond the current validated compiler boundary even when the graph remains meaningful as a working composition object.

### Invalid graph
Missing required motif elements or unsupported node-type combinations are reported explicitly.

## Why this matters

This patch does not implement a full compiler.

It makes the graph-to-kernel truth boundary explicit so Studio can say:

- what is runnable now
- what is only seeded
- what has moved beyond current compiler support
- why the graph is gated
