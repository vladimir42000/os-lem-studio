# Results tuning and two-parameter pad

## Use it

1. In **Model**, tick **Show in Results** beside any numeric parameter you want
   to adjust while viewing curves. Selections are separate for each topology.
2. Open **Results**. The chosen fields use the same values as the Model tab.
   Enter a number and press Enter or leave the field to apply it. Escape cancels
   an uncommitted edit. Invalid individual values remain drafts with an error.
3. **Recalculate automatically** is on by default. Committed edits trigger a
   debounced calculation. Disable it to make several edits, then use the header
   Run button. Invalid geometry blocks simulation and explains the problem.
4. **Memorise** saves the complete current model and calculated result, including
   parameters not shown in Results. It also records the selected parameters.
   Pending, stale or invalid results cannot be memorised.
5. Click **Result 1**, **Result 2**, etc. to recall that model and its result.
   **Compare** toggles its coloured curve. **Reference** selects one dotted curve
   that stays visible independently of Compare. **Clear reference** removes that
   designation. Delete frees a slot; labels continue incrementing without reuse.
6. Use **Save tuning session** to download the workspace, all memories, selected
   parameters and comparison/reference settings. **Load tuning session** replaces
   that session after validation. The original model-only Save/Load controls remain
   in Files & details and use their original format.

There are at most nine memories. The browser automatically stores the session
under the current site origin; reopening the same localhost address restores it.
Changing host/port/browser profile creates a different storage area. If browser
storage fails or is full, an error asks you to download a session file instead.
A downloaded session is the portable backup; browser storage is not a substitute.

Current model is a prominent solid blue curve. When parameters have changed but
calculation is not complete, its last calculation is shown grey/dashed and marked
as previous. This stale-result indication is separate from the frozen **Before last drag** curve.
Memories use their own frequency samples; comparison axes span all shown data.
Unavailable observables are explicitly reported instead of silently substituting
a different saved curve. Electrical phase remains impedance phase.

Recalling a memory restores topology, graph, seed, any canonical-file override,
selected parameters and the saved calculation. It starts a fresh graph Undo
history. Editing uses graph parameters; if a loaded canonical file is active,
the graph fields are disabled with an explanation. Such file models can still
be run, memorised, compared and recalled. Select a template or recall a graph
memory for editable tuning.

## Concurrency and persistence

Only one calculation is in flight. A model/source identity and restoration
generation protect against an obsolete response replacing newer work. A queued
latest model is calculated after the in-flight request completes. Failed models
are not retried endlessly; Run explicitly retries. Import rejects malformed
sessions, more than nine memories, invalid references and model/result mismatch.
Session format is version 1, with a 10 MB file limit.

## Validation and boundaries

- `node scripts/test-tuning-state.mjs`: deep snapshots, parameter coverage, stale
  rejection, nine-slot limit, numbering, whole-model recall, session validation,
  independent frequency grids and dotted reference styling.
- `scripts/test-tuning-ui.mjs`: React DOM interactions covering pinning, editing,
  auto-calculation, memories, recall, compare/reference independence, delayed
  response rejection and refresh restoration. Requires a temporary jsdom 26
  installation through `JSDOM_MODULE_PATH`; no production dependency was added.
  Graph canvas and ECharts drawing are stubbed, so this is not visual browser QA.
- `python scripts/check_workflow.py`: actual-kernel workflows, including complete
  tuning-session export/import, memory recall and stale-result rejection.
- Production TypeScript/Vite build plus existing graph/chart and Python tests.

Example DOM-test setup (development only):

```bash
npm install --prefix /tmp/oslem-ui-tests --no-audit --no-fund jsdom@26
JSDOM_MODULE_PATH=/tmp/oslem-ui-tests/node_modules/jsdom/lib/api.js node scripts/test-tuning-ui.mjs
```

## Two-parameter pad and large graph

The graph is now the first section in Results. Memory cards, numeric fields and
exports are below it; numeric fields can be expanded when needed. Click
**Full-screen graph** for an in-page view covering the browser viewport with the
pad beside the graph. **Exit full-screen view** or Escape returns to the page.
The browser's own chrome remains visible; F11 can hide it where supported.

1. Mark at least two Model parameters with **Show in Results**.
2. Run the model, then choose distinct **Horizontal →** and **Vertical ↑**
   parameters beside the graph.
3. Hold the primary mouse button (or touch) on the pad. Right increases X;
   up increases Y. Pointer capture keeps the drag working outside the pad.
4. Release to finish. A final calculation is requested even if automatic numeric
   editing recalculation is off. Further pointer movement makes no changes.
5. **Undo last adjustment**, or the header Undo, restores the whole pre-drag graph
   and its calculation in one operation. Escape during a drag, pointer cancellation
   or window focus loss cancels and restores its starting state.

Before each drag, the starting curve is frozen as a **grey dashed** curve.
A memorised reference remains separately **dotted**. The current live result is
solid. Curves update as calculations finish; while dragging, the last completed
intermediate calculation is shown even when the pointer has moved ahead. Only
one request is in flight, with a maximum start rate around 8 Hz. The final
released position is always checked. This is not a guarantee of 8 simulations
per second; speed depends on the model and computer.

Relative sensitivity defaults to factor 2 per pad width/height:
`value = starting_value × factor^(signed_distance / pad_span)`.
A full move in the positive direction doubles, the same negative move halves.
Absolute mode uses the displayed units per pixel. For zero values, the initial
fallback is 0.01 units/pixel. Sensitivities are remembered per parameter, including
when it moves between axes, and saved with model memories and tuning sessions.
Existing sessions without pad settings remain compatible.

Positive-only quantities remain positive; nonnegative quantities cannot fall
below zero. Coupled TL geometry is kept valid: if the offset is selected it is
limited below the line length; otherwise shortening the line stops above the
existing offset. Very extreme values may still produce a backend numerical error;
Undo remains available. A press/release without a value change adds no undo entry.

The plot is memoized so pointer movement alone does not redraw unchanged curves,
and browser session writes pause during a drag. Memories can only capture a fully
calculated current result, never a pending intermediate model. Graph Undo treats
each completed drag as one change; sensitivity edits are retained when undoing.

Tests additionally cover relative/absolute increments, zero-value fallback,
live curve updates before release, saved pad settings, the grey pre-drag curve,
one-step restoration of both parameters, cancellation/release and focus-view
entry/exit. DOM tests stub actual chart drawing; visual Chromebook verification
remains outstanding.
