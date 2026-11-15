# Results tuning — first step

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
as previous. This is a stale-result indication, not yet gesture-level Undo.
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

The next step is the two-axis pointer pad, per-parameter sensitivity and one Undo
operation per complete drag. Those interactions are not part of this checkpoint.
