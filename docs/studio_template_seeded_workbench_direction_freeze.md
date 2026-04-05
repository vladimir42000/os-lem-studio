# Studio template-seeded workbench direction freeze

Status: frozen operational direction for ongoing Studio implementation.

## 1. Core identity

Studio is a template-seeded acoustic topology composition workbench for acoustic systems.

Studio is **not** primarily a polished standard-box configurator.

## 2. Template role

Templates are seed generators, not the end product.

Near-term seed families may include:
- closed box
- bass reflex
- transmission line
- horn
- tapped horn
- chambered / resonant variants

Their role is to give the user a valid starting structure that can then be edited, extended, branched, simplified, or recomposed.

## 3. Primary editing target

The user’s true working object is the editable acoustic graph, not a topology form.

Topology forms remain useful when they help the user create or tune an initial seed, but they are not the final product center of gravity.

## 4. Compiler role

Studio must convert the edited graph into a kernel-valid model through a disciplined compilation layer.

This compiler layer is a core Studio responsibility. It is the bridge between:
- user-facing graph composition
- kernel-facing valid model emission

## 5. Meaning of current guided workflows

Current closed-box and bass-reflex guided workflows remain useful as:
- seed workflows
- validation anchors
- usability scaffolds

They do **not** define the final Studio identity.

## 6. Revised implementation ladder

### Phase 1 — Seeded graph entry
Templates create usable initial graphs and establish truthful starting workflows.

### Phase 2 — Structural graph editing foundation
Users can add, remove, reconnect, branch, and reshape acoustic structures directly at the graph level.

### Phase 3 — Graph-aware inspector and compiler
Inspector behavior and model emission follow graph structure, not only fixed topology forms.

### Phase 4 — Diagnostic workbench value
Studio surfaces graph-aware diagnostics, contribution views, validation cues, and inspection workflows that help users reason about topology behavior.

### Phase 5 — Higher-order assistance
Studio can later add guided suggestions, seed refinement help, topology-aware assistants, and other higher-order support on top of the graph/compiler foundation.

## 7. New Studio scope rule

Future Studio handovers must ask:

**Does this patch move Studio toward template-seeded graph composition, or is it only polishing a standard-box workflow?**

If a patch only polishes a standard-box workflow without moving Studio toward template-seeded graph composition, it must be justified as a bounded scaffold, validation anchor, or temporary usability support.
