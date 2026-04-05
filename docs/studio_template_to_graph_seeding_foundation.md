# Studio template-to-graph seeding foundation

Studio is now moving from topology selection as workflow framing toward topology selection as explicit graph seeding.

## Direction frozen in this patch

- Template selection must create a concrete initial acoustic graph.
- The graph is the real working object.
- Guided closed-box and bass-reflex flows remain useful, but only as seed scaffolds and validation anchors.
- The advanced canvas is the visible surface for seeded graph structures.

## What this patch establishes

1. Template selection generates explicit graph state, not only UI wording.
2. Seeded graph state carries template-origin metadata so later structural editing and compilation can build on it.
3. Closed box and bass reflex remain useful seed generators.
4. The current canvas remains the graph surface for seeded structures.

## Immediate implication for later implementation

Near-term Studio patches should now prefer:
- structural graph editing on seeded graphs
- graph-aware inspection and compilation
- diagnostic workbench value on seeded graphs

over:
- additional standard-box shell polish that does not strengthen seeded graph composition.
