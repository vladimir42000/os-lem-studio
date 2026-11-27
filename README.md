# os-lem Studio

React/Vite frontend + FastAPI backend adapter for os-lem.

## Reproduce the stage 1 integration

From this checkout, run `bash scripts/verify_stage1.sh`. On Linux, install Git,
Python 3.12 with venv, Node.js with npm, and the system libraries required by
Gmsh (including libGLU.so.1). The verified host used Node 24.22.3. The script
installs the Python Gmsh package and all four repository revisions into a new
temporary directory. Its path is printed first and contains the generated CSV,
JUnit reports and source checkouts after the run.

The four application commits are pinned in `integration/stage1.json`.
The Studio SHA identifies the application under test. This verification branch
adds the runner, dependency lock, manifest and these instructions. The run checks
the frontend build, four Python suites with zero skips, the unfilled TL against
its 600-row reference, resistivity sensitivity in the zoned TL, and the six
FreeCAD horn samples at 1 V RMS and 1 m. The absolute tolerances for reproducing
the CAD fixture are 1e-6 ohm in complex impedance and 1e-5 dB in SPL.

## FreeCAD horn with a driver

Verify the current Studio commit from a pushed checkout with
`STUDIO_SHA="$(git rev-parse HEAD)" bash scripts/verify_stage1.sh`.
The other three SHAs and the Python and npm locks are kept. Use the printed
verification directory to start both services in separate terminals:

```bash
# Terminal 1, from the verification directory
source venv/bin/activate
cd os-lem-studio
python -m uvicorn backend.server:app --port 8000
```

```bash
# Terminal 2, from the verification directory
cd os-lem-studio/frontend
npm run dev
```

Open the Vite URL and select **FreeCAD horn**. Load
`ausolveris/examples/freecad/conical-fixture/air-volume.stl` and
`ausolveris/examples/freecad/illustrative-driver.json`. Choose mm and confirm
the cap orientation. Use 6 mm, 1 V RMS, 1 m and the six default frequencies.
Select **Run horn sweep**, then **Download sweep CSV**. Both curves and the
table use that CSV. For other installations set `AUSOLVERIS_ROOT` to the pinned
checkout if it is not a sibling of Studio. The backend uses its own Python
interpreter for the solver, including Gmsh and the installed OS-LEM kernel.

With both servers running and Chromium and Python Playwright available, repeat
the upload, invalid-wall recovery, download and replacement-geometry checks:

```bash
python os-lem-studio/scripts/check_freecad_browser.py ausolveris/examples/freecad browser-downloads
```

## Supported development workflows

Closed Box, Bass Reflex and a transmission line with linear-area taper, offset driver and attenuation can be edited,
simulated, saved and loaded. Results include SPL and electrical impedance; BR/TL
also expose separate driver/outlet SPL and displacement. The graph Horn seed is separate from the FreeCAD workflow.
These are fixed topologies; arbitrary graph wiring remains restricted.

[Reference cases and Hornresp/Akabak comparison instructions](examples/studio-comparison/README.md)
include exact assumptions, JSON models and CSV curves. External validation is pending.

## Results tuning

Select **Show in Results** beside model parameters to edit them alongside curves.
**Memorise** keeps up to nine complete model/results; recall, compare and a dotted
reference curve are available. Sessions restore after refresh and can be exported.
See [Results tuning guide](docs/results_tuning.md). The two-axis pad supports live adjustment, sensitivity settings and one Undo per drag; a full-screen graph view keeps it beside the plot.

## Quick start

Assumptions:
- you are in the repository root
- Python virtual environment is available at `venv/`
- Node dependencies are installed under `frontend/`
- the os-lem package is available in the active Python environment

## Backend startup

Activate the Python environment, then start the backend:

```bash
source venv/bin/activate
cd backend
python server.py
```

Backend endpoint:
- `http://localhost:8000/api/simulate`

## Frontend startup

From the repository root:

```bash
npm --prefix frontend run dev
```

Frontend dev server:
- Vite will print the local URL, typically `http://localhost:5173`

## Backend regression tests

Install the Python test dependencies, then run the backend regression test file:

```bash
source venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_backend_simulation_response_regressions.py -q
```

## Notes

- `status.md`, `status.sh`, `studio_*_probe.txt`, and frontend `*.tsbuildinfo` files are local/generated artifacts and are ignored.
- This repository-level README is intentionally narrow and operational.
