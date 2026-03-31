# Studio topology and plot workflow foundation

## Purpose

This document defines the bounded product and implementation foundation for the next Studio UI phase.

It answers four immediate questions before larger UI work begins:
- topology-first or graph-first workflow
- which observables come first
- how compare/freeze should work in the first usable version
- which bounded feature patches should land next

This document is intentionally near-term and implementation-facing. It does not change the backend simulation contract in this phase.

## Product position for the next phase

Studio should move from a minimal graph demo toward a guided loudspeaker-design workflow.

For the next phase, the primary entry path should be **topology-first**, not free-form graph-first.

The current graph/canvas remains useful, but it should be treated as an **advanced mode** rather than the default starting point. The near-term goal is to let a user pick a known enclosure topology, edit the relevant parameters, run a simulation, and inspect a small set of practical plots without having to assemble everything manually on the canvas.

## Near-term first-class topology scope

The first-class topology set for the Studio UI should be:
- closed box
- bass reflex
- transmission line
- horn

Interpretation for this phase:
- **closed box** is the first topology to feel fully coherent in the UI because it is the simplest guided workflow
- **bass reflex** is the next topology to support because it adds a real second radiation path and practical tuning value
- **transmission line** and **horn** should be planned now so the UI shape does not dead-end, but they may initially arrive with simpler inspectors than the final desired form

The canvas/graph editor should remain available for:
- advanced inspection of topology structure
- future expert editing
- later custom/non-template workflows

But for the next implementation sequence, it should not be the primary product entry point.

## Primary user workflow model

The recommended primary workflow is:
1. choose a topology template
2. edit topology-aware parameters
3. run simulation manually
4. inspect the active observable plot
5. freeze the current result when useful
6. continue tuning against a single frozen reference overlay

### Recommended entry model

The first interaction in the main workflow should be a topology template selector. A user should not need to construct a topology from a blank graph to get started.

### Parameter editing model

After topology selection, the inspector should show only the parameters relevant to that topology. The near-term direction is **topology-aware panels**, not one giant generic inspector.

### Simulation trigger model

The first practical version should remain **manual button-driven re-simulation**.

Reason:
- it is operationally simple
- it avoids accidental solver churn during every field edit
- it gives a clean boundary for comparison/freeze behavior

A later live-update mode can be considered after the manual compare workflow is stable.

### Role of the current free-form canvas

The current free-form canvas should remain present, but its role changes:
- near-term: visual structure view and advanced mode
- not near-term: required primary authoring surface for all users

In other words, the product should become **template-led with an advanced graph view**, not **blank-canvas-first**.

## Plot / observable foundation

The first Studio observable set should be:
- SPL
- impedance magnitude
- phase
- displacement
- group delay

### Rationale

This set is enough to support first practical tuning decisions for the near-term topology set:
- SPL for response shape
- impedance magnitude for resonance/tuning checks
- phase for interpretation and compare context
- displacement for excursion risk
- group delay for behavior interpretation, especially as lines/horns enter

### Scope boundary

Additional observables should remain later or advanced for now. That includes any wider diagnostic set not needed for the first practical workflow.

The first UI pass should therefore optimize for clarity of the five observables above rather than trying to expose every backend output immediately.

## Plot interaction baseline

The first practical graph UX feature set should be:
- observable selector
- enlarge/maximize active graph
- zoom
- reset zoom
- manual X min/max
- manual Y min/max
- clear reset-to-default behavior

### Baseline behavior rules

#### Observable selector
- one active observable at a time in the main plot panel
- switching observable should preserve the currently loaded current/frozen results when possible
- selector labels should use plain user-facing names, not backend field names

#### Enlarge/maximize active graph
- a user should be able to expand the current plot area without leaving the simulation workflow
- this can be a simple maximize toggle, not a separate dashboard system

#### Zoom and reset
- zoom must be interactive and easy to undo
- reset must always restore the default view for the active observable

#### Manual axis control
- X min/max and Y min/max should be editable explicitly
- manual axis limits should be easy to clear
- reset-to-default must restore the topology/observable default view, not merely preserve stale values

### Default view expectation

Each observable should have a sensible default view. Manual overrides are temporary view controls, not part of the saved topology definition.

## Comparison / tuning workflow

The first comparison model should be:
- current design result
- one frozen reference result
- current shown as **solid**
- frozen reference shown as **dashed**

### Scope limit

Only one reference overlay should be supported at first.

This keeps the model understandable and avoids immediate plot-management complexity.

### Freeze behavior

The first practical compare workflow should work like this:
1. user runs simulation
2. current result is shown as the active solid trace
3. user clicks a freeze/reference action
4. the current result becomes the frozen reference
5. later runs replace only the current solid trace
6. the frozen reference remains until cleared or replaced deliberately

### Re-simulation model

For the first compare version, re-simulation remains **manual button-driven**.

That keeps comparison semantics unambiguous:
- frozen reference changes only on explicit freeze/replace
- current trace changes only on explicit run

Live auto-run may be added later, but it should not be introduced before this manual compare model is stable.

## Topology-aware layout direction

The UI should evolve toward topology-specific working layouts instead of one generic node/field arrangement.

### Closed box layout
- simple driver plus enclosure context
- inspector focused on driver and box parameters
- plot workflow should be the main focus because topology structure is simple

### Bass reflex layout
- driver + box + port semantics should be explicit
- inspector should expose tuning-relevant port and volume parameters clearly
- comparison workflow is especially important here because tuning iteration is central

### Transmission line / horn layout
- longer-path topologies need more spatial and structural guidance
- the graph/canvas becomes more useful here as an advanced structural view
- however, parameter editing should still be driven by topology-aware panels rather than a generic raw node editor

### Preferred inspector direction

Topology-specific inspector panels are preferred over one giant generic inspector.

Reason:
- fewer irrelevant fields per topology
- lower cognitive load
- cleaner path for guided tuning workflows
- easier future extension without turning the inspector into a catch-all form

## Implementation ladder

The next bounded Studio patches should follow this sequence:

1. `feat/studio-observable-selector-and-expanded-plot-panel`
   - add the first observable selector
   - add enlarge/maximize behavior for the active graph
   - add baseline zoom/reset and manual axis controls
   - keep one active plot focus rather than a multi-panel dashboard

2. `feat/studio-reference-overlay-compare-mode`
   - add freeze current result as reference
   - overlay one dashed reference against one solid current result
   - keep manual run as the update trigger

3. `feat/studio-topology-template-selector`
   - add topology-first entry path
   - make closed box the initial polished path
   - keep the current canvas available as advanced mode rather than removing it

4. `feat/studio-topology-aware-inspector-panels`
   - split editing UI by topology
   - reduce generic inspector overload
   - align parameter panels with the chosen template/topology

5. `feat/studio-bass-reflex-topology-support`
   - add the first next topology after closed box
   - validate the topology-first workflow on a more realistic tuning use case

## Immediate execution guidance

When the next real feature patches open, decisions should follow this document unless current repo truth proves a specific correction is needed.

The practical rule is:
- topology templates become the primary workflow direction
- the graph/canvas remains as advanced mode
- the first plot experience must become usable before topology breadth expands
- compare/freeze should land before large topology expansion
