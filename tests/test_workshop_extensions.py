"""Integration checks for Studio's derived observable and zoned example."""
import copy
import json
from pathlib import Path
import numpy as np
from backend.server import perform_simulation,SimulationRequest
from os_lem.api import run_simulation


def test_zoned_example_and_backend_group_delay_are_finite_and_model_unchanged():
    model=json.loads((Path(__file__).parents[1]/'examples/studio-comparison/tl_zoned_stuffing.json').read_text())
    original=copy.deepcopy(model)
    f=np.geomspace(10,1000,600).tolist()
    response=perform_simulation(SimulationRequest(model_dict=model,frequencies_hz=f))
    assert model==original
    data=response['data']
    assert len(data['properties']['group_delay_ms'])==600
    assert np.all(np.isfinite(data['properties']['group_delay_ms']))
    assert len(data['series']['spl_sum'])==600
    assert any('experimental Miki' in w for w in data['warnings'])
    direct=copy.deepcopy(model)
    direct['observations'].append({'id':'gd','type':'group_delay','target':'spl_sum'})
    expected=run_simulation(direct,f)
    np.testing.assert_allclose(data['properties']['group_delay_ms'],expected.series['gd']*1000)
