"""生成小丑牌所需全部音频文件（WAV 格式，纯 Python 标准库）"""
import wave, struct, math, os

SR = 44100
AMP = 20000

SFX_DIR = os.path.join(os.path.dirname(__file__), '../public/audio/sfx')
BGM_DIR = os.path.join(os.path.dirname(__file__), '../public/audio/bgm')
os.makedirs(SFX_DIR, exist_ok=True)
os.makedirs(BGM_DIR, exist_ok=True)

def save_wav(path, samples):
    clamped = [max(-32767, min(32767, int(v))) for v in samples]
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(struct.pack(f'<{len(clamped)}h', *clamped))
    print(f'  wrote {os.path.basename(path):20s}  {len(clamped)/SR:.2f}s')

def sin(f, t):
    return math.sin(2 * math.pi * f * t)

def note(freq):
    """频率 -> 带泛音的合成器音色"""
    def fn(t, env):
        return (sin(freq, t) * 0.6 + sin(freq*2, t) * 0.25 + sin(freq*3, t) * 0.1 + sin(freq*0.5, t) * 0.15) * env
    return fn

def adsr(t, dur, a, d, sl, r):
    if t < a: return t / a
    elif t < a+d: return 1.0 - (1.0-sl) * (t-a) / d
    elif t < dur-r: return sl
    elif dur > 0: return max(0, sl * (1 - (t-(dur-r)) / max(r, 1e-6)))
    return 0

def gen_tone(freq, dur, a=0.005, d=0.08, sl=0.5, r=0.1, harmonics=None):
    n = int(SR * dur)
    out = []
    if harmonics is None:
        harmonics = [(1, 0.6), (2, 0.25), (3, 0.1), (0.5, 0.15)]
    for i in range(n):
        t = i / SR
        e = adsr(t, dur, a, d, sl, r)
        v = sum(sin(freq*fr, t) * am for fr, am in harmonics)
        out.append(v * e * AMP)
    return out

def gen_sweep(f1, f2, dur, a=0.01, r=0.05):
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        f = f1 * ((f2/f1) ** (t/dur))
        phase += 2 * math.pi * f / SR
        e = adsr(t, dur, a, dur*0.5, 0.5, r)
        out.append(math.sin(phase) * e * AMP)
    return out

def mix(*tracks):
    length = max(len(t) for t in tracks)
    out = [0.0] * length
    for track in tracks:
        for i, v in enumerate(track):
            out[i] += v
    # normalize to avoid clipping
    peak = max(abs(v) for v in out) or 1
    scale = min(1.0, 32000 / peak)
    return [v * scale for v in out]

def silence(dur):
    return [0] * int(SR * dur)

def concat(*parts):
    out = []
    for p in parts:
        out.extend(p)
    return out

# ─── 频率常量 ─────────────────────────────────
C3=130.8; D3=146.8; E3=164.8; F3=174.6; G3=196.0; A3=220.0; B3=246.9
C4=261.6; D4=293.7; E4=329.6; F4=349.2; G4=392.0; A4=440.0; B4=493.9
C5=523.3; D5=587.3; E5=659.3; F5=698.5; G5=784.0; A5=880.0
C6=1046.5

# ─── SFX ──────────────────────────────────────
print('=== SFX ===')

# select: 明亮短促高音
save_wav(f'{SFX_DIR}/select.wav',
    gen_tone(A4, 0.13, a=0.004, d=0.06, sl=0.3, r=0.06, harmonics=[(1,0.7),(2,0.4),(3,0.1)]))

# deselect: 稍低沉，往下走
save_wav(f'{SFX_DIR}/deselect.wav',
    gen_sweep(A4, E4, 0.12, a=0.003, r=0.04))

# sort: 上行扫频
save_wav(f'{SFX_DIR}/sort.wav',
    gen_sweep(C4, G5, 0.22, a=0.01, r=0.05))

# chip: 极短高频 tick（Balatro 感）
save_wav(f'{SFX_DIR}/chip.wav',
    gen_tone(C6, 0.07, a=0.002, d=0.03, sl=0.0, r=0.03, harmonics=[(1,1),(2,0.3)]))

# play: 出牌感——上行三和弦
def play_sfx():
    return concat(
        gen_tone(C4, 0.12, a=0.004, d=0.05, sl=0.2, r=0.05),
        gen_tone(E4, 0.12, a=0.004, d=0.05, sl=0.2, r=0.05),
        gen_tone(G4, 0.20, a=0.004, d=0.10, sl=0.3, r=0.08),
    )
save_wav(f'{SFX_DIR}/play.wav', play_sfx())

# discard: 下行甩出
save_wav(f'{SFX_DIR}/discard.wav',
    gen_sweep(G4, C3, 0.28, a=0.005, r=0.08))

# ai-start: 科技感双音
save_wav(f'{SFX_DIR}/ai-start.wav',
    mix(gen_tone(A4, 0.18, a=0.004, d=0.06, sl=0.2, r=0.06),
        gen_tone(E5, 0.18, a=0.008, d=0.06, sl=0.2, r=0.06)))

# ai-loop: 1.5s 可循环的机器思考声
def ai_loop_sfx():
    samps = []
    for i in range(int(SR * 1.5)):
        t = i / SR
        # 缓慢调制的低频嗡嗡
        mod = 0.5 + 0.5 * math.sin(2 * math.pi * 3 * t)
        v = (sin(220, t) * 0.5 + sin(330, t) * 0.3) * mod * 0.4 * AMP
        # 淡入淡出
        fade = min(t/0.05, 1, (1.5-t)/0.05)
        samps.append(v * fade)
    return samps
save_wav(f'{SFX_DIR}/ai-loop.wav', ai_loop_sfx())

# fly: 飞牌音效（上扫+高频）
save_wav(f'{SFX_DIR}/fly.wav',
    gen_sweep(C4, C6, 0.20, a=0.005, r=0.04))

# joker: 魔法闪光（泛音丰富的短音）
def joker_sfx():
    return mix(
        gen_tone(G5, 0.45, a=0.003, d=0.1, sl=0.3, r=0.2, harmonics=[(1,0.5),(2,0.4),(3,0.3),(4,0.2)]),
        gen_tone(E5, 0.45, a=0.010, d=0.1, sl=0.2, r=0.2, harmonics=[(1,0.4),(2,0.3)]),
        gen_tone(C5, 0.45, a=0.020, d=0.1, sl=0.2, r=0.2, harmonics=[(1,0.3),(2,0.2)]),
    )
save_wav(f'{SFX_DIR}/joker.wav', joker_sfx())

# score: 得分爆字（上行扫+和弦）
def score_sfx():
    sweep_part = gen_sweep(C4, C6, 0.15, a=0.003, r=0.02)
    chord = mix(
        gen_tone(C5, 0.35, a=0.003, d=0.1, sl=0.4, r=0.15),
        gen_tone(E5, 0.35, a=0.005, d=0.1, sl=0.3, r=0.15),
        gen_tone(G5, 0.35, a=0.008, d=0.1, sl=0.3, r=0.15),
    )
    return concat(sweep_part, chord)
save_wav(f'{SFX_DIR}/score.wav', score_sfx())

# count: 计分滴答声
save_wav(f'{SFX_DIR}/count.wav',
    gen_tone(G4, 0.06, a=0.002, d=0.02, sl=0.0, r=0.02, harmonics=[(1,0.8),(2,0.3)]))

# win: 胜利音效
def win_sfx():
    return concat(
        gen_tone(C4, 0.12, a=0.004, d=0.05, sl=0.3, r=0.04),
        gen_tone(E4, 0.12, a=0.004, d=0.05, sl=0.3, r=0.04),
        gen_tone(G4, 0.12, a=0.004, d=0.05, sl=0.3, r=0.04),
        mix(
            gen_tone(C5, 0.55, a=0.004, d=0.1, sl=0.5, r=0.2),
            gen_tone(E5, 0.55, a=0.008, d=0.1, sl=0.4, r=0.2),
            gen_tone(G5, 0.55, a=0.012, d=0.1, sl=0.4, r=0.2),
        ),
    )
save_wav(f'{SFX_DIR}/win.wav', win_sfx())

# lose: 失败下行
def lose_sfx():
    return concat(
        gen_tone(G4, 0.18, a=0.004, d=0.08, sl=0.4, r=0.07),
        gen_tone(E4, 0.18, a=0.004, d=0.08, sl=0.3, r=0.07),
        gen_tone(C4, 0.18, a=0.004, d=0.08, sl=0.3, r=0.07),
        gen_tone(A3, 0.45, a=0.004, d=0.15, sl=0.3, r=0.2),
    )
save_wav(f'{SFX_DIR}/lose.wav', lose_sfx())

# shop-enter: 商店钟声
def shop_enter_sfx():
    return mix(
        gen_tone(C5, 0.5, a=0.003, d=0.05, sl=0.2, r=0.3, harmonics=[(1,0.6),(2,0.5),(4,0.3),(8,0.1)]),
        gen_tone(G5, 0.5, a=0.010, d=0.05, sl=0.15, r=0.3, harmonics=[(1,0.5),(2,0.4),(4,0.2)]),
    )
save_wav(f'{SFX_DIR}/shop-enter.wav', shop_enter_sfx())

# buy: 金币音
def buy_sfx():
    return mix(
        gen_tone(E5, 0.35, a=0.003, d=0.04, sl=0.2, r=0.2, harmonics=[(1,0.6),(3,0.4),(5,0.2)]),
        gen_tone(C5, 0.35, a=0.010, d=0.04, sl=0.15, r=0.2, harmonics=[(1,0.5),(3,0.3)]),
    )
save_wav(f'{SFX_DIR}/buy.wav', buy_sfx())

# skip: 轻柔点击
save_wav(f'{SFX_DIR}/skip.wav',
    gen_tone(F4, 0.10, a=0.003, d=0.04, sl=0.0, r=0.04, harmonics=[(1,0.7),(2,0.2)]))

# ─── BGM ──────────────────────────────────────
print('=== BGM ===')

BPM = 128
BEAT = SR * 60 // BPM  # 每拍采样数

def arp_note(freq, dur_beats, vol=0.7):
    """琶音音符"""
    dur = dur_beats * 60 / BPM
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        e = adsr(t, dur, a=0.005, d=dur*0.2, sl=0.5, r=dur*0.25)
        v = (sin(freq, t)*0.5 + sin(freq*2, t)*0.3 + sin(freq*3, t)*0.1 + sin(freq*0.5, t)*0.15) * e * vol
        out.append(v * AMP)
    return out

def bass_note(freq, dur_beats, vol=0.5):
    dur = dur_beats * 60 / BPM
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        e = adsr(t, dur, a=0.01, d=dur*0.15, sl=0.6, r=dur*0.3)
        v = (sin(freq, t)*0.7 + sin(freq*2, t)*0.2 + sin(freq*0.5, t)*0.3) * e * vol
        out.append(v * AMP)
    return out

# ── main BGM: Am-F-C-G 循环 ──────────────────
# 每和弦 4 拍，一圈 16 拍，重复 4 次 = 约 15s
def make_main_bgm():
    # 和弦 -> 音符序列 (freq, beats)
    chords = [
        # Am: A3 C4 E4 A4
        [(A3,0.5),(C4,0.5),(E4,0.5),(A4,0.5),(E4,0.5),(C4,0.5),(A3,0.5),(C4,0.5)],
        # F: F3 A3 C4 F4
        [(F3,0.5),(A3,0.5),(C4,0.5),(F4,0.5),(C4,0.5),(A3,0.5),(F3,0.5),(A3,0.5)],
        # C: C4 E4 G4 C5
        [(C4,0.5),(E4,0.5),(G4,0.5),(C5,0.5),(G4,0.5),(E4,0.5),(C4,0.5),(E4,0.5)],
        # G: G3 B3 D4 G4
        [(G3,0.5),(B3,0.5),(D4,0.5),(G4,0.5),(D4,0.5),(B3,0.5),(G3,0.5),(B3,0.5)],
    ]
    bass_line = [
        (A2:=110.0, 4), (F2:=87.3, 4), (C3, 4), (G2:=98.0, 4)
    ]

    melody_track = []
    bass_track = []

    for _ in range(4):  # 重复 4 圈
        for chord_notes, (b_freq, b_beats) in zip(chords, bass_line):
            for freq, beats in chord_notes:
                melody_track.extend(arp_note(freq, beats, vol=0.6))
            bass_track.extend(bass_note(b_freq, b_beats, vol=0.55))

    # 对齐长度
    length = min(len(melody_track), len(bass_track))
    melody_track = melody_track[:length]
    bass_track = bass_track[:length]

    combined = [m + b for m, b in zip(melody_track, bass_track)]
    peak = max(abs(v) for v in combined) or 1
    scale = 30000 / peak
    return [v * scale for v in combined]

save_wav(f'{BGM_DIR}/main.wav', make_main_bgm())

# ── shop BGM: C-G-Am-F，明亮轻快 ─────────────
def make_shop_bgm():
    chords = [
        # C: C4 E4 G4
        [(C4,0.33),(E4,0.33),(G4,0.33),(C5,0.33),(G4,0.33),(E4,0.33)],
        # G: G4 B4 D5
        [(G4,0.33),(B4,0.33),(D5,0.33),(G5,0.33),(D5,0.33),(B4,0.33)],
        # Am: A4 C5 E5
        [(A4,0.33),(C5,0.33),(E5,0.33),(A5,0.33),(E5,0.33),(C5,0.33)],
        # F: F4 A4 C5
        [(F4,0.33),(A4,0.33),(C5,0.33),(F5:=698.5,0.33),(C5,0.33),(A4,0.33)],
    ]
    bass_line_freqs = [C3, G2:=98.0, A2:=110.0, F2:=87.3]

    melody = []
    bass = []

    for _ in range(4):
        for chord_notes, b_freq in zip(chords, bass_line_freqs):
            for freq, beats in chord_notes:
                melody.extend(arp_note(freq, beats, vol=0.55))
            bass.extend(bass_note(b_freq, 2, vol=0.4))

    length = min(len(melody), len(bass))
    combined = [m + b for m, b in zip(melody[:length], bass[:length])]
    peak = max(abs(v) for v in combined) or 1
    return [v * 30000 / peak for v in combined]

save_wav(f'{BGM_DIR}/shop.wav', make_shop_bgm())

# ── win BGM: 上行胜利 ─────────────────────────
def make_win_bgm():
    scale = [C4, D4, E4, F4, G4, A4, B4, C5, E5, G5]
    melody = []
    for i, freq in enumerate(scale):
        beats = 0.4 if i < len(scale)-1 else 1.5
        melody.extend(arp_note(freq, beats, vol=0.75))

    # 最后加大和弦
    chord = mix(
        arp_note(C5, 2.0, vol=0.6),
        arp_note(E5, 2.0, vol=0.5),
        arp_note(G5, 2.0, vol=0.5),
    )
    combined = concat(melody, chord)
    peak = max(abs(v) for v in combined) or 1
    return [v * 30000 / peak for v in combined]

save_wav(f'{BGM_DIR}/win.wav', make_win_bgm())

# ── lose BGM: 下行悲伤 ────────────────────────
def make_lose_bgm():
    scale = [A4, G4, F4, E4, D4, C4, B3, A3]
    melody = []
    for i, freq in enumerate(scale):
        beats = 0.5 if i < len(scale)-1 else 2.0
        melody.extend(arp_note(freq, beats, vol=0.6))

    peak = max(abs(v) for v in melody) or 1
    return [v * 28000 / peak for v in melody]

save_wav(f'{BGM_DIR}/lose.wav', make_lose_bgm())

print('\n全部音频生成完毕！')
