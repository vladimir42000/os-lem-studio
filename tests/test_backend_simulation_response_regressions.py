import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = REPO_ROOT / "backend" / "server.py"
SIMULATION_REQUEST = {
    "model_dict": {"meta": {"name": "test_model"}, "elements": [], "observations": []},
    "frequencies_hz": [20.0, 100.0],
    "experimental_mode": False,
}


def load_server_module():
    spec = importlib.util.spec_from_file_location("studio_backend_server", SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load backend server module from {SERVER_PATH}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_client():
    server_module = load_server_module()
    client = TestClient(server_module.app)
    return server_module, client


def test_simulate_returns_200_with_expected_contract_shape(monkeypatch):
    server_module, client = make_client()

    def fake_run_simulation(_model_dict, _frequencies_hz):
        return SimpleNamespace(
            frequencies_hz=np.array([20.0, 100.0], dtype=np.float64),
            series={
                "spl_front": np.array([85.25, 86.75], dtype=np.float64),
            },
            zin_mag_ohm=np.array([6.1, 7.3], dtype=np.float64),
            cone_excursion_mm=np.array([0.12, 0.15], dtype=np.float64),
            cone_velocity_m_per_s=np.array([0.01, 0.02], dtype=np.float64),
            zin_complex_ohm=np.array([complex(6.1, 0.4), complex(7.3, 0.5)]),
            observation_types={"spl_front": "spl"},
            warnings=[],
        )

    monkeypatch.setattr(server_module, "run_simulation", fake_run_simulation)

    response = client.post("/api/simulate", json=SIMULATION_REQUEST)
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "success"
    assert set(body["data"].keys()) >= {"frequencies_hz", "series", "properties"}
    assert body["data"]["frequencies_hz"] == [20.0, 100.0]
    assert body["data"]["series"]["spl_front"] == [85.25, 86.75]
    assert body["data"]["properties"]["zin_mag_ohm"] == [6.1, 7.3]

    json.dumps(body)



def test_simulate_tolerates_optional_iterables_present_but_none(monkeypatch):
    server_module, client = make_client()

    def fake_run_simulation(_model_dict, _frequencies_hz):
        return SimpleNamespace(
            frequencies_hz=[20.0, 100.0],
            series={"spl_front": [80.0, 81.0]},
            zin_mag_ohm=[5.8, 6.0],
            cone_excursion_mm=None,
            cone_velocity_m_per_s=None,
            zin_complex_ohm=None,
            observation_types=None,
            warnings=None,
        )

    monkeypatch.setattr(server_module, "run_simulation", fake_run_simulation)

    response = client.post("/api/simulate", json=SIMULATION_REQUEST)
    assert response.status_code == 200

    body = response.json()
    assert body["data"]["properties"]["cone_excursion_mm"] == []
    assert body["data"]["properties"]["cone_velocity_m_per_s"] == []
    assert body["data"]["properties"]["zin_complex_ohm"] == []
    assert body["data"]["observation_types"] == {}
    assert body["data"]["warnings"] == []

    json.dumps(body)



def test_simulate_normalizes_numpy_and_complex_values_to_json_safe_payload(monkeypatch):
    server_module, client = make_client()

    def fake_run_simulation(_model_dict, _frequencies_hz):
        return SimpleNamespace(
            frequencies_hz=np.array([np.float64(20.0), np.float64(100.0)]),
            series={
                "spl_front": np.array([np.float64(88.0), np.float64(89.5)]),
                "zin": np.array([np.float64(6.0), np.float64(6.8)]),
            },
            zin_mag_ohm=np.array([np.float64(6.0), np.float64(6.8)]),
            cone_excursion_mm=np.array([np.float64(0.2), np.float64(0.25)]),
            cone_velocity_m_per_s=np.array([np.float64(0.03), np.float64(0.04)]),
            zin_complex_ohm=np.array([np.complex128(6.0 + 1.5j), np.complex128(6.8 + 2.0j)]),
            observation_types={"spl_front": np.str_("spl"), "zin": np.str_("input_impedance")},
            warnings=np.array([np.str_("normalized for test")], dtype=object),
        )

    monkeypatch.setattr(server_module, "run_simulation", fake_run_simulation)

    response = client.post("/api/simulate", json=SIMULATION_REQUEST)
    assert response.status_code == 200

    body = response.json()
    zin_complex = body["data"]["properties"]["zin_complex_ohm"]
    assert zin_complex == [
        {"real": 6.0, "imag": 1.5},
        {"real": 6.8, "imag": 2.0},
    ]
    assert body["data"]["warnings"] == ["normalized for test"]
    assert body["data"]["observation_types"] == {
        "spl_front": "spl",
        "zin": "input_impedance",
    }

    encoded = json.dumps(body)
    assert isinstance(encoded, str)
