import math
import numpy as np
import pytest
from backend.br_alignments import B4_Q,BB_Q,solve,proposals,chebyshev
from os_lem.constants import C0,RHO0
from os_lem.elements.radiator import radiator_impedance
from test_backend_simulation_response_regressions import make_client

TS=dict(Fs=34,Vas=55,Qes=.42,Qms=4.1,Re=5.8,series_resistance_ohm=0)

@pytest.mark.parametrize('name',['QB3','SQB3','C4','SC4'])
def test_butterworth_meeting_point(name):
    h,a=solve(name,B4_Q)
    assert h==pytest.approx(1,abs=1e-9)
    assert a==pytest.approx(math.sqrt(2),abs=1e-9)


def test_double_pole_boundary_and_discrete_cd4():
    assert solve('SBB4',BB_Q)==pytest.approx((1,2))
    assert solve('BB4',BB_Q)==pytest.approx((1,2))
    assert solve('SBB4',.25)==pytest.approx((1,4))

@pytest.mark.parametrize('q',[.27,.3,.35,.38,.45,.55])
def test_quasi_polynomial_constraints(q):
    h,a=solve('QB3' if q<B4_Q else 'SQB3',q)
    a1=1/(math.sqrt(h)*q);a2=(a+1+h*h)/h;a3=math.sqrt(h)/q
    assert a1*a1-2*a2==pytest.approx(0,abs=1e-9)
    assert a2*a2+2-2*a1*a3==pytest.approx(0,abs=1e-9)


def test_family_unavailability_not_arbitrary_qts_cutoff():
    for name in ('BB4','C4','SQB3'):
        with pytest.raises(ValueError):solve(name,.3)
    with pytest.raises(ValueError):solve('SC4',.1)
    with pytest.raises(ValueError):solve('SQB3',.9)


def test_port_tuning_with_kernel_mouth_load_and_practical_limits():
    p=proposals(TS,24)
    available=[r for r in p['alignments'] if r['available']]
    assert available
    for r in available:
        w=2*math.pi*r['fb_hz'];S=24e-4;L=r['port_length_cm']/100;V=r['volume_l']/1000
        reactance=w*RHO0*L/S+radiator_impedance('unflanged_piston',w,S).imag-RHO0*C0*C0/(w*V)
        assert abs(reactance)<1e-7
    limited=proposals(TS,24,.1,.1)
    assert any(r['available'] and not r['applicable'] for r in limited['alignments'])
    assert proposals({**TS,'series_resistance_ohm':2},24)['qts_effective']>p['qts_effective']


def test_http_all_names_invalid_ts_and_no_input_mutation():
    _,client=make_client()
    request=dict(ts=TS,port_area_cm2=24)
    response=client.post('/api/optimise/alignments',json=request)
    assert response.status_code==200,response.text
    assert [r['name'] for r in response.json()['alignments']]==['SBB4','SC4','QB3','BB4','C4','SQB3']
    assert client.post('/api/optimise/alignments',json={**request,'ts':{**TS,'Re':0}}).status_code==422
