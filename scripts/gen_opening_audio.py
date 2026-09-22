"""Original synthesized opening sequence audition; does not modify game assets."""
from pathlib import Path
import json, wave
import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/audio'
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(20260922)
TAU = 2*np.pi
duration = 33.0
mix = np.zeros((round(duration*SR), 2))

def time(seconds):
    return np.arange(round(seconds*SR))/SR

def put(dest, sample, start, gain=1, pan=0):
    i = round(start*SR)
    n = min(len(sample), len(dest)-i)
    if n <= 0: return
    if sample.ndim == 1:
        sample = sample[:, None]*np.array([np.cos((pan+1)*np.pi/4), np.sin((pan+1)*np.pi/4)])
    dest[i:i+n] += sample[:n]*gain

def room(x, decay=1):
    y = x.copy()
    for delay, gain in [(.043,.20),(.097,.16),(.179,.13),(.293,.10),(.479,.07),(.731,.045), (1.09,.025)]:
        k=round(delay*SR)
        y[k:] += x[:-k, ::-1]*gain*decay
    return y

# Quiet, slow breathing drone with minor-second tension well above the bass.
t = time(12)
amb = np.zeros((len(t), 2))
breath = .60+.40*(.5+.5*np.sin(TAU*t/5.4-.8))**2
for c in range(2):
    amb[:,c] = (.062*np.sin(TAU*49*t + .08*np.sin(TAU*.15*t+c))
                 + .038*np.sin(TAU*(73.416+c*.055)*t)
                 + .025*np.sin(TAU*(98+c*.10)*t)
                 + .008*np.sin(TAU*(207.65+c*.12)*t)
                 + .006*np.sin(TAU*(220-c*.12)*t))*breath
    noise = rng.normal(size=len(t))
    f = np.fft.rfftfreq(len(t),1/SR)
    noise = np.fft.irfft(np.fft.rfft(noise)*np.exp(-(f/950)**2)*(1-np.exp(-(f/130)**2)), n=len(t))
    amb[:,c] += noise*.035*breath

# Sparse felt-like piano/bell notes; intentional long gaps.
for start, freq, gain, pan in [(1.1,293.665,.050,-.35),(4.7,311.127,.029,.45),(7.9,220,.047,.15),(10.1,207.652,.026,-.3)]:
    q = time(3.8)
    note = sum(a*np.sin(TAU*freq*h*q)*np.exp(-q/d) for h,a,d in [(1,1,1.4),(2.003,.30,.7),(3.01,.12,.35)])
    note *= (1-np.exp(-q/.008))*np.minimum(1,(3.8-q)/.15)
    put(amb,note,start,gain,pan)
amb = room(amb)

# Overlap the end and beginning into a continuous ambient loop.
k = round(.8*SR)
loop = amb[k:].copy()
w = np.linspace(0,1,k)[:,None]
loop[-k:] = amb[-k:]*(1-w)+amb[:k]*w

t = np.arange(round(.72*SR))/SR
# A plucked low string: quick tension release, slightly inharmonic overtones.
f = 116.54*(1+.10*np.exp(-t/.025)-.065*(1-np.exp(-t/.18)))
phase = TAU*np.cumsum(f)/SR
pluck = np.zeros_like(t)
for harmonic, amplitude, decay in [(1,1,.19),(2,.43,.12),(3,.24,.085),(4,.10,.055),(6,.04,.035)]:
    ratio = harmonic*np.sqrt(1+.0016*harmonic**2)
    pluck += amplitude*np.sin(phase*ratio)*np.exp(-t/decay)
pluck += .13*np.sin(phase*1.017+.2)*np.exp(-t/.23)
pluck *= (1-np.exp(-t/.0025))*np.minimum(1,(.72-t)/.05)
pluck *= .20/max(np.max(np.abs(pluck)),1e-8)
accent = np.zeros((round(1.05*SR),2))
put(accent,pluck,0)
put(accent,pluck,.061,.12,-.25)
put(accent,pluck,.117,.055,.25)

def save(path, audio):
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .98
    with wave.open(str(OUT/path), 'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
        w.writeframes(np.round(audio*32767).astype('<i2').tobytes())
save('bgm/opening.wav',loop)
save('sfx/grin.wav',accent)
print('Rendered opening loop and grin accent')
