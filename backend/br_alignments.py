"""Classical lossless vented alignments, independently implemented from equations.

References: Small (1973), Speakerbench alignment_theory: QB3 A1=A2=0,
Hoge double-quadratic BB4, Small Chebyshev k continuation. No empirical Qts
cutoff tables. QL=infinity; real kernel radiation/inductance remain in previews.
"""
import math
from scipy.optimize import brentq
from os_lem.constants import C0, RHO0
from os_lem.elements.radiator import radiator_impedance

NAMES = ('SBB4', 'SC4', 'QB3', 'BB4', 'C4', 'SQB3')
B4_Q = math.cos(3*math.pi/8)
BB_Q = 1/math.sqrt(8)


def chebyshev(k):
    d=(k**4+6*k*k+1)/8
    c=math.sqrt(4+math.sqrt(8))
    a3=c*k/d**.25
    a2=(1+k*k*(1+math.sqrt(2)))/math.sqrt(d)
    a1=c*k*(1+(k*k-1)/math.sqrt(8))/d**.75
    h=a3/a1
    return 1/math.sqrt(a1*a3), h, a2*h-1-h*h


def solve(name, q):
    if not math.isfinite(q) or q <= 0:
        raise ValueError('Effective Qts must be positive.')
    if name in ('SBB4','BB4'):
        if (name=='SBB4' and q>BB_Q+1e-9) or (name=='BB4' and q<BB_Q-1e-9):
            raise ValueError(f'Effective Qts is on the {"BB4" if q>BB_Q else "SBB4"} side of the double-pole family (boundary {BB_Q:.4f}).')
        h,alpha=1.,1/(4*q*q)
    elif name in ('QB3','SQB3'):
        if (name=='QB3' and q>B4_Q+1e-9) or (name=='SQB3' and q<B4_Q-1e-9):
            raise ValueError(f'Effective Qts is on the {"SQB3" if q>B4_Q else "QB3"} side of the quasi-Butterworth family (boundary {B4_Q:.4f}).')
        if q>=1: raise ValueError('No positive quasi-Butterworth solution.')
        g=math.sqrt(2/(q*q)-2)
        h=1/(2*g*q*q)
        alpha=g*h-1-h*h
    elif name in ('SC4','C4'):
        if (name=='SC4' and q>B4_Q+1e-9) or (name=='C4' and q<B4_Q-1e-9):
            raise ValueError(f'Effective Qts is on the {"C4" if q>B4_Q else "SC4"} side of the Chebyshev family (boundary {B4_Q:.4f}).')
        try:
            k=math.exp(brentq(lambda x:chebyshev(math.exp(x))[0]-q,-12,12))
        except ValueError:
            raise ValueError('No Chebyshev solution in the physical family domain.')
        _,h,alpha=chebyshev(k)
    else: raise ValueError('Unknown alignment.')
    if not all(math.isfinite(x) and x>1e-10 for x in (h,alpha)):
        raise ValueError('No positive box-volume and tuning solution.')
    return h,alpha


def proposals(ts, port_area_cm2, max_volume_l=200., max_port_length_cm=150.):
    required=('Fs','Vas','Qes','Qms','Re')
    if any(not math.isfinite(ts.get(k,0)) or ts.get(k,0)<=0 for k in required):
        raise ValueError('Fs, Vas, Qes, Qms and Re must be finite and positive.')
    rs=ts.get('series_resistance_ohm',0)
    if not math.isfinite(rs) or rs<0: raise ValueError('Series resistance must be nonnegative.')
    if any(not math.isfinite(v) or v<=0 for v in (port_area_cm2,max_volume_l,max_port_length_cm)):
        raise ValueError('Port area and practical limits must be positive.')
    qes=ts['Qes']*(1+rs/ts['Re'])
    q=1/(1/qes+1/ts['Qms'])
    rows=[]
    for name in NAMES:
        row=dict(name=name,available=False,applicable=False,reason='')
        try:
            h,alpha=solve(name,q)
            volume=ts['Vas']/alpha
            fb=h*ts['Fs']; omega=2*math.pi*fb; area=port_area_cm2/10000
            # Zero reactive impedance of chamber + port + its actual mouth load.
            length=area/(omega*RHO0)*(RHO0*C0*C0/(omega*volume/1000)-radiator_impedance('unflanged_piston',omega,area).imag)
            row.update(available=True,volume_l=volume,fb_hz=fb,port_length_cm=100*length,alpha=alpha,h=h)
            if length<=0:
                row.update(available=False,reason='This port area requires a nonpositive duct length; change port area or tuning.')
            else:
                total=volume+area*length*1000
                reasons=[]
                if total>max_volume_l: reasons.append('total chamber + port air volume exceeds limit')
                if 100*length>max_port_length_cm: reasons.append('port length exceeds limit')
                row.update(applicable=not reasons,reason='; '.join(reasons),total_air_volume_l=total)
        except ValueError as error: row['reason']=str(error)
        rows.append(row)
    return dict(qts_effective=q,assumption='QL = infinity; no added leakage. Actual kernel radiation and voice-coil inductance retained in preview. Inner port end correction is not modelled.',alignments=rows)
