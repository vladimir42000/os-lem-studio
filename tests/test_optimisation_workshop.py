import json
from copy import deepcopy
from pathlib import Path
import numpy as np
import pytest
from test_backend_simulation_response_regressions import make_client

ROOT=Path(__file__).resolve().parents[1]
OBJECTIVE=dict(low_hz=30,high_hz=200,target_db=85,max_volume_l=100,max_excursion_mm=10)

@pytest.mark.parametrize('name', ['bass_reflex','transmission_line','tl_zoned_stuffing'])
def test_opt_uses_exact_display_adapter(name):
    _,client=make_client()
    model=json.loads((ROOT/'examples/studio-comparison'/f'{name}.json').read_text())
    before=deepcopy(model)
    request=dict(model_dict=model,frequencies_hz=np.geomspace(10,1000,600).tolist())
    normal=client.post('/api/simulate',json=request)
    opt=client.post('/api/optimise/evaluate',json={**request,'objective':OBJECTIVE,'volume_l':30})
    assert normal.status_code==opt.status_code==200, opt.text
    assert normal.json()['data']==opt.json()['data']
    assert opt.json()['evaluation']['score']>=0
    assert model==before


def test_plan_and_invalid_bounds():
    _,client=make_client()
    args=dict(bounds=[dict(id='length',min=50,max=200,value=160)],budget=8)
    assert len(client.post('/api/optimise/plan',json=args).json()['candidates'])==8
    args['bounds'][0]['min']=250
    assert client.post('/api/optimise/plan',json=args).status_code==422


def test_missing_opt_does_not_break_normal_runner(monkeypatch):
    server,client=make_client()
    def missing():
        from fastapi import HTTPException
        raise HTTPException(status_code=503,detail='OPT missing')
    monkeypatch.setattr(server,'_workshop_opt',missing)
    assert client.post('/api/optimise/plan',json={'bounds':[]}).status_code==503
