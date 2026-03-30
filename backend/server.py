import json
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from os_lem.api import run_simulation
except ImportError:
    def run_simulation(m, f):
        return type(
            'Dummy',
            (),
            {
                'series': {},
                'zin_mag_ohm': [],
                'frequencies_hz': [],
            },
        )()


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulationRequest(BaseModel):
    model_dict: Dict[str, Any]
    frequencies_hz: List[float]
    experimental_mode: Optional[bool] = False


def _json_safe_value(value: Any) -> Any:
    """Recursively convert simulation outputs into JSON-safe Python values."""
    if value is None:
        return None

    if isinstance(value, (str, bool, int, float)):
        return value

    if isinstance(value, complex):
        return {"real": value.real, "imag": value.imag}

    if isinstance(value, dict):
        return {str(k): _json_safe_value(v) for k, v in value.items()}

    if isinstance(value, (list, tuple)):
        return [_json_safe_value(v) for v in value]

    # NumPy arrays and similar array-likes.
    tolist = getattr(value, 'tolist', None)
    if callable(tolist):
        return _json_safe_value(tolist())

    # NumPy scalar types often support .item().
    item = getattr(value, 'item', None)
    if callable(item):
        try:
            return _json_safe_value(item())
        except Exception:
            pass

    # Other generic iterables that are not strings/bytes.
    try:
        iterator = iter(value)
    except TypeError:
        return str(value)
    else:
        return [_json_safe_value(v) for v in iterator]


def _json_safe_list_or_empty(value: Any) -> List[Any]:
    if value is None:
        return []

    safe_value = _json_safe_value(value)
    if safe_value is None:
        return []
    if isinstance(safe_value, list):
        return safe_value
    return [safe_value]


def _json_safe_dict_or_empty(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}

    safe_value = _json_safe_value(value)
    if isinstance(safe_value, dict):
        return safe_value
    return {}


@app.post("/api/simulate")
def perform_simulation(request: SimulationRequest):
    try:
        result = run_simulation(request.model_dict, request.frequencies_hz)

        response_data = {
            "frequencies_hz": _json_safe_list_or_empty(getattr(result, 'frequencies_hz', None)),
            "series": {},
            "properties": {
                "zin_mag_ohm": _json_safe_list_or_empty(getattr(result, 'zin_mag_ohm', None)),
                "cone_excursion_mm": _json_safe_list_or_empty(getattr(result, 'cone_excursion_mm', None)),
                "cone_velocity_m_per_s": _json_safe_list_or_empty(getattr(result, 'cone_velocity_m_per_s', None)),
                "zin_complex_ohm": _json_safe_list_or_empty(getattr(result, 'zin_complex_ohm', None)),
            },
            "observation_types": _json_safe_dict_or_empty(getattr(result, 'observation_types', None)),
            "warnings": _json_safe_list_or_empty(getattr(result, 'warnings', None)),
        }

        series = getattr(result, 'series', None)
        if isinstance(series, dict):
            for obs_id, data in series.items():
                response_data["series"][str(obs_id)] = _json_safe_list_or_empty(data)

        # Fail early here instead of inside FastAPI's encoder if anything non-JSON-safe remains.
        json.dumps(response_data)

        return {"status": "success", "data": response_data}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
