"""Compose and render the duel's original night-theatre waltz.

74 BPM, 24 bars in 3/4 (58.38 seconds): felt piano, nylon plucks, wood bass,
soft strings, and restrained brushed percussion. Every voice is synthesized;
there are no samples or borrowed melodies. Instrument and room tails wrap into
the first bar so the composition loops without an end fade.

Requires numpy and ffmpeg (or imageio-ffmpeg). Run:
    python3 scripts/gen_duel_bgm.py
Writes duel.mp3 and its acoustic measurements; no classic music is replaced.
"""
from pathlib import Path
import argparse
import json
import math
import os
import shutil
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
BPM = 74
BEAT = 60 / BPM
BARS = 24
PERIOD = round(BARS * 3 * BEAT * SR)
OUT = Path(__file__).resolve().parents[1] / "public/audio/bgm"
RNG = np.random.default_rng(151026)
TAU = 2 * np.pi


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def clock(seconds):
    return np.arange(round(seconds * SR), dtype=np.float64) / SR


def noise(seconds, low, high):
    n = round(seconds * SR)
    freq = np.fft.rfftfreq(n, 1 / SR)
    curve = (1 - np.exp(-(freq / low) ** 2)) * np.exp(-(freq / high) ** 4)
    shaped = np.fft.irfft(np.fft.rfft(RNG.normal(size=n)) * curve, n=n)
    return shaped / max(np.std(shaped), .001)


def envelope(t, attack, decay, release=.1):
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay) * np.minimum(1, (t[-1] - t) / release)


def piano(note, seconds=2.8):
    """Mellow hammer attack, fast-dying upper partials, softly detuned strings."""
    t = clock(seconds)
    freq = hz(note)
    sound = np.zeros_like(t)
    for partial, gain, decay in [(1, 1, 1.08), (2, .38, .66), (3, .13, .43), (4, .055, .29), (5, .018, .18)]:
        # Slight string stiffness gives body without a sharp bell-like register.
        p = TAU * freq * partial * (1 + .000025 * partial ** 2) * t
        sound += gain * (np.sin(p) + .25 * np.sin(p * 1.00055)) * np.exp(-t / decay)
    sound += .013 * noise(seconds, 180, 1500) * np.exp(-t / .024)
    return .32 * sound * (1 - np.exp(-t / .006)) * np.minimum(1, (seconds - t) / .15)


def nylon(note, seconds=1.6):
    t = clock(seconds)
    p = TAU * hz(note) * t
    sound = np.sin(p) + .30 * np.sin(2 * p) * np.exp(-t / .18) + .065 * np.sin(3 * p) * np.exp(-t / .10)
    return .29 * sound * envelope(t, .004, .43)


def wood_bass(note):
    t = clock(1.45)
    p = TAU * hz(note) * (t + .0007 * (1 - np.exp(-t / .025)))
    sound = np.sin(p) + .27 * np.sin(2 * p) * np.exp(-t / .34) + .075 * np.sin(3 * p) * np.exp(-t / .16)
    return .34 * sound * envelope(t, .013, .50)


def strings(notes, seconds):
    t = clock(seconds + .75)
    sound = np.zeros_like(t)
    for index, note in enumerate(notes):
        p = TAU * hz(note) * t
        # Only round low harmonics; no sawtooth or piercing choir formants.
        vibrato = .006 * np.sin(TAU * .43 * t + index)
        sound += np.sin(p + vibrato) + .37 * np.sin(p * 1.0012 + .4) + .07 * np.sin(2 * p)
    swell = (1 - np.exp(-t / .32)) * np.minimum(1, np.maximum(0, (seconds + .75 - t) / .8))
    return .14 * sound / len(notes) * swell


def brush():
    t = clock(.23)
    return .019 * noise(.23, 500, 3000) * envelope(t, .018, .055, .05)


def soft_tick():
    t = clock(.075)
    return .011 * (np.sin(TAU * 670 * t) + .24 * np.sin(TAU * 1220 * t)) * envelope(t, .002, .011, .025)


class Mix:
    def __init__(self):
        self.dry = np.zeros((PERIOD + 4 * SR, 2), dtype=np.float64)
        self.send = np.zeros_like(self.dry)

    def put(self, voice, at, gain=1, pan=0, room=.25, human=0):
        start = max(0, round((at * BEAT + human) * SR))
        end = min(len(self.dry), start + len(voice))
        stereo = np.array([math.cos((pan + 1) * np.pi / 4), math.sin((pan + 1) * np.pi / 4)])
        event = voice[:end - start, None] * stereo * gain
        self.dry[start:end] += event
        self.send[start:end] += event * room

    def render(self):
        # Damped asymmetric theatre reflections. No bright metallic delay tails.
        freq = np.fft.rfftfreq(len(self.send), 1 / SR)
        damping = 1 / (1 + (freq / 2600) ** 4)
        room = np.fft.irfft(np.fft.rfft(self.send, axis=0) * damping[:, None], n=len(self.send), axis=0)
        for index in range(32):
            delay = .026 + index * .043 + .009 * math.sin(index * 2.1)
            offset = round(delay * SR)
            reflected = room[:-offset, ::-1] if index % 2 else room[:-offset]
            self.dry[offset:] += reflected * (.10 * math.exp(-delay / .56))
        result = self.dry[:PERIOD].copy()
        result[:len(self.dry) - PERIOD] += self.dry[PERIOD:]
        result -= result.mean(axis=0)
        # Quiet mix leaves room for cards and score feedback at the default 60%.
        result = np.tanh(result * .8)
        rms = np.sqrt(np.mean(result ** 2))
        result *= .091 / max(rms, 1e-9)
        result *= min(1, .76 / np.max(np.abs(result)))
        # The wrapped tail is continuous musically; soften any sub-millisecond
        # sample discontinuity without fading out the loop or its downbeat.
        join = round(.003 * SR)
        result[:join] += (result[-1] - result[0])[None, :] * np.linspace(1, 0, join)[:, None]
        return result


# New E-minor phrase: a sparse, slightly crooked waltz with an answering voice.
# Harmony cycles every eight bars, while the three passes change their density.
HARMONY = [
    (40, [55, 59, 64, 66]), (40, [55, 59, 64, 66]),
    (36, [55, 59, 62, 64]), (36, [55, 59, 62, 64]),
    (33, [55, 59, 60, 64]), (33, [55, 59, 60, 64]),
    (35, [54, 57, 60, 63]), (35, [54, 57, 60, 63]),
]
PHRASE = {
    0: [(0.45, 71, .74), (1.75, 67, .54)],
    1: [(.55, 66, .61), (2.05, 64, .72)],
    2: [(.35, 67, .75), (1.65, 71, .55)],
    3: [(.65, 69, .66)],
    4: [(.35, 72, .68), (1.8, 71, .51)],
    5: [(.55, 67, .68), (2.05, 64, .55)],
    6: [(.40, 66, .65), (1.6, 63, .55)],
    7: [(.4, 66, .56), (1.8, 63, .47)],
}


def compose():
    mix = Mix()
    for bar in range(BARS):
        at = bar * 3
        section = bar // 8
        root, voicing = HARMONY[bar % 8]
        mix.put(wood_bass(root), at, .67, -.05, .08)
        if bar % 2 == 1:
            mix.put(wood_bass(root + 7), at + 2, .30, -.08, .10, .008)
        mix.put(strings(voicing[:3], BEAT * 3), at, .28 if section == 1 else .17, .35, .55)
        for beat, notes in [(1, voicing[1:3]), (2, [voicing[0], voicing[-1]])]:
            for index, note in enumerate(notes):
                mix.put(piano(note, 1.7), at + beat, .33 if beat == 1 else .24, -.32 + .22 * index, .32, .015 + index * .014)
        for onset, note, gain in PHRASE[bar % 8]:
            # Middle section trades the melody to nylon; the return adds a soft
            # answer rather than making the full loop progressively louder.
            voice = nylon(note) if section == 1 else piano(note)
            mix.put(voice, at + onset, gain * (.83 if section == 1 else 1), .19, .38, .009)
        if section == 1:
            for onset, index in [(.55, 0), (1.45, 1), (2.35, 2)]:
                mix.put(nylon(voicing[index] + 12), at + onset, .25, -.35, .32)
        elif section == 2 and bar % 2 == 0:
            mix.put(nylon(voicing[0] + 12), at + 2.55, .27, -.38, .36)
        # Extremely light brushes, deliberately no electronic kick or hi-hat.
        if bar > 1:
            mix.put(brush(), at + 1, .75, .28, .1, .02)
            mix.put(brush(), at + 2, .45, -.27, .1, .018)
            if bar % 4 in (1, 3):
                mix.put(soft_tick(), at + 2.5, .65, .18, .1)
    return mix.render()


def encoder():
    path = shutil.which("ffmpeg") or os.environ.get("FFMPEG_BINARY")
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit("Install ffmpeg or the imageio-ffmpeg Python package to encode duel.mp3")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wav", type=Path, help="Optionally keep the uncompressed loop for audition/measurement")
    args = parser.parse_args()
    ffmpeg = encoder()
    sound = compose()
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="joker-duel-music-") as temporary:
        source = args.wav or Path(temporary) / "duel.wav"
        source.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(source), "wb") as stream:
            stream.setnchannels(2)
            stream.setsampwidth(2)
            stream.setframerate(SR)
            stream.writeframes((np.clip(sound, -1, 1) * 32767).astype("<i2").tobytes())
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                        "-codec:a", "libmp3lame", "-b:a", "192k", "-ar", str(SR),
                        "-metadata", "title=Midnight at the Joker's Table", "-metadata", "artist=Joker original synthesis",
                        str(OUT / "duel.mp3")], check=True)
    report = {
        "file": "duel.mp3", "title": "Midnight at the Joker's Table", "original_synthesis": True,
        "bpm": BPM, "meter": "3/4", "bars": BARS, "seconds": round(len(sound) / SR, 3),
        "sample_rate": SR, "peak_dbfs": round(float(20 * np.log10(np.max(np.abs(sound)))), 2),
        "rms_dbfs": round(float(20 * np.log10(np.sqrt(np.mean(sound ** 2)))), 2),
        "clipped_samples": int(np.sum(np.abs(sound) >= 1)),
        "loop_join_delta": float(np.max(np.abs(sound[0] - sound[-1]))),
        "sections": ["felt piano / sparse waltz", "nylon answer / soft strings", "piano return / plucked replies"],
    }
    (OUT / "duel.music.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
