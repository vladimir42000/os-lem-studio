# Studio real-kernel workflow checkpoint

Branch: codex/studio-real-kernel-workflow, based on 4f198a3.
Kernel tested: os-lem d9f6923 (codex/poc3-kernel-alignment).

## Changes

Missing kernel imports now produce HTTP 503 with installation guidance instead
of a dummy successful response. Empty/incomplete kernel frequency grids and
non-finite JSON output fail explicitly. The frontend explains network failures,
invalid JSON responses and service errors, and rejects empty/mismatched grids.
No new topology or compiler capability is enabled.

## Validation

- Python backend tests: 7 passed (four new failure regressions).
- Production frontend build passed.
- Real HTTP workflow passed using the actual TypeScript translator, runner and
  lifecycle functions with an OS-LEM kernel, not a mocked numerical solver.
- Tests ran under Python 3.12 and Node 24.22.1. The user's Python 3.13 / Node 20
  environment remains a separate compatibility check.

| Operation | Verified outcome |
| --- | --- |
| Closed Box model run | 150 frequencies and finite SPL returned |
| Volume edit: 18 -> 36 litres | Previous result marked stale; rerun changes impedance |
| Rerun | New model snapshot can own a current result |
| JSON serialization/load and rerun | Identical numerical series reproduced |
| Change from graph source to loaded source | Prior graph-owned result marked stale |
| Network or invalid response | Frontend rejects with an explanatory error |
| Missing kernel | HTTP 503, never a successful dummy result |
| Invalid acoustic model | Error propagates through the real HTTP runner |
| Empty/non-finite kernel result | Explicit backend error |

## Reproduce

With the kernel and backend dependencies installed in the active Python
virtual environment, and frontend dependencies installed with npm ci:

```sh
python -m pytest -q
python scripts/check_workflow.py
npm --prefix frontend run build
```

The workflow script starts a temporary backend on a free loopback port and
stops it on completion, including failure. TypeScript is transpiled using the
frontend's existing TypeScript dependency; no new npm dependency is required.
An invalid-model error in the server log is intentional in this test.

## Remaining work

This is function/HTTP integration coverage, not a browser automation test.
It does not verify the Reset button, graph editing controls, file picker,
download behavior, charts or concurrent requests. Browser interaction and
request lifecycle validation are the next bounded task. Dependency
vulnerabilities, bundle-size warning, test-client deprecation and release
installation compatibility remain open. The final release is not ready.

User authorization supersedes the older manual patch-archive delivery process;
this checkpoint is published directly to a development branch.

## Follow-up: SPL selection and request guard

The Closed Box chart previously used `[] || frontSPL`, which always selected
an empty array when summed SPL was absent. `chartSeries.ts` now selects the
first complete finite series in the existing priority order: summed, front,
generic SPL. Invalid/mismatched arrays are rejected rather than shortened and
shifted against the frequency axis. Eight focused cases pass via:

```sh
node scripts/test-chart-series.mjs
```

App now guards overlapping executions with a synchronous ref and displays a
disabled `Simulating…` button. A finally block releases the guard after success
or failure. The captured model snapshot remains the result owner.

Follow-up verification: frontend production build passed; all seven backend
tests passed; real-kernel HTTP workflow passed (kernel d9f6923).

### Browser validation remains blocked

`scripts/check_browser.mjs` was added for live Chromium testing of reset/run,
SPL chart selection, model download/upload, invalid JSON, source changes,
request locking and service errors. It has NOT passed here: Chromium fails
before page creation with `socket() failed: Operation not permitted` in the
execution workspace. Thus no visual or browser-interaction completion is
claimed. The request guard is build-checked but still awaits browser coverage.

The script requires Playwright, an installed Chromium, backend Python
requirements and frontend node_modules. It starts local services on ports
18000/18517 and routes browser simulation requests to that isolated backend.
Use only while those ports are free. Optional environment variables: PYTHON,
CHROMIUM_PATH, PLAYWRIGHT_MODULE_PATH (module entry path).

Next action: run and repair this browser test in a compatible environment,
then review dependency vulnerabilities and supported-runtime installation.

## Chromebook layout repair after user screenshots

User evidence showed 150 result points but a chart compressed into a bottom
strip under file controls, status text and the graph editor. Exported canonical
JSON is a Closed Box with a 50-litre chamber and front-SPL/impedance observations.
This was a layout defect; successful numerical tests did not validate usability.

The workspace now has Model, Results, and Files & details views. Successful
simulation opens Results and scrolls to the top. Results reserve chart height
(minimum 360px for ECharts) independently of editor/file/status content. Technical
model inspection is inline within Files & details instead of a fixed overlay.
The duplicated element inspector is collapsed under Advanced element editor.
The model view stacks canvas and inspector on narrow screens. Frequency labels
are rounded instead of displaying long floating-point strings.

Node positions no longer participate in the seed-equivalence comparison:
dragging or selecting nodes does not change acoustic semantics. Parameter and
connection changes remain subject to the existing runtime gate. A regression
script verifies these distinctions: node scripts/test-graph-layout.mjs.

Validation: production build, eight chart-selection cases and five graph-layout
cases passed. Browser harness updated for navigation and minimum chart geometry,
but live Chromium execution remains blocked in this workspace; responsive visual
behavior needs confirmation on the Chromebook. No final-release claim.
