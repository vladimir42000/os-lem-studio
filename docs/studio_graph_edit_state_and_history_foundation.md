# Studio graph edit state and history foundation

## Purpose

This patch makes the editable acoustic graph a more durable in-session working object.

It adds a bounded graph-state foundation for:
- preserved seed graph snapshot
- separate mutable working graph
- undo
- redo
- reset to seed

## Control model

Studio now distinguishes explicitly between:

- **seed graph**: the preserved template-generated graph snapshot for the currently selected topology
- **working graph**: the mutable graph that receives parameter edits and structural edits during the current session

Templates seed the graph once. They do not remain the live working object.

## History model

The first bounded history model uses full graph snapshots.

- bounded in-memory stack
- undo steps backward through working-graph snapshots
- redo steps forward through working-graph snapshots
- reset-to-seed restores the preserved seed snapshot for the currently selected topology

This is intentionally simple and local to the frontend.

## Truthful runtime semantics

The validated runnable anchor remains the seeded Closed Box path.

- parameter edits on the seeded Closed Box path remain within the current truthful anchor
- structural edits can move the graph into composition mode
- composition mode must not pretend the original seeded runtime path is still validated if structural compatibility has been lost

Bass Reflex remains guided and seeded, but still gated according to the current accepted Studio truth.

## Boundary of this patch

This patch does **not** add:
- persistence/save-load
- new topology runtime claims
- backend expansion
- broad compiler redesign
- workspace redesign

It only establishes bounded graph durability and control for the existing seeded workbench line.
