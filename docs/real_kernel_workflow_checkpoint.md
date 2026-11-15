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

## Manual confirmation and editable Closed Box checkpoint

The user confirmed the redesigned Results view on the Chromebook and provided
SPL, impedance and phase screenshots after saving, loading and rerunning the
model. Curves appeared unchanged. This is manual visual workflow evidence, not
numerical equality or acoustic accuracy certification.

Closed Box now accepts positive finite numeric edits to the existing translator
parameters: driver Re, Le, Sd, Fs, Qes, Qms, Vas; chamber Vb/volume_l; radiator
Sd/area_cm2. Labels may change. Other fields, driver model, IDs and connections
remain seed-bound. Exact-seed metadata remains false after parameter changes.
The editor exposes Fs/Qes/Qms/Vas, and a loaded-file banner explains which model
will run, offering an explicit return to graph editing. Primary parameter fields
are disabled while the loaded model is active.

Charts now use a numeric logarithmic frequency axis and [frequency, ordinate]
pairs, with sparse labels and no spline smoothing between calculated points.

Validation: expanded graph eligibility regression checks, eight chart-selection
checks, seven backend tests, actual HTTP volume-change/save-load workflow and
production build passed. Browser script updated for editing and rerunning but
still requires execution in a compatible browser environment.

Dependency review: npm audit initially reported 19 findings (1 low, 11 moderate,
7 high). Non-forced npm audit fix updated the lockfile within existing manifest
ranges: 1 package added, 49 changed; remaining 9 findings (8 moderate, 1 high).
Remaining paths include Vite/esbuild and minimatch through typescript-eslint.
The npm-suggested forced Vite upgrade crosses a major version and is deferred
for a dedicated compatibility check. No security-clean release claim is made.
All installed lockfile package Node engine ranges accept Node 20.19.2; execution
was tested on Node 24.22.1, not the Chromebook runtime. Bundle-size and Python
test-client deprecation warnings remain open.

Update instructions: pull the Studio branch, run npm --prefix frontend ci,
restart Vite and refresh the page. Kernel/backend changes are not required for
this checkpoint. Next: finish dependency remediation and browser/runtime checks.

## 2026-11-15 — runnable Bass Reflex and uniform TL

User confirmed the Closed Box edit/save/load/rerun workflow. At their request,
Studio now supports two additional fixed, editable templates:

- Bass Reflex: TS driver, chamber, lumped port and unflanged mouth.
- Uniform TL: TS driver at the line entrance, 16-segment lossless uniform
  waveguide and unflanged mouth. No stuffing, taper or offset-driver support.

Both expose phase-aware combined SPL through kernel `spl_sum`, separate driver
and outlet SPL, electrical impedance magnitude/phase and cone displacement.
The new sweeps use 600 logarithmic samples, 10–1000 Hz. The lower range includes
the lower BR resonance. Driver Sd sets front radiation area; line/port area
sets mouth area. Source voltage is editable. The defaults use a fully explicit
synthetic TS reference driver rather than implying measured 12NW100 data.

Fixed BR and TL structures with positive numeric parameters are runnable;
arbitrary wiring changes remain blocked. Horn remains unavailable. Topology
selection now explicitly exits a loaded-model override to prevent running the
previous loaded file when a new topology is selected.

Corrected the BR translator's `areaCm2` / `lengthCm` mismatch and removed label-
based topology selection. Moved templates into a shared module used by tests.
Kept source/result ownership, stale-state and save/load behavior.

Validation: production TypeScript/Vite build; graph gate regressions for CB,
BR and TL; SPL-selection tests; live Python backend + frontend runner workflow
for all three topologies; nine Python tests including independent lumped/ABCD
network comparisons for both new defaults. Existing Vite bundle-size warning
and testclient deprecation remain. No dependency changes in this patch.
Browser automation remains blocked by the workspace Chromium socket restriction;
no claim of a new visual browser test. User Chromebook check and independent
Hornresp/Akabak comparison remain outstanding. Exact JSON and CSV fixtures plus
comparison assumptions are in `examples/studio-comparison/`.

Next: reconcile external reference results, add suitable loss/termination
controls based on that evidence, and then taper/offset TL support. No claim of
arbitrary topology support or release readiness.

## 2026-11-15 — TL taper, offset and attenuation controls

Expanded the TL Studio template using existing kernel features; kernel unchanged.
Added independent closed-end and mouth areas, driver distance from the closed
end and a nonnegative attenuation coefficient (Np/m). Equal areas / zero offset /
zero attenuation reproduce the uniform lossless case. Old saved canonical models
remain runnable without migration.

The taper is linear area (the kernel's current `conical` implementation); the
UI and comparison documentation explicitly distinguish it from linear radius.
Positive offsets generate a closed stub and downstream line with continuous area
at the driver and conserved total length. Zero offset omits the stub. The mouth
radiation area follows mouth area. Segment count increased to 64 per total line,
rounded upward per section. Editing invalid values blocks simulation; offsets
at or beyond the mouth are rejected.

Stuffing is a uniform constant-attenuation approximation, gamma = alpha + jω/c,
not material/density-based stuffing. No speed-of-sound or characteristic-impedance
change is inferred from alpha. The limitation is visible beside the control and
in the exported model metadata and comparison guide.

Validation: fourteen Python tests pass, including continuous-equation reference
integration for tapered, offset, damped and combined cases, passivity, the
zero-offset limit, damping effect and segmentation convergence. Graph eligibility
and live HTTP integration tests cover the new parameters, geometry continuity,
result changes and save/load. Production frontend build passes. Existing large
bundle warning and Python testclient deprecation remain. New UI has not been
browser-tested here because Chromium is unavailable under workspace restrictions.

Added exact JSON/CSV cases `tl_taper`, `tl_offset`, `tl_stuffed`, `tl_combined` to
examples/studio-comparison with comparison instructions. External Hornresp
validation is pending; user plans to run it. Material-based stuffing prediction,
partial stuffing and alternative taper laws remain future work.
