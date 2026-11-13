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
