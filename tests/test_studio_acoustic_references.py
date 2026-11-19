"""Independent single-driver impedance/pressure checks for the Studio defaults.

Uses direct lumped impedances and the analytic uniform-tube transfer matrix,
not the kernel's graph assembler or waveguide discretization. Radiation load
formulas are deliberately shared; this is not external Hornresp validation.
"""
import json
from pathlib import Path
import numpy as np
import pytest
from os_lem.api import run_simulation
from os_lem.constants import C0, RHO0
from os_lem.elements.radiator import radiator_impedance
from backend.server import SimulationRequest, perform_simulation

ROOT = Path(__file__).resolve().parents[1] / 'examples' / 'studio-comparison'

@pytest.mark.parametrize('name', ['bass_reflex', 'transmission_line'])
def test_reference_matches_direct_network_equations(name):
    raw = json.loads((ROOT / f'{name}.json').read_text())
    f = np.geomspace(10, 1000, 600)
    actual = run_simulation(raw, f)
    w = 2*np.pi*f
    # Independently derive the reference driver from the published TS values.
    sd = 132e-4
    cms = .055 / (RHO0*C0**2*sd**2)
    mms = 1 / ((2*np.pi*34)**2*cms)
    rms = 2*np.pi*34*mms/4.1
    bl = np.sqrt(2*np.pi*34*mms*5.8/.42)
    front = np.array([radiator_impedance('infinite_baffle_piston', x, sd) for x in w])
    area = .0024 if name == 'bass_reflex' else .0132
    mouth = np.array([radiator_impedance('unflanged_piston', x, area) for x in w])
    if name == 'bass_reflex':
        box = 1/(1j*w*.028/(RHO0*C0**2))
        port = 1j*w*RHO0*.18/area + mouth
        rear = box*port/(box+port)
        mouth_flow_ratio = box/(box+port)
    else:
        zc = RHO0*C0/area
        a = np.cos(w*1.6/C0)
        b = 1j*zc*np.sin(w*1.6/C0)
        c = 1j/zc*np.sin(w*1.6/C0)
        rear = (a*mouth+b)/(c*mouth+a)
        mouth_flow_ratio = 1/(c*mouth+a)
    mech = rms+1j*w*mms+1/(1j*w*cms)+sd**2*(front+rear)
    zin = 5.8+1j*w*.00035+bl**2/mech
    velocity = bl*(2.83/zin)/mech
    q_front = sd*velocity
    q_mouth = -q_front*mouth_flow_ratio
    pressure = 1j*w*RHO0/(2*np.pi)*(q_front+q_mouth)
    spl = 20*np.log10(np.abs(pressure)/20e-6)
    np.testing.assert_allclose(actual.zin_complex_ohm, zin, rtol=1e-8, atol=1e-8)
    np.testing.assert_allclose(actual.series['spl_sum'], spl, rtol=1e-8, atol=1e-8)
    # The Studio HTTP adapter requests a derived display delay. Its reference
    # is the unwrapped phase of independently constructed *complex* pressure,
    # not the phase of SPL magnitudes expressed in dB.
    expected_delay_ms = -1000 * np.gradient(np.unwrap(np.angle(pressure)), w)
    response = perform_simulation(SimulationRequest(model_dict=raw, frequencies_hz=f.tolist()))
    assert response['status'] == 'success'
    delay_ms = np.asarray(response['data']['properties']['group_delay_ms'])
    np.testing.assert_allclose(delay_ms, expected_delay_ms, rtol=1e-8, atol=1e-6)
    assert np.max(np.abs(delay_ms)) > 1
