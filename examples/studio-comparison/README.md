# Bass Reflex and transmission-line comparison cases

These are reproducible Studio defaults, not externally validated loudspeaker designs.
Load either JSON through **Files & details → Load Canonical Model**, then run.
Alternatively select the matching topology in **Model** to edit its parameters.
Selecting a topology starts its template and switches away from a loaded file.

The CSV files contain 600 logarithmically spaced samples from 10 to 1000 Hz.
Columns: frequency, combined SPL, driver SPL, outlet SPL, impedance magnitude,
and **electrical impedance phase** (not acoustic phase). SPL is dB re 20 µPa.
The UI exposes these curves individually and cone displacement magnitude in mm.

## Common driver and observation settings

| Parameter | Value |
|---|---:|
| Re | 5.8 Ω |
| Le | 0.35 mH |
| Fs | 34 Hz |
| Qes | 0.42 |
| Qms | 4.1 |
| Vas | 55 L |
| Sd | 132 cm² |
| Drive | 2.83 V RMS, ideal voltage source |
| Distance | 1 m for both driver and outlet |
| Observation space | 2π (half-space) |
| Air density | 1.2041 kg/m³ |
| Sound speed | 343.2 m/s |

This is a synthetic reference TS driver, not a manufacturer-validated 12NW100.
For tools using mechanical inputs, OS-LEM derives:
Mms = 9.8452039408 g, Cms = 2.2256543202 mm/N,
Rms = 0.5129790696 N·s/m, Bl = 5.3892844024 T·m.
These are the kernel's TS conversion values; check how the comparison tool
accounts for air loading before substituting Mmd for Mms.

Front radiation load: infinite-baffle piston, area = driver Sd.
Outlet load: unflanged piston, area = port/line area. The half-space observation
setting is separate from this acoustic load model. OS-LEM sums complex pressures
at equal distances; no extra propagation offset, mutual radiation coupling,
finite-baffle diffraction or cabinet placement is modeled. No acoustic phase
curve is currently shown; the phase dropdown is electrical impedance phase.

## Bass Reflex

- Net rear chamber: 28 L.
- Port: 24 cm² area (circular equivalent diameter 5.5279 cm), 18 cm length.
- The port is a lumped acoustic inertance, rho × length / area, not a distributed tube.
- The mouth radiation impedance supplies its own reactive loading. There is no
  additional inlet end correction, port friction, box leakage or stuffing.
- Do not add automatic end corrections in a comparison program without noting
  them. They can shift tuning even when the nominal dimensions match.

## Uniform transmission line

- Driver rear feeds the line entrance directly; no additional rear chamber.
- Uniform area: 132 cm² (circular equivalent diameter 12.9638 cm).
- Length: 160 cm. Mouth area equals line area.
- Lossless 1D propagation, 64 constant-area segments, open radiating mouth.
- This baseline uses zero attenuation, equal end areas and zero driver offset.
  The additional cases below exercise the new controls. Bends, folds, leakage
  and wall vibration remain unmodeled.
- Narrow peaks/notches are expected in this ideal unstuffed model. Do not treat
  them as predictions for a damped real enclosure.

## Taper, offset and stuffing-attenuation cases

All cases retain the driver, 160 cm total length, voltage and observation settings
above. Each has a matching JSON model and CSV of 600 points over 10–1000 Hz.

| File stem | Closed-end area (cm²) | Mouth area (cm²) | Driver offset (cm) | Attenuation (Np/m) |
|---|---:|---:|---:|---:|
| transmission_line | 132 | 132 | 0 | 0 |
| tl_taper | 132 | 66 | 0 | 0 |
| tl_offset | 132 | 132 | 45 | 0 |
| tl_stuffed | 132 | 132 | 0 | 0.3 |
| tl_combined | 264 | 66 | 45 | 0.3 |

**Taper law:** S(x) = S0 + (Sm − S0) × x/L. This is linear **area**, not
linear radius. The current kernel calls this profile `conical`, but that name
must not be interpreted as a geometrically conical Hornresp horn. Match the area
law, for example with sufficiently short sections, and report any approximation.
Both expanding and contracting lines are supported.

**Offset:** measured from the closed end, with 0 ≤ offset < total length. At a
positive offset the model creates a closed stub from the closed end to the driver
and a downstream section to the mouth. Their shared area is S(offset); lengths
add to L. Zero offset removes the stub entirely. There is no extra rear chamber.
The `tl_combined` case has a 45 cm stub, a 115 cm downstream section and
208.3125 cm² area at the driver. Each section uses midpoint-area discretization,
with at least 64 segments per total line (rounded upward per section).

**Stuffing approximation:** attenuation is a nonnegative, frequency-independent
coefficient alpha, applied uniformly to both sections. The propagation constant
is gamma = alpha + j × 2πf / 343.2; characteristic impedance is rho × c / S.
A forward traveling wave decays as exp(−alpha × distance). Alpha = 0.3 Np/m is
about 2.606 dB/m of traveling-wave amplitude attenuation, not necessarily that
change in the enclosure SPL. Zero restores the lossless baseline.

This is a phenomenological damping control. It does **not** infer alpha from
wool/polyester density, flow resistivity or placement; it does not model a
stuffing-induced sound-speed change or frequency-dependent characteristic
impedance. Do not equate 0.3 Np/m to a Hornresp stuffing-density setting. Compare
the unstuffed taper and offset cases first; then document Hornresp's loss model
when comparing the damped cases. Material-based stuffing prediction is still
unimplemented and needs a separate calibrated model.

### Checks for these extensions

Live frontend-to-kernel tests exercise each case, geometry and mouth consistency,
parameter sensitivity and JSON round trips. Independent continuous transmission-
equation integration checks impedance and combined SPL over 41 log-spaced points.
The 64-segment results satisfy <0.5% relative complex-impedance error and <0.15 dB
SPL error on that test grid. Doubling segment count improves tapered-line
impedance agreement. The tests also cover passivity, the zero-offset limit,
invalid offset/attenuation values and reduced impedance peaks with damping.
These tolerances describe internal numerical checks, not Hornresp agreement.

## External comparison request

Start with Bass Reflex, then the uniform TL. Keep the settings above and export
frequency/SPL/impedance data plus the native Hornresp or Akabak project. Include
any forced radiation, loss or end-correction options. Compare impedance first,
then separate driver/outlet SPL, then combined SPL. This helps distinguish
network differences from observation-space or phase-sum differences.

Please return the native project and text/CSV curves; a screenshot alone cannot
support a precise numerical comparison. External agreement is still pending.

## Reproduce these files

With the real kernel installed and frontend dependencies present, from the Studio root:

```bash
STUDIO_EXPORT_REFERENCE_DIR=examples/studio-comparison python scripts/check_workflow.py
python -m pytest -q tests/test_studio_acoustic_references.py
```

Tests cover live HTTP round trips, finite outputs, geometry changes, voltage
scaling and independent direct-network impedance/pressure equations. The latter
share the kernel's radiation-load functions; they are not an external solver
benchmark. Chromium UI automation is unavailable in the current development
workspace, so the new UI still needs a Chromebook smoke test.
