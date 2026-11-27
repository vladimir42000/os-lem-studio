"""Adapter to the pinned AuSolveris FreeCAD sweep executable."""
import base64
import binascii
import csv
import io
import math
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

router = APIRouter()
PORT_HELP = ("Export one closed air volume with a single planar cap at each end: "
             "orient the throat at minimum Z and the mouth at maximum Z. "
             "Each cap must have one boundary loop.")
Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]


def solver_root():
    sibling = Path(__file__).resolve().parents[2] / "ausolveris"
    return Path(os.environ.get("AUSOLVERIS_ROOT", sibling)).resolve()


class HornSweep(BaseModel):
    air_stl_base64: str
    driver_json: str
    units: Literal["mm", "m"]
    cell_mm: Positive
    voltage_rms: Positive = 1
    distance_m: Positive = 1
    frequencies_hz: Annotated[list[Positive], Field(min_length=1)]


@router.post("/api/freecad/sweep", response_class=Response)
def simulate_horn(request: HornSweep):
    root = solver_root()
    script = root / "examples/cad_horn_sweep.py"
    if not script.is_file():
        raise HTTPException(503, "Set AUSOLVERIS_ROOT to the pinned AuSolveris checkout.")
    try:
        data = base64.b64decode(request.air_stl_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(422, "Could not decode the STL upload.") from exc
    with TemporaryDirectory() as directory:
        air = Path(directory) / "air.stl"
        driver = Path(directory) / "driver.json"
        air.write_bytes(data)
        driver.write_text(request.driver_json, encoding="utf-8")
        command = [sys.executable, str(script), str(air), str(driver),
                   "--units", request.units, "--cell-mm", str(request.cell_mm),
                   "--voltage-rms", str(request.voltage_rms), "--distance-m", str(request.distance_m),
                   "--hz", *map(str, request.frequencies_hz)]
        env = dict(os.environ, PYTHONPATH=str(root / "src"), OPENBLAS_NUM_THREADS="1")
        try:
            run = subprocess.run(command, capture_output=True, text=True, env=env, timeout=300)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(422, "Sweep exceeded five minutes. Increase the cell size or reduce the frequency grid.") from exc
    if run.returncode:
        lines = run.stderr.strip().splitlines()
        cause = lines[-1] if lines else f"AuSolveris exited with code {run.returncode}"
        if cause.startswith(("ImportError", "ModuleNotFoundError", "OSError")):
            raise HTTPException(503, f"Check the solver installation. {cause}")
        raise HTTPException(422, f"{cause}. Check the driver JSON fields and units. {PORT_HELP}")
    rows = list(csv.DictReader(io.StringIO(run.stdout)))
    if (len(rows) != len(request.frequencies_hz)
            or any(not math.isfinite(float(value)) for row in rows for value in row.values())):
        raise HTTPException(422, "The solver returned an incomplete or non-finite sweep. Check the driver and frequency grid.")
    return Response(run.stdout, media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="freecad-horn.csv"'})
