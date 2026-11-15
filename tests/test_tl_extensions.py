"""TL checks independent of the kernel graph/waveguide assembly.

Reference integrates the variable-area transmission equations continuously.
Radiation load formulas are shared; these are not external Hornresp checks.
"""
import copy
import json
from pathlib import Path

import numpy as np
import pytest
from scipy.integrate import solve_ivp
from os_lem.api import run_simulation
from os_lem.constants import RHO0, C0
from os_lem.elements.radiator import radiator_impedance

ROOT = Path(__file__).resolve().parents[1] / 'examples' / 'studio-comparison'


def transfer(omega, length, s0, s1, alpha):
    gamma = alpha + 1j*omega/C0
    def derivative(x, flat):
        area = s0+(s1-s0)*x/length
        zc = RHO0*C0/area
        return (flat.reshape(2,2) @ np.array([[0, gamma*zc],[gamma/zc,0]])).ravel()
    solution = solve_ivp(derivative, (0,length), np.eye(2,dtype=complex).ravel(), rtol=1e-10, atol=1e-12)
    assert solution.success
    return solution.y[:,-1].reshape(2,2)


def direct_reference(raw, frequencies):
    # Published reference TS driver, derived independently.
    sd=.0132; cms=.055/(RHO0*C0*C0*sd*sd)
    mms=1/((2*np.pi*34)**2*cms); rms=2*np.pi*34*mms/4.1
    bl=np.sqrt(2*np.pi*34*mms*5.8/.42)
    lines=[e for e in raw['elements'] if e['type']=='waveguide_1d']
    result_z=[];result_spl=[]
    for f in frequencies:
        w=2*np.pi*f
        matrices=[transfer(w, float(e['length'].split()[0])*.01,
                           float(e['area_start'].split()[0])*1e-4,
                           float(e['area_end'].split()[0])*1e-4, e.get('loss',0)) for e in lines]
        mouth_area=float(lines[-1]['area_end'].split()[0])*1e-4
        zmouth=radiator_impedance('unflanged_piston',w,mouth_area)
        a,b,c,d=matrices[-1].ravel()
        zmain=(a*zmouth+b)/(c*zmouth+d)
        admittance=1/zmain
        if len(matrices)==2:
            # Closed-end flow = 0; seen from driver, stub admittance C/D.
            admittance+=matrices[0][1,0]/matrices[0][1,1]
        zrear=1/admittance
        zfront=radiator_impedance('infinite_baffle_piston',w,sd)
        zmech=rms+1j*w*mms+1/(1j*w*cms)+sd*sd*(zfront+zrear)
        zin=5.8+1j*w*.00035+bl*bl/zmech
        velocity=bl*(2.83/zin)/zmech
        qfront=sd*velocity
        qmouth=-qfront*(zrear/zmain)/(c*zmouth+d)
        pressure=1j*w*RHO0/(2*np.pi)*(qfront+qmouth)
        result_z.append(zin);result_spl.append(20*np.log10(abs(pressure)/20e-6))
    return np.array(result_z),np.array(result_spl)


@pytest.mark.parametrize('name',['tl_taper','tl_offset','tl_stuffed','tl_combined'])
def test_extended_line_against_continuous_transfer_equations(name):
    raw=json.loads((ROOT/f'{name}.json').read_text())
    f=np.geomspace(10,1000,41)
    actual=run_simulation(raw,f)
    z,spl=direct_reference(raw,f)
    # 64 midpoint segments approximate the continuous taper. Relative complex
    # impedance error must stay <0.5%; SPL error <0.15 dB over this grid.
    assert np.max(np.abs(actual.zin_complex_ohm-z)/np.abs(z)) < .005
    assert np.max(np.abs(actual.series['spl_sum']-spl)) < .15
    assert np.all(actual.zin_complex_ohm.real>=5.8-1e-8), 'Passive network cannot generate electrical power'
    if name in ['tl_taper','tl_combined']:
        refined=copy.deepcopy(raw)
        for e in refined['elements']:
            if e['type']=='waveguide_1d': e['segments']*=2
        finer=run_simulation(refined,f)
        assert np.linalg.norm(finer.zin_complex_ohm-z) < np.linalg.norm(actual.zin_complex_ohm-z)


def test_uniform_offset_zero_limit_and_damping_effect():
    raw=json.loads((ROOT/'transmission_line.json').read_text())
    f=np.geomspace(10,1000,600)
    baseline=run_simulation(raw,f)
    stuffed=json.loads((ROOT/'tl_stuffed.json').read_text())
    damped=run_simulation(stuffed,f)
    assert np.max(damped.zin_mag_ohm) < np.max(baseline.zin_mag_ohm)
    # A very short closed stub must tend to the entrance-driven case.
    shifted=copy.deepcopy(raw)
    line=next(e for e in shifted['elements'] if e['id']=='rear_line')
    stub={**line,'id':'closed_stub','node_a':'closed_end','node_b':'rear','length':'0.00001 cm','segments':1}
    line['length']='159.99999 cm'
    shifted['elements'].append(stub)
    actual=run_simulation(shifted,f)
    np.testing.assert_allclose(actual.zin_complex_ohm,baseline.zin_complex_ohm,rtol=1e-5,atol=1e-5)
