# Studio structural graph editing foundation

## Purpose

This patch establishes the first bounded structural graph editing operations on top of template-seeded graphs.

The goal is not broad arbitrary graph editing yet. The goal is to make the seeded graph a more explicit working object while keeping runtime truth honest.

## What this patch adds

The advanced canvas now exposes three bounded structural operations:

1. **Attach child to selected node**
   - inserts one new element node of a chosen type (`duct`, `volume`, or `radiator`)
   - creates a new outgoing path from the selected node

2. **Split selected path**
   - inserts one new element node into the currently selected edge
   - replaces the original edge with two edges around the inserted node

3. **Delete selected leaf**
   - removes an inserted leaf node
   - deletion is intentionally limited to non-protected leaf nodes

## Validity guardrails

This is still a foundation patch, so graph validity is intentionally bounded:

- seeded anchor nodes are protected from deletion
- deletion is limited to leaf nodes only
- structural edits clear the current simulation result
- structural edits mark the graph as **composition-mode** rather than pretending the edited graph is still inside the current seeded runtime contract

## Runtime truth after this patch

- **Closed Box** remains the stable seeded runtime anchor
- the untouched seeded closed-box graph remains runnable
- once structural graph edits occur, runtime is disabled intentionally
- this avoids implying that the current translator/compiler path already supports arbitrary edited graphs truthfully

## Why runtime is disabled after edits

The Studio direction freeze now defines the editable graph as the real working object.
But the graph-aware compiler path is not yet mature enough to claim that arbitrary edited graphs can be compiled back into a truthful runnable kernel model.

So this patch advances graph composition work honestly:
- graph structure becomes more editable
- runtime stays truthful and bounded

## What this patch does not do

- no TL runtime support
- no horn runtime support
- no broad compiler rewrite
- no reconnect-path general editor yet
- no plot workflow redesign

Reconnect-path work is deferred until graph validity rules and graph-aware compilation are stronger.

## Next recommended step

The next bounded step should move from structural graph editing foundation toward **graph-aware inspector and compiler alignment**, not back toward standard-box shell polish.
