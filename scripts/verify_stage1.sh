#!/usr/bin/env bash
# Linux with Git, Python 3.12 (venv), Node/npm and the Gmsh runtime libraries
# (including libGLU.so.1). Output stays in the printed temporary directory.
set -euo pipefail
manifest_dir=$(cd "$(dirname "$0")/../integration" && pwd)
work=$(mktemp -d)
echo "Verification directory: $work"
cd "$work"
unset PYTHONPATH PYTHONHOME PYTEST_ADDOPTS
export OPENBLAS_NUM_THREADS=1 MPLBACKEND=Agg
python3.12 -m venv venv
source venv/bin/activate
python - "$manifest_dir/stage1.json" <<'PY'
import json
from pathlib import Path
import re
import subprocess
import sys

for repo, sha in json.loads(Path(sys.argv[1]).read_text())["repositories"].items():
    if not re.fullmatch("[0-9a-f]{40}", sha):
        raise ValueError(f"{repo} needs an exact Git SHA")
    subprocess.run(["git", "init", "-q", repo], check=True)
    git = ["git", "-C", repo]
    url = f"https://github.com/vladimir42000/{repo}.git"
    subprocess.run([*git, "fetch", "-q", "--depth=1", url, sha], check=True)
    subprocess.run([*git, "checkout", "-q", "--detach", "FETCH_HEAD"], check=True)
    actual = subprocess.check_output([*git, "rev-parse", "HEAD"], text=True).strip()
    if actual != sha:
        raise RuntimeError(f"{repo}: expected {sha}, got {actual}")
    print(repo, actual, flush=True)
PY
python -m pip install -r "$manifest_dir/python312.lock" -r ausolveris/requirements.txt \
    -r os-lem-studio/requirements-dev.txt -e ./os-lem -e ./os-lem-opt
python -m pip check
python - <<'PY'
from pathlib import Path
import gmsh
import os_lem

source = Path(os_lem.__file__).resolve()
print("Imported kernel:", source)
assert source.is_relative_to(Path("os-lem/src").resolve())
gmsh.initialize()
gmsh.finalize()
PY
(cd os-lem-studio/frontend && npm ci && npm run build)
for repo in os-lem os-lem-opt os-lem-studio ausolveris; do
    (cd "$repo" && PYTHONPATH="$PWD/src" python -m pytest -q -rs --junitxml="$work/$repo.xml")
done
python - <<'PY'
from pathlib import Path
from xml.etree import ElementTree

for report in sorted(Path.cwd().glob("*.xml")):
    cases = ElementTree.parse(report).findall(".//testcase")
    skipped = [c.get("name") for c in cases if c.find("skipped") is not None]
    if not cases or skipped:
        raise SystemExit(f"{report.name}: {len(cases)} collected, skipped {skipped}")
PY
python - <<'PY'
import json
from pathlib import Path
import numpy as np
from os_lem.api import run_simulation

cases = Path("os-lem-studio/examples/studio-comparison")
reference = np.genfromtxt(cases / "transmission_line.csv", names=True, delimiter=",")
model = json.loads((cases / "transmission_line.json").read_text())
result = run_simulation(model, reference["frequency_hz"])
for series, column in [("spl_sum", "spl_combined_db"), ("spl_front", "spl_driver_db"),
                       ("spl_mouth", "spl_outlet_db")]:
    np.testing.assert_allclose(result.series[series], reference[column], atol=1e-6, rtol=0)
z = result.zin_complex_ohm
np.testing.assert_allclose(abs(z), reference["impedance_ohm"], atol=1e-6, rtol=0)
np.testing.assert_allclose(np.angle(z, deg=True), reference["impedance_phase_deg"], atol=1e-6, rtol=0)

model = json.loads((cases / "tl_zoned_stuffing.json").read_text())
loaded = [e for e in model["elements"] if "flow_resistivity" in e]
assert len(loaded) == 2
peaks = []
for sigma in (1000, 3500, 10000):
    for section in loaded:
        section["flow_resistivity"] = sigma
    sweep = run_simulation(model, np.geomspace(50, 500, 200))
    peaks.append(float(max(abs(sweep.zin_complex_ohm))))
print("Zoned TL peak |Z| (ohm) for 1000, 3500, 10000 Pa s/m²:", peaks)
assert peaks[0] > peaks[1] > peaks[2]
PY
cd ausolveris
fixture=examples/freecad/conical-fixture
PYTHONPATH=src python examples/cad_horn_sweep.py "$fixture/air-volume.stl" \
    examples/freecad/illustrative-driver.json --units mm --cell-mm 6 \
    --voltage-rms 1 --distance-m 1 --hz 125 250 500 750 1000 1500 > "$work/prediction.csv"
python - "$fixture/predicted-1v.csv" "$work/prediction.csv" <<'PY'
import sys
import numpy as np

reference, actual = [np.genfromtxt(p, delimiter=",", names=True) for p in sys.argv[1:]]
for rows in [reference, actual]:
    np.testing.assert_array_equal(rows["Hz"], [125, 250, 500, 750, 1000, 1500])
    assert np.all(rows["voltage_V_rms"] == 1) and np.all(rows["distance_m"] == 1)
real = actual["Ze_real_ohm"] - reference["Ze_real_ohm"]
imag = actual["Ze_imag_ohm"] - reference["Ze_imag_ohm"]
spl = actual["SPL_dB"] - reference["SPL_dB"]
for label, delta, tolerance in [("Re Z (ohm)", real, 1e-6), ("Im Z (ohm)", imag, 1e-6),
                                ("complex Z (ohm)", real + 1j * imag, 1e-6),
                                ("SPL (dB)", spl, 1e-5)]:
    error = np.max(np.abs(delta))
    print(f"{label}: maximum absolute error {error:.12g}, tolerance {tolerance:g}")
    if not error <= tolerance:
        raise SystemExit(f"{label} exceeds tolerance")
PY
