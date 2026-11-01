"""
Kaggle kernel (CPU, internet on): Kokoro voiceover + generated music bed, mixed onto the silent render.
Inputs: the assets dataset (narration.json) and the render kernel's output (video_silent.mp4).
Outputs in /kaggle/working: video_voice.mp4, video_music.mp4, subtitles.srt, voice_fit.json, logs/.
"""

import glob
import json
import os
import subprocess
import sys
import traceback
import wave
from pathlib import Path

W = Path("/kaggle/working")
LOG = W / "logs"
LOG.mkdir(parents=True, exist_ok=True)
TMP = Path("/kaggle/tmp")
TMP.mkdir(parents=True, exist_ok=True)
MAX_TEMPO = 1.18
GAP = 0.15  # seconds of air kept before the next line


def _crash(t, v, tb):
    (LOG / "error.log").write_text("".join(traceback.format_exception(t, v, tb)))
    sys.__excepthook__(t, v, tb)


sys.excepthook = _crash


def sh(cmd: str, name: str, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {cmd}", flush=True)
    r = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    (LOG / f"{name}.log").write_text(f"$ {cmd}\n--- stdout\n{r.stdout}\n--- stderr\n{r.stderr}\n")
    print(r.stdout[-2000:], r.stderr[-2000:], sep="\n", flush=True)
    if check and r.returncode != 0:
        raise SystemExit(f"{name} failed ({r.returncode})")
    return r


def dur_of(path: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).decode())


narr = json.loads(Path(glob.glob("/kaggle/input/**/narration.json", recursive=True)[0]).read_text())["lines"]
video = Path(glob.glob("/kaggle/input/**/video_silent.mp4", recursive=True)[0])
VDUR = dur_of(video)
print("video", video, VDUR)

# Poster: frame 0 becomes the split-face shot (t = 88 s), so the thumbnail shows the product, not a blank background.
POSTER_T = 88.0
sh(f"ffmpeg -v error -y -ss {POSTER_T} -i {video} -frames:v 1 {TMP}/poster.png", "poster-grab")
sh(
    f"ffmpeg -v error -y -i {video} -i {TMP}/poster.png -filter_complex \"[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]\" "
    f'-map "[v]" -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -r 30 -movflags +faststart {TMP}/video_poster.mp4',
    "poster-bake",
)
video = TMP / "video_poster.mp4"

# ── 1. Kokoro TTS in a Python 3.12 venv (Kokoro needs < 3.13) ──────────────────────────────────────
sh("apt-get update -qq && apt-get install -y -qq espeak-ng", "espeak")
py = TMP / "tts/bin/python"
if not py.exists():
    sh(f"pip install -q uv && uv venv -p 3.12 {TMP}/tts", "venv")
    sh(
        f'uv pip install --python {py} "kokoro>=0.9.4" soundfile "numpy<2.3" '
        "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
        "kokoro-install",
    )
(TMP / "lines.json").write_text(json.dumps([{"id": l["id"], "text": l["spoken"]} for l in narr]))
(TMP / "tts.py").write_text(
    """
import json, numpy as np, soundfile as sf
from kokoro import KPipeline
pipe = KPipeline(lang_code="a")
for l in json.load(open("/kaggle/tmp/lines.json")):
    audio = [np.asarray(a) for _, _, a in pipe(l["text"], voice="af_heart", speed=1.0)]
    sf.write(f"/kaggle/tmp/{l['id']}.wav", np.concatenate(audio), 24000)
    print(l["id"], "ok")
"""
)
sh(f"{py} {TMP}/tts.py", "tts")

# ── 2. Fit each line to its slot ───────────────────────────────────────────────────────────────────
fit = []
for i, l in enumerate(narr):
    raw = TMP / f"{l['id']}.wav"
    d = dur_of(raw)
    nxt = narr[i + 1]["start"] if i + 1 < len(narr) else VDUR
    room = nxt - l["start"] - GAP
    tempo = 1.0
    out = TMP / f"{l['id']}_fit.wav"
    if d > room:
        tempo = d / room
    if tempo > MAX_TEMPO:
        status = f"DOES NOT FIT (needs {tempo:.2f}x; capped at {MAX_TEMPO}x) — shorten the text"
        tempo = MAX_TEMPO
    else:
        status = "fits" if tempo == 1.0 else f"fits at {tempo:.2f}x"
    sh(f'ffmpeg -v error -y -i {raw} -filter:a "atempo={tempo:.4f},aresample=48000" -ac 1 {out}', f"fit-{l['id']}")
    placed = dur_of(out)
    fit.append({"id": l["id"], "start": l["start"], "raw_s": round(d, 2), "room_s": round(room, 2), "tempo": round(tempo, 3),
                "placed_s": round(placed, 2), "end": round(l["start"] + placed, 2), "status": status})
(W / "voice_fit.json").write_text(json.dumps(fit, indent=2))
for f in fit:
    print(f)

# ── 3. Voice track ─────────────────────────────────────────────────────────────────────────────────
inputs = " ".join(f"-i {TMP}/{l['id']}_fit.wav" for l in narr)
delays = ";".join(f"[{i}:a]adelay={int(l['start'] * 1000)}|{int(l['start'] * 1000)}[d{i}]" for i, l in enumerate(narr))
mixin = "".join(f"[d{i}]" for i in range(len(narr)))
sh(f'ffmpeg -v error -y {inputs} -filter_complex "{delays};{mixin}amix=inputs={len(narr)}:normalize=0,apad=whole_dur={VDUR}[v]" -map "[v]" -ar 48000 -ac 2 {TMP}/voice.wav', "voice-track")

# ── 4. Music bed, generated here (no third-party music) ────────────────────────────────────────────
import numpy as np  # noqa: E402  (kaggle's base env)

SR = 48000
n = int((VDUR + 1) * SR)
t = np.arange(n) / SR
bar = 4.0  # seconds per chord
chords = [[48, 55, 59, 64], [45, 52, 57, 60], [41, 48, 52, 57], [43, 50, 55, 59]]  # Cmaj7, Am7, Fmaj(add9), G
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
pad = np.zeros(n)
for k in range(int(np.ceil(VDUR / bar)) + 1):
    s0 = int(k * bar * SR)
    seg = np.arange(int(bar * 1.5 * SR))  # 50% overlap for smooth changes
    if s0 >= n:
        break
    seg = seg[: n - s0]
    ts = seg / SR
    env = np.minimum(1, ts / 1.2) * np.clip((bar * 1.5 - ts) / 1.5, 0, 1)
    tone = sum(np.sin(2 * np.pi * hz(m) * ts) + 0.3 * np.sin(2 * np.pi * 2 * hz(m) * ts) for m in chords[k % 4])
    pad[s0 : s0 + len(seg)] += env * tone
# soft arpeggio: chord tones an octave up, eighth notes at 75 bpm
arp = np.zeros(n)
step = 0.4
for j in range(int(VDUR / step)):
    s0 = int(j * step * SR)
    m = chords[int(j * step // bar) % 4][j % 4] + 12
    ts = np.arange(int(1.2 * SR)) / SR
    seg = np.exp(-ts * 3.5) * np.sin(2 * np.pi * hz(m) * ts)
    e0 = min(n, s0 + len(seg))
    arp[s0:e0] += seg[: e0 - s0]
music = 0.6 * pad / np.max(np.abs(pad)) + 0.25 * arp / np.max(np.abs(arp))
fade_in, fade_out = int(2 * SR), int(4 * SR)
music[:fade_in] *= np.linspace(0, 1, fade_in)
music[int(VDUR * SR) - fade_out : int(VDUR * SR)] *= np.linspace(1, 0, fade_out)
music[int(VDUR * SR) :] = 0
music = (music / np.max(np.abs(music)) * 0.9 * 32767).astype(np.int16)
with wave.open(str(TMP / "music.wav"), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(music.tobytes())

# ── 5. Mixes ───────────────────────────────────────────────────────────────────────────────────────
enc = "-c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest"
sh(
    f'ffmpeg -v error -y -i {video} -i {TMP}/voice.wav -i {TMP}/music.wav -filter_complex '
    f'"[2:a]volume=0.16,aformat=channel_layouts=stereo[m];[1:a]asplit=2[v1][v2];'
    f"[m][v1]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=350[duck];"
    f'[duck][v2]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]" -map 0:v -map "[a]" {enc} {W}/video_voice.mp4',
    "mix-voice",
)
sh(
    f'ffmpeg -v error -y -i {video} -i {TMP}/music.wav -filter_complex '
    f'"[1:a]volume=0.5,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11[a]" -map 0:v -map "[a]" {enc} {W}/video_music.mp4',
    "mix-music",
)

# ── 6. Subtitles from the placed voice timings ─────────────────────────────────────────────────────
import re  # noqa: E402
import textwrap  # noqa: E402


def chunks(text: str, limit: int = 84) -> list[str]:
    parts = re.split(r"(?<=[.?!:])\s+", text)
    out = []
    for p in parts:
        while len(p) > limit:  # split long sentences at a comma near the middle
            cut = max((m.start() + 1 for m in re.finditer(",", p) if m.start() < limit), default=p.rfind(" ", 0, limit))
            out.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            out.append(p)
    return out


def ts(x: float) -> str:
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


cues = []
for l, f in zip(narr, fit):
    cs = chunks(l["written"])
    total = sum(len(c) for c in cs)
    t0 = f["start"]
    for c in cs:
        d = f["placed_s"] * len(c) / total
        cues.append([t0, t0 + d, "\n".join(textwrap.wrap(c, 42)[:2])])
        t0 += d
for a, b in zip(cues, cues[1:]):
    a[1] = min(a[1], b[0] - 0.04)
srt = "\n".join(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n" for i, (a, b, txt) in enumerate(cues, 1))
(W / "subtitles.srt").write_text(srt, encoding="utf-8")

# ── 7. Checks ──────────────────────────────────────────────────────────────────────────────────────
for f in ["video_voice.mp4", "video_music.mp4"]:
    sh(f"ffprobe -v error -show_entries format=duration -of csv=p=0 {W}/{f}", f"probe-{f}")
    sh(f"ffmpeg -hide_banner -i {W}/{f} -af volumedetect -vn -f null - 2>&1 | grep -E 'mean_volume|max_volume'", f"vol-{f}", check=False)
print("done")
