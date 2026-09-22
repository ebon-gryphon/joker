"""Render the approved electronic table theme as a seamless 40-second loop.
Requires numpy. Original synthesis; no external samples or model API.
Run: python3 scripts/gen_main_bgm.py
"""
from pathlib import Path
import math, wave, json
import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/audio/bgm'
rng = np.random.default_rng(220926)
TAU = 2 * np.pi

def hz(note): return 440 * 2 ** ((note - 69) / 12)
def timeline(duration): return np.arange(int(duration * SR), dtype=np.float64) / SR

def shaped_noise(duration, low=100, high=8000):
    n = int(duration * SR)
    x = rng.normal(size=n)
    f = np.fft.rfftfreq(n, 1 / SR)
    curve = (1 - np.exp(-(f / low)**2)) * np.exp(-(f / high)**4)
    y = np.fft.irfft(np.fft.rfft(x) * curve, n=n)
    return y / max(np.std(y), .01)

def bass(note, length=.7, electronic=False):
    t=timeline(length+.18); f=hz(note)
    phase=TAU*f*(t+.0015*(1-np.exp(-t/.012)))
    if electronic:
        x=np.sin(phase) + .14*np.sin(phase*2)*np.exp(-t/.14)
        return .67*x*(1-np.exp(-t/.008))*np.exp(-t/(length*.8))*np.minimum(1,(length+.18-t)/.08)
    x=np.sin(phase)*np.exp(-t/.48)
    for h,amp,decay in [(2,.38,.26),(3,.18,.17),(4,.08,.08)]:
        x+=amp*np.sin(phase*h+.07*h)*np.exp(-t/decay)
    x+=.015*shaped_noise(length+.18,150,2500)*np.exp(-t/.024)
    return .7*x*(1-np.exp(-t/.003))*np.minimum(1,(length+.18-t)/.07)

def bell(note, length=1.4):
    t=timeline(length); p=TAU*hz(note)*t
    x=np.sin(p)*np.exp(-t/.62)+.19*np.sin(p*2.01)*np.exp(-t/.22)+.07*np.sin(p*3.98)*np.exp(-t/.10)
    return .30*x*(1-np.exp(-t/.009))*np.minimum(1,(length-t)/.13)

def pad(notes, length):
    t=timeline(length+.9); x=np.zeros_like(t)
    for note in notes:
        p=TAU*hz(note)*t
        x+=np.sin(p+.006*np.sin(TAU*.19*t))+ .33*np.sin(p*1.002)+.09*np.sin(p*2)
    env=(1-np.exp(-t/.3))*np.minimum(1,np.maximum(0,(length+.9-t)/.85))
    return x/max(len(notes),1)*env*.35

def pluck(note):
    t=timeline(.65); p=TAU*hz(note)*t
    return .38*(np.sin(p+.5*np.sin(p*2)*np.exp(-t/.05))+.10*np.sin(p*3))*np.exp(-t/.13)*(1-np.exp(-t/.004))

def drum(kind, strength=1):
    if kind=='kick':
        t=timeline(.35); phase=TAU*(48*t+43*.016*(1-np.exp(-t/.016)))
        x=np.sin(phase)*np.exp(-t/.085)*(1-np.exp(-t/.0015))
        return x*.65*strength
    if kind=='brush':
        t=timeline(.26); x=shaped_noise(.26,650,5500)
        return .105*x*(1-np.exp(-t/.012))*np.exp(-t/.055)*strength
    if kind=='sweep':
        t=timeline(.45); x=shaped_noise(.45,850,5200)
        return .04*x*np.sin(np.pi*t/.45)**2*strength
    if kind=='hat':
        t=timeline(.075); x=shaped_noise(.075,6000,12000)
        return .047*x*np.exp(-t/.015)*(1-np.exp(-t/.001))*strength
    if kind=='rim':
        t=timeline(.09)
        return .11*(np.sin(TAU*1150*t)+.5*np.sin(TAU*1780*t))*np.exp(-t/.012)*strength

class Mix:
    def __init__(self, bpm, bars=16):
        self.beat=60/bpm; self.duration=bars*4*self.beat; self.bpm=bpm
        self.x=np.zeros((int((self.duration+4)*SR),2)); self.send=np.zeros_like(self.x)
    def put(self, sample, beat, gain=1, pan=0, wet=.15, human=0):
        start=max(0,int((beat*self.beat+human)*SR)); end=min(len(self.x),start+len(sample)); n=end-start
        if n<=0:return
        pan=np.clip(pan,-1,1); stereo=np.array([math.cos((pan+1)*np.pi/4),math.sin((pan+1)*np.pi/4)])
        y=sample[:n,None]*stereo*gain
        self.x[start:end]+=y; self.send[start:end]+=y*wet
    def echo(self, sample, beat, gain=.12, pan=.5):
        self.put(sample,beat,gain,pan,.12)
        self.put(sample,beat+.75,gain*.31,-pan,.1)
        self.put(sample,beat+1.5,gain*.13,pan,.1)
    def finish(self,name):
        # Diffuse stereo room with restrained early reflections and a decaying tail.
        for c in range(2):
            ir=np.zeros(int(1.4*SR))
            for d,g in [(.027,.32),(.047,.24),(.079,.20),(.113,.17),(.173,.14),(.241,.09)]:
                ir[int((d+c*.007)*SR)]+=g
            tail=rng.normal(size=len(ir)); t=np.arange(len(ir))/SR
            tail*=np.exp(-t*5.5)*.006*(1-np.exp(-t/.08))
            ir+=tail
            size=1<<(len(self.send)+len(ir)-1).bit_length()
            convolved=np.fft.irfft(np.fft.rfft(self.send[:,1-c],size)*np.fft.rfft(ir,size),size)[:len(self.x)]
            self.x[:,c]+=convolved
        # Wrap instrument and room tails over the first downbeat. Keep exactly
        # 16 bars at 96 BPM; the audition's end fade is unsuitable for looping.
        period = round(self.duration * SR)
        x = self.x[:period].copy()
        tail = self.x[period:]
        x[:len(tail)] += tail
        x-=x.mean(axis=0)
        # Soft saturation, consistent average loudness, true peak safety headroom.
        x=np.tanh(x*.9)
        rms=np.sqrt(np.mean(x*x)); x*=.112/max(rms,1e-9)
        peak=np.max(np.abs(x)); x*=min(1,.84/peak)
        # Remove any residual sample discontinuity over a 3 ms lead-in.
        # At this duration the next musical transient remains intact.
        join = round(.003 * SR)
        x[:join] += (x[-1] - x[0])[None, :] * np.linspace(1, 0, join)[:, None]
        pcm=(np.clip(x,-1,1)*32767).astype('<i2')
        with wave.open(str(OUT/name),'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        return {'file':name,'bpm':self.bpm,'seconds':round(len(x)/SR,2),'peak_dbfs':round(20*np.log10(np.max(np.abs(x))),2),'rms_dbfs':round(20*np.log10(np.sqrt(np.mean(x*x))),2),'clipped_samples':int(np.sum(np.abs(x)>=1))}

# A shared D-minor motif: A–C–B♭–A, F–E–D; composed for this preview.
MOTIF={
 2:[(.5,69,.65),(1.6,72,.5),(2.6,70,.7)],
 3:[(.25,69,.8),(2,65,.65),(3.25,64,.45)],
 4:[(.5,62,1.4),(2.6,65,.55)],
 5:[(1,67,.75),(2.6,65,.6)],
 6:[(.5,64,.6),(1.6,65,.4),(3,61,.65)],
 7:[(.5,62,1.5)],
 10:[(.5,69,.65),(1.6,72,.5),(2.6,70,.7)],
 11:[(.25,69,.8),(2,65,.65),(3.25,64,.45)],
 12:[(.5,62,1.2),(2.6,65,.55)],
 13:[(1,67,.75),(2.6,69,.6)],
 14:[(.5,70,.6),(1.6,69,.4),(3,61,.65)],
 15:[(.5,62,1.5)]
}

def make_electronic():
    m=Mix(96)
    harmony=[(38,[50,57,60,64]),(38,[50,57,60,64]),(34,[50,53,57,60]),(34,[50,53,57,60]),(31,[50,53,57,62]),(31,[50,53,57,62]),(33,[49,55,58,64]),(38,[50,57,60,64])]
    for bar in range(16):
        base=bar*4; root,voicing=harmony[bar%8]
        m.put(pad(voicing,4*m.beat),base,.48,-.3,.37)
        m.put(pad([n+12 for n in voicing[1:3]],4*m.beat),base,.095,.6,.45)
        for b,gain in [(0,.44),(1.5,.29),(2,.40),(3.25,.28)]:
            m.put(bass(root,.35,True),base+b,gain,0,.01)
        pattern=[0,2,1,3,2,1,3,1] if bar%2==0 else [0,1,3,2,1,0,2,1]
        for step,index in enumerate(pattern):
            if (step==3 and bar%2==0) or (step==7 and bar%4==3):continue
            at=step*.5+(.045 if step%2 else 0)
            m.echo(pluck(voicing[index]+12),base+at,.22 if step%2==0 else .155,(-.45 if step%2==0 else .45))
        for b in [0,2]:m.put(drum('kick'),base+b,.4,0,.02)
        if bar>=4 and bar%2==1:m.put(drum('kick',.55),base+3.5,.3,0,.02)
        for b in [1,3]:
            m.put(drum('brush'),base+b,.65,.18,.15)
            m.put(drum('rim'),base+b,.27,-.1,.2)
        for step in range(8):
            m.put(drum('hat'),base+step*.5,.24 if step%2 else .14,(-.4 if step%2 else .4),.12)
        for at,note,length in MOTIF.get(bar,[]):
            # Same melodic phrase in a softer, higher-register glass voice.
            m.echo(bell(note+12,max(1.1,length)),base+at,.29,.25)
    return m.finish('main.wav')

if __name__ == '__main__':
    print(json.dumps(make_electronic(), ensure_ascii=False, indent=2))
