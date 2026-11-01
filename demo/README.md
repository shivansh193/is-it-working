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

## Voice fit (Kokoro `af_heart`, speed 1.0)

Every line fits its slot at normal speed; nothing was sped up.

| Line | Starts | Length | Room | Tempo | Ends |
|---|---|---|---|---|---|
| hook | 0.3 s | 5.25 s | 7.75 s | 1.00 | 5.5 s |
| glance | 8.2 | 9.35 | 11.85 | 1.00 | 17.5 |
| ch1 | 20.2 | 16.02 | 19.85 | 1.00 | 36.2 |
| ch2 | 40.2 | 22.80 | 29.85 | 1.00 | 63.0 |
| youcam | 70.2 | 10.12 | 11.85 | 1.00 | 80.3 |
| ch3 | 82.2 | 12.18 | 15.85 | 1.00 | 94.3 |
| design | 98.2 | 9.62 | 11.85 | 1.00 | 107.8 |
| ch4 | 110.2 | 21.50 | 30.35 | 1.00 | 131.7 |
| results | 140.7 | 13.03 | 15.35 | 1.00 | 153.7 |
| who | 156.2 | 8.43 | 11.85 | 1.00 | 164.6 |
| outro | 168.2 | 4.00 | 6.65 | 1.00 | 172.2 |

## Checks on the final files

- Both versions 175.000 s; AAC 48 kHz, 192 kb/s; loudness-normalised to −16 LUFS (true-peak −1.5 dB).
- Subtitles: 43 cues, no overlaps (≥ 40 ms gaps), ≤ 2 lines of ≤ 42 characters.
- Hyperframes `check`: runtime, layout, contrast, motion all pass; lint 0 errors.

## Worth checking by watching

- Kokoro reads faster than 140 wpm, so most sections end with 2–9 s of music only (longest: chapters 2 and 4).
- Chapter 2's waits between photos are cut; the caption and side panel say so.
- The app's live-check text flickers to "Light is uneven" once in chapter 2: the stock clip's balance sits near the threshold. It's the real app behaviour, left in.
- The fake-camera clip is padded with a blurred copy of itself so the face fits the frame; its edges show in the camera preview.
