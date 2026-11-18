# Classical BR alignments and adaptive TL search

Results → Optimise now offers six BR seeds and a separate adaptive TL search.
Studio owns graph editing/compilation; OS-LEM owns acoustic calculation; OPT
owns generic search vectors and response scoring. No kernel changes are required.

## BR

SBB4, SC4, QB3, BB4, C4 and SQB3 are solved from effective Qts, including amplifier
series resistance. The ideal alignment calculation assumes QL=infinity (no added
leakage); the preview retains kernel radiation and voice-coil inductance. There
is no finite-QL control because it would promise losses not represented by this
Studio graph. Equations are independently implemented; reference:
https://www.speakerbench.com/doc/alignment_theory.html

SBB4/BB4 meet at Qts=1/sqrt(8); SC4/C4 and QB3/SQB3 meet at the B4 value
cos(3*pi/8). These family labels and positive-volume solutions determine
availability, rather than empirical universal Qts cutoffs. A family without a
physical solution or positive duct length is disabled with a reason.

The port length uses the actual kernel unflanged mouth reactance; there is no
inner end correction. Chamber plus port air volume and port-length limits block
Apply but allow preview. Driver parameters and port area stay fixed. These seeds
are not practical construction certification or external kernel validation.

## TL

SciPy Differential Evolution jointly searches length, volume, taper and driver
fraction. Up to three distinct feasible regions then receive bounded Powell
refinement. Each vector is compiled in Studio and evaluated via the same kernel
adapter as ordinary simulation. All variables may move locally, with a narrower
neighbourhood for geometry. Search budgets count requested evaluations; cached
vectors are reused. A seed gives repeatability within the same numeric environment.

Geometry is volume-coupled: S0=2V/[L(1+r)], Sm=r*S0. Defaults use L=0.5–1.2 times
c/(4Fs), driver fraction 0–0.35, S0=0.1–4 Sd, Sm=0.1–8 Sd, and an adjustable
100 L air-volume cap. Zero area is excluded. These are editable exploration
presets, not universal acoustic validity domains. Volume is internal line air,
not external cabinet volume. The current profile is linear area, not linear radius.

Optional experimental stuffing adds zone-1 start, remaining-length fraction and
density 0–15 kg/m3. Zones 2 and 3 must be off; calibration, driver, amplifier and
other loss inputs remain fixed. Density limits do not validate the illustrative
material law. Ordinary geometry search preserves all stuffing settings.

The same flat-target RMS objective and constraints are used throughout; default
band 30–300 Hz. Excursion is constrained across 10–1000 Hz. Group delay is reported
but not minimised. The search uses 64 nominal segments and 600 frequency points.
The baseline and up to three finalists are recomputed at 128/1199 and 256/2397.
Apply requires fine-grid feasibility and convergence: shared-frequency SPL change
<=0.25 dB, RMS-score change <=0.25 dB, excursion change <=max(0.01 mm, 2%).
The coarse-to-middle change is diagnostic; middle-to-fine is the gate. These finite
checks cannot guarantee detection of every narrow resonance or physical accuracy.

Stop keeps previews but does not enable unverified Apply. Editing the workspace
invalidates the search and late responses. Apply uses existing atomic Undo and
Memorise/session persistence. A verified feasible candidate can be applied even
if it does not beat the baseline; the panel explicitly reports no improvement.
Worker sessions expire after 60 seconds waiting for a reply, with four concurrent
active jobs permitted. Completed jobs remain readable for at least 60 seconds.

## Validation (2026-11-18)

- Python: 50 tests passed across Studio plus OPT workshop/adaptive tests.
- Frontend production build passed.
- DOM fixtures: BR unavailable family, preview/Apply/Undo; TL global/local states,
  verified Apply, convergence failure, Stop and stale-response rejection passed.
  Canvas/chart rendering is stubbed; this is not browser visual QA.
- Real HTTP Studio/compiler/kernel/OPT tests: both geometry-only and experimental
  stuffing searches completed 69 evaluations with local stages, volume constraints,
  unchanged driver, fine-grid recomputation and session round trip.
  Best coarse RMS: 5.161 dB (geometry), 3.340 dB (stuffing). Final resolution SPL
  differences: 0.039 and 0.001 dB; both passed convergence. These small-budget fixtures
  establish execution, not optimality, general performance or material calibration.

Reproduce from a parent containing Studio, OS-LEM and OPT checkouts, with their
source directories on PYTHONPATH and dependencies installed:

```sh
python -m pytest studio-dev/tests opt-review/tests/test_workshop.py opt-review/tests/test_adaptive.py -q
STUDIO_TEST_SCRIPT=scripts/test-tl-adaptive-workflow.mjs python studio-dev/scripts/check_optimisation_workflow.py
npm --prefix studio-dev/frontend run build
JSDOM_MODULE_PATH=/path/to/jsdom/lib/api.js node studio-dev/scripts/test-optimisation-ui.mjs
JSDOM_MODULE_PATH=/path/to/jsdom/lib/api.js node studio-dev/scripts/test-tl-adaptive-ui.mjs
```

Install/update OPT in the backend Python environment before restarting Studio;
its package now declares NumPy and SciPy dependencies. Existing BR bounded search
and ordinary manual simulation are retained.
