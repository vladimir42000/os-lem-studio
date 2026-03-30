import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

try:
    from os_lem.api import run_simulation
except ImportError:
    def run_simulation(m, f): return type('Dummy', (), {'series': {}, 'zin_mag_ohm': [], 'frequencies_hz': []})()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class SimulationRequest(BaseModel):
    model_dict: Dict[str, Any]
    frequencies_hz: List[float]
    experimental_mode: Optional[bool] = False

@app.post("/api/simulate")
def perform_simulation(request: SimulationRequest):
    try:
        result = run_simulation(request.model_dict, request.frequencies_hz)

        # Build rich response for frontend
        response_data = {
            "frequencies_hz": list(result.frequencies_hz),
            "series": {},
            "properties": {
                "zin_mag_ohm": list(result.zin_mag_ohm) if hasattr(result, 'zin_mag_ohm') and result.zin_mag_ohm is not None else [],
                "cone_excursion_mm": list(result.cone_excursion_mm) if hasattr(result, 'cone_excursion_mm') else [],
                "cone_velocity_m_per_s": list(result.cone_velocity_m_per_s) if hasattr(result, 'cone_velocity_m_per_s') else [],
                "zin_complex_ohm": list(result.zin_complex_ohm) if hasattr(result, 'zin_complex_ohm') and result.zin_complex_ohm is not None else []
            },
            "observation_types": dict(result.observation_types) if hasattr(result, 'observation_types') else {},
            "warnings": list(result.warnings) if hasattr(result, 'warnings') else []
        }

        # Add every series (spl_front, zin, etc.)
        if hasattr(result, 'series') and isinstance(result.series, dict):
            for obs_id, data in result.series.items():
                if isinstance(data, (list, tuple)) or hasattr(data, '__len__'):
                    response_data["series"][obs_id] = list(data)

        return {"status": "success", "data": response_data}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
