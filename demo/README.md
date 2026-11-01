# Demo video

2:55, 1920×1080, 30 fps. Storyboard and the source of every number: [STORYBOARD.md](STORYBOARD.md). Narration: [narration.json](narration.json).

## How it's made

| Step | Where | Script |
|---|---|---|
| Record 4 chapters of the real app with a scripted, human-paced browser (visible cursor, gliding mouse, typed input). Phone layout 390×844 rendered 2× for sharpness. Chrome's fake camera plays a licence-free Pexels clip (13770894); the analyses are real YouCam HD calls. Key moments go to `marks.json`. | laptop, against a local production build (no access code, so no secret on screen) | [record.py](record.py) |
| Build a Hyperframes composition (HTML + GSAP) from `marks.json`: phone-bezel chapters, slides, chapter cards, captions under the phone. Asserts the plan is exactly 175 s, sections don't overlap and every trim is inside its clip. | Kaggle | [build.py](build.py) |
| `hyperframes lint`, `check`, `snapshot` (preview sheet), `render --quality delivery` | Kaggle (CPU) | [kaggle/render.py](kaggle/render.py) |
| Kokoro-82M voice (`af_heart`, 24 kHz), lines fitted to their slots, a music bed generated in code (no third-party music), ducking, loudness normalisation, poster frame, subtitles | Kaggle (CPU) | [kaggle/voice/voice.py](kaggle/voice/voice.py) |

Recordings, renders and the stock clip are git-ignored (`demo/out/`, `demo/build/`).

## Voice fit (Kokoro `af_heart`, speed 1.0) — v2 cut

Every line fits its slot at normal speed; nothing was sped up.

| Line | Starts | Length | Room | Tempo | Ends |
|---|---|---|---|---|---|
| hook | 0.3 s | 5.25 s | 7.75 s | 1.00 | 5.54 s |
| glance | 8.2 s | 9.35 s | 11.85 s | 1.00 | 17.53 s |
| ch1 | 20.2 s | 16.02 s | 19.85 s | 1.00 | 36.2 s |
| ch2 | 40.2 s | 22.80 s | 29.85 s | 1.00 | 62.98 s |
| youcam | 70.2 s | 10.12 s | 11.85 s | 1.00 | 80.3 s |
| ch3 | 82.2 s | 12.18 s | 15.85 s | 1.00 | 94.35 s |
| design | 98.2 s | 8.10 s | 8.85 s | 1.00 | 106.3 s |
| validation | 107.2 s | 13.22 s | 15.35 s | 1.00 | 120.4 s |
| ch4 | 122.7 s | 18.82 s | 25.65 s | 1.00 | 141.5 s |
| results | 148.5 s | 11.53 s | 12.85 s | 1.00 | 160.0 s |
| who | 161.5 s | 4.40 s | 7.85 s | 1.00 | 165.89 s |
| outro | 169.5 s | 4.00 s | 5.35 s | 1.00 | 173.49 s |

## Checks on the final files

- Both versions 175.000 s; AAC 48 kHz, 192 kb/s; loudness-normalised to −16 LUFS (true-peak −1.5 dB).
- Subtitles: 44 cues, no overlaps (≥ 40 ms gaps), ≤ 2 lines of ≤ 42 characters.
- Hyperframes `check`: runtime, layout, contrast, motion all pass; lint 0 errors.

## Worth checking by watching

- v2 (2026-11-02) adds a positive-control slide and trims the silences: the longest music-only gaps are now ~7 s after chapter 2 and ~7 s after chapter 4.
- Chapter 2's waits between photos are cut; the caption and side panel say so.
- The app's live-check text flickers to "Light is uneven" once in chapter 2: the stock clip's balance sits near the threshold. It's the real app behaviour, left in.
- The fake-camera clip is padded with a blurred copy of itself so the face fits the frame; its edges show in the camera preview.
