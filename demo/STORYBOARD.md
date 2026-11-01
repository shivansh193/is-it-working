# Demo video storyboard (2:55)

Generated from `demo/build.py` (the same plan the video is built from). Times are exact; captions come from `marks.json`.

Hackathon video rules (official Rules page, checked 2026-11-01): 1–3 min, explains the YouCam API used, shows the project working on its device, public on YouTube or Vimeo, no copyrighted music or third-party trademarks.

**Footage:** all four chapters are scripted Playwright recordings of the real app (local production build, real YouCam key) at a 390×844 phone layout rendered 2× for sharpness. The camera is Chrome's fake device playing a licence-free Pexels clip (13770894), cropped and padded so the face fills ~75% of the frame. Chapter 2 runs 3 real YouCam HD analyses; the waits between shots are shortened in the edit, and a caption and the side panel say so.

| Time | On screen | Caption / slide text |
|---|---|---|
| 0:00.0–0:04.0 | Hook | ₹2,500 serum. Four weeks in. / Is it doing anything? |
| 0:04.0–0:08.0 | Title | Is it working? · Test your skincare like a dermatologist would. |
| 0:08.0–0:20.0 | Slide: At a glance — Four parts, one honest answer | **Phone browser**: Camera with live checks · MediaPipe Face Mesh · trials saved on the device · **Next.js on Vercel**: Route handlers hold the YouCam key · access code · signed mask proxy · **YouCam Skin Analysis HD**: Upload → task → poll · raw score and mask for each concern · **Verdict engine**: Plain TypeScript rule · your measured noise · 38 unit tests |
| 0:20.0–0:21.5 | Chapter card 1 | Start a trial |
| 0:21.5–0:40.0 | Recording: ch1_setup (1.5–20s) in phone bezel; side panel: Time to effect: Niacinamide is judged from day 28; Design: One cheek treated, the other is the control; Storage: Saved on the phone. No account. | [0:21.5] Start a trial in under a minute. · [0:25.5] Name the product you're testing. · [0:29.8] Niacinamide: we won't judge before day 28. · [0:34.9] Split-face: the product goes on one cheek only. |
| 0:40.0–0:41.5 | Chapter card 2 | Guided baseline |
| 0:41.5–1:10.0 | Recording: ch2_capture (2.3–11.3s + 13–17.2s + 19–23.8s + 36.5–39.5s + 42.3–49.8s) in phone bezel; side panel: Camera: Pexels stock video via Chrome's fake camera; API: 3 real YouCam HD analyses, 12 units each; Noise: Spread of 3 same-session shots, per concern; Edit: Waits between shots shortened | [0:41.5] Stock video through Chrome's fake camera. · [0:46.0] Live checks: face size, angle, light, stillness. · [0:50.5] Each photo goes to YouCam: about 9 s, masks included. · [0:54.7] Shots two and three. Waits cut for the video. · [0:58.7] Same face, minutes apart, slightly different scores. · [1:05.4] Redness varies ±2.4. Pores ±9.3: too noisy to trust. |
| 1:10.0–1:22.0 | Slide: How YouCam is used — Upload, analyse, read the masks | **1 · POST /s2s/v2.0/file**: Returns a file_id and a pre-signed URL; the JPEG is PUT there · **2 · POST /s2s/v2.1/task/skin-analysis**: Up to 4 HD concerns (hd_redness, hd_pore, hd_texture…) = 12 units · **3 · GET …/task/{id}**: Polled until success: 4.9–7.3 s per task in our runs · **raw_score, not ui_score**: In our runs the UI score read 66 for a raw 46: it squeezes differences · **Per-concern masks**: Same size as the photo, so they split at the Face Mesh midline · **Per-region scores**: Pores, acne, texture also return forehead, nose and cheek |
| 1:22.0–1:23.5 | Chapter card 3 | Split-face |
| 1:23.5–1:38.0 | Recording: ch3_split (0.5–15s) in phone bezel; side panel: Midline: MediaPipe Face Mesh, in the browser; Masks: YouCam PNG per concern, same size as the photo; Side score: Detections per side, on the raw-score scale | [1:23.5] Face Mesh finds the midline of the face. · [1:27.7] YouCam's mask shows where the redness is. · [1:31.3] Each side gets its own score, from the same photo. · [1:35.1] Pores pile up on one side and jump between shots. |
| 1:38.0–1:47.0 | Slide: Design decisions — Why you can trust the answer | **Same photo, two sides**: Light, sleep and the camera hit both cheeks equally, so they cancel out · **Your own noise**: 'Working' needs a change bigger than 2× its error and 2× your scan noise · **Too early is an answer**: Niacinamide is judged from day 28; Bissett 2004 ran a 12-week split-face trial · **Same image, same score**: YouCam scored one photo twice identically: all noise comes from the capture |
| 1:47.0–2:01.0 | Slide: Positive control · real YouCam calls — Does it actually detect a change? | **6 untreated shots**: Redness gap between the cheeks varied only ±1.4 points · **Known red tint on one cheek**: The gap moved 17.2 points, on the right side: ≈22× its error · **Negative control**: The same tint didn't move pores (+0.9) · **Pores**: Their gap jumped ±13, so they're judged on the whole-face trend · **Caveat**: One stock face, fake camera, digital tint: it tests the measurement, not a product |
| 2:01.0–2:02.5 | Chapter card 4 | The verdict (simulated) |
| 2:02.5–2:28.3 | Recording: ch4_demo (0.8–26.6s) in phone bezel; side panel: Data: Simulated: placeholder baseline + documented drift; Rule: Change > 2×SE and > 2×noise, 4+ check-ins, day 28+; Safety: 'Getting worse' can fire early | [2:02.5] A simulated 6-week trial, labelled on screen. · [2:06.1] Day 12: too early to tell. · [2:10.0] Day 28: the change is inside the noise band. · [2:15.1] Day 44: redness beats the bar. Texture doesn't. · [2:20.1] Every verdict shows its numbers and its rule. |
| 2:28.3–2:41.3 | Slide: Results — What we measured, and what's weak | **Measured · real runs**: 23 real YouCam HD tasks; same photo twice → identical scores · **Measured · speed**: 4.9–7.3 s per task; 7–10 s per photo end to end, masks included · **Measured · split-face**: Redness: stable (±1.4) and sensitive (tint → 17.2 points). Pores: not. · **Measured · tests**: 41 unit tests on the rule, design choice, noise, split maths, parser · **Weak · no real trial yet**: The verdict demo is simulated, and clears its bar by 0.1 (4.6 vs 4.5) · **Weak · one face**: Validation used one stock face and a fake camera; the noise prior σ = 3 is a guess |
| 2:41.3–2:49.3 | Slide: Who it helps — Before you rebuy | **Mid-bottle**: Someone 4 weeks into a ₹2,500 serum, deciding whether to reorder it · **At the dermatologist**: A summary image with the numbers and no face · **Next**: A dermatologist view; brand efficacy panels from opt-in split-face data |
| 2:49.3–2:55.0 | Outro | Live URL · repo · Built with YouCam Skin Analysis API, MediaPipe, Next.js · Stock footage: Pexels 13770894 · Not medical advice |

## Numbers used and where they come from

| Number | Source |
|---|---|
| 23 real YouCam HD tasks | 4 probe calls + 1 in-app probe + 2 recording takes × 3 + positive-control runs 3 + 9 (2026-10-30 → 11-02) |
| Redness gap ±1.4, tint shift 17.2 (≈22× SE), pores ±13.0 / +0.9 | `demo/positive_control.py` → `demo/out/positive_control.json` |
| 4.9–7.3 s per task | `scripts/probe-youcam.mjs` runs |
| 7–10 s per photo end to end | `marks.json`: shot taken → shot analysed |
| Same photo twice → identical scores | probe: face2 run 1 vs run 3 |
| Redness ±1.6 / ±2.4, pores ±20.5 / ±9.3 | baseline noise summary in the two recording takes |
| UI 66 for raw 46 | probe: face1 `hd_texture` |
| 12 units per photo (≤4 HD concerns) | YouCam docs unit table (`src/lib/budget.ts`) |
| 41 unit tests | `npm test` |
| Demo verdict 4.6 vs 4.5 | simulated demo at day 44 (`src/lib/__tests__/demo.test.ts`) |
| 7 of 10 timing references unchecked | `src/lib/categories.ts` (`verified: false`) |
