# Bounded BR/TL optimisation in Results

Studio now calls the `os_lem_opt.workshop` contract. OPT owns deterministic
sampling and scoring; Studio retains graph compilation, and the existing
`perform_simulation` adapter runs OS-LEM for both normal and optimisation requests.
No acoustic construction or normalization logic is copied into OPT.

## Installation

Use the backend's Python environment to install the OPT checkout:

```bash
cd ~/Documents/OSLEM-dev
# Use a separate checkout so historical OPT work is left available.
git clone --branch feat/studio-bounded-geometry https://github.com/vladimir42000/os-lem-opt.git os-lem-opt-workshop
os-lem/.venv/bin/python -m pip install -e os-lem-opt-workshop
```

If this checkout already exists, `git -C os-lem-opt-workshop pull --ff-only`
updates it. Studio requires this branch's workshop module, not OPT's licence-only
main. Restart the backend. No new frontend dependencies or kernel changes.
Without OPT installed, ordinary simulation still works and OPT returns a clear 503.

## Workflow

1. Choose Bass Reflex or Transmission Line, run it, and open Results → Optimise.
   This is a sidebar tab beside the same chart, including full-screen mode.
2. Select one to four geometry variables and bounds containing the current value.
   BR permits net chamber volume, port area and physical port length. TL permits
   line length, driver offset, closed-end area and mouth area.
3. Set the frequency band, flat target SPL, maximum air volume and maximum
   excursion. Defaults are editable examples, not driver-specific recommendations.
4. Start. Baseline is evaluated first. Progress counts attempted candidates,
   infeasible candidates and failures. The best candidate overlays the current
   curve as the search progresses; current model parameters are unchanged.
5. Preview any of the three best feasible sampled results. Apply one to edit the
   working model, Undo to restore its prior parameters/results, or Memorise after
   Apply to retain it in the existing nine-memory/session workflow.

Applying or otherwise changing the model clears the old search. Search history
is temporary; remembered models/results survive refresh and session export.
Switching from Results cancels the search. Switching the sidebar to Manual tuning
alone does not cancel it; changing a parameter does. Stop discards an in-flight
response and retains completed candidates. The server may finish its one current
calculation; no further candidates are queued. A stopped/outdated response cannot
replace a current model or publish a candidate.

## Search and scoring contract

- Seed 17 stratified bounded sampling, 4–256 candidates (default 48), plus baseline.
  This is a reproducible finite search, not a global optimum claim.
- Every model uses the same 600 log-spaced frequencies, 10–1000 Hz, as BR/TL Studio.
- Display selection priority: complete finite `spl_sum`, then `spl_front`, then
  `spl`, identical to Studio. Missing/incomplete excursion fails evaluation.
- Minimise log-frequency-weighted RMS error in dB from the requested flat SPL.
  The integral spans the sweep samples inside the requested band. No arbitrary
  gain normalization; voltage is fixed. At least three in-band samples required.
- Feasibility requires peak absolute cone excursion across the entire 10–1000 Hz
  sweep within the chosen limit and air volume within the chosen maximum.
- BR volume = net chamber + port air. TL = length × mean end area (linear area).
  Neither includes walls, driver displacement or external envelope allowance.
- Driver/amplifier parameters, loss coefficients, material calibration and
  stuffing percentages/densities remain fixed. Changing line length moves zones
  proportionally because existing stuffing locations are percentages of length.
- Report in-band ripple and peak group delay (flight time excluded), masking
  points more than 30 dB below the requested target for the delay metric. Delay
  is a comparison metric, not an optimisation objective in this release.
- Feasible baseline participates in ranking; a worse candidate cannot silently
  replace it. Infeasible candidates never have Apply controls. No improvement is
  reported explicitly. Failed candidates are counted, with the first error shown.

No resonator insertion, stuffing search, port-noise/compression prediction,
geometry refinement, or external acoustic-validation claim is introduced.

## Validation

31 Python tests passed across the Studio suite and the new OPT contract tests.
The complete live backend search checks pass for BR and TL, including exact
normal/OPT response equality, fixed driver/stuffing settings and memory/session
round trips. With eight deterministic candidates and a development target of
85 dB over 30–200 Hz, RMS errors were BR 5.055 → 4.352 dB and TL 8.651 → 7.471 dB.
These demonstrate score improvements in the development examples only.

DOM interaction tests cover preview ownership, progress, Apply/Memorise/Undo,
Stop and stale-response rejection. Existing tuning interaction tests and the
production build pass. Chromium visual testing remains blocked by the workspace's
socket permission restriction; the saved browser test has not passed here.
The production build retains its existing large-bundle warning.

```bash
# Run from the common parent; use absolute PYTHONPATH because the live server changes cwd.
export PYTHONPATH="$PWD/os-lem/src:$PWD/os-lem-opt-workshop/src:$PWD/os-lem-studio"
python -m pytest os-lem-studio/tests os-lem-opt-workshop/tests/test_workshop.py -q
python os-lem-studio/scripts/check_optimisation_workflow.py
# jsdom 26 installation required for the following test; set JSDOM_MODULE_PATH if external.
node os-lem-studio/scripts/test-optimisation-ui.mjs
npm --prefix os-lem-studio/frontend run build
# On a machine with Playwright/Chromium available:
node os-lem-studio/scripts/check_optimisation_browser.mjs
```
