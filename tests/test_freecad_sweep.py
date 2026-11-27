import base64
import csv
import io
import json

import numpy as np
from fastapi.testclient import TestClient

from backend.cad_horn import solver_root
from backend.server import app


def test_invalid_then_reference_and_replacement_driver():
    directory = solver_root() / "examples/freecad"
    fixture = directory / "conical-fixture"
    payload = dict(air_stl_base64="bm90IGFuIFNUTA==",
                   driver_json=(directory / "illustrative-driver.json").read_text(),
                   units="mm", cell_mm=6, voltage_rms=1, distance_m=1,
                   frequencies_hz=[125, 250, 500, 750, 1000, 1500])
    with TestClient(app) as client:
        def sweep():
            response = client.post("/api/freecad/sweep", json=payload)
            response.raise_for_status()
            assert "attachment" in response.headers["content-disposition"]
            return list(csv.DictReader(io.StringIO(response.text)))

        invalid = client.post("/api/freecad/sweep", json=payload)
        assert invalid.status_code == 422
        assert "closed air volume" in invalid.json()["detail"]
        payload["air_stl_base64"] = base64.b64encode((fixture / "air-volume.stl").read_bytes()).decode()
        rows = sweep()
        reference = list(csv.DictReader((fixture / "predicted-1v.csv").read_text().splitlines()))
        assert [float(row["Hz"]) for row in rows] == payload["frequencies_hz"]
        for row, ref in zip(rows, reference, strict=True):
            delta = complex(float(row["Ze_real_ohm"]) - float(ref["Ze_real_ohm"]),
                            float(row["Ze_imag_ohm"]) - float(ref["Ze_imag_ohm"]))
            assert abs(delta) <= 1e-6
            assert abs(float(row["SPL_dB"]) - float(ref["SPL_dB"])) <= 1e-5
        driver = json.loads(payload["driver_json"])
        driver["Re_ohm"] += 2
        payload.update(driver_json=json.dumps(driver), frequencies_hz=[125])
        changed, = sweep()
        np.testing.assert_allclose(float(changed["Ze_real_ohm"]) - float(rows[0]["Ze_real_ohm"]),
                                   2, atol=1e-8, rtol=0)
