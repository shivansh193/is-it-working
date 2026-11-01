# Is it working?

**Test your skincare like a dermatologist would: one side of your face, same photo, real numbers, and an honest answer, including “not yet”.**

Built for the YouCam API Skin AI & eCommerce VTO Hackathon. Phone-first web app (Next.js + TypeScript) on the YouCam AI Skin Analysis API.

## The problem

You spent ₹2,500 on a serum. Four weeks in, you're at the mirror asking whether it's doing anything and whether to buy it again. The mirror is a bad instrument: lighting, sleep, mood and the money you've already spent all push the answer around. A skin-analysis score alone doesn't fix this either, because two selfies taken a minute apart don't score the same.

## What the app does differently

1. **Split-face trial.** You apply the product to one cheek only. Every photo then contains its own control: the other half of the same face, under the same light, on the same day. Lighting, sleep, diet and the camera hit both sides equally, so they cancel out. Published trials use the same design: Bissett et al. (Int J Cosmet Sci 2004) ran a 12-week split-face niacinamide trial, and Kafi et al. (Arch Dermatol 2007) tested retinol on one arm against vehicle on the other.
2. **Your measurement noise, measured.** The baseline is 3 photos about a minute apart (the app counts down 60 s between them), and every 3rd check-in takes 2. From these repeats we estimate how much *your* scores wobble per concern (pooled within-session SD, shrunk toward a prior until there's enough data). A change only counts if it beats that noise.
3. **Raw scores, not UI scores.** YouCam returns a `ui_score` adjusted to motivate users, and a `raw_score` that isn't. In our test calls the UI score squeezes the scale: a raw 46 showed as 66, a raw 87 as 84, a raw 100 as 99. That shrinks real differences, so every verdict uses `raw_score`.
4. **Time-to-effect.** Each product type has an earliest day an effect can plausibly show (e.g. niacinamide ~4 weeks, retinol ~8 weeks). Before that, the answer is “Too early to tell”, not “Not working”.
5. **“Not enough data” is a real answer.** The app never guesses.

## The verdict rule

Plain, deterministic code with unit tests (41) ([`src/lib/verdict.ts`](src/lib/verdict.ts)). No LLM decides anything.

Per target concern:

- **Noise σ**: pooled SD of same-session repeat shots, `σ² = (ν₀σ₀² + ΣSS) / (ν₀ + Σdf)`, with prior σ₀ = 3 points and ν₀ = 3 ([`noise.ts`](src/lib/noise.ts)). Below 2 repeat pairs, the prior alone is used.
- **Whole-face mode**: OLS trend of the raw score over sessions. Effect = slope × days, SE = SE(slope) × days.
- **Which design, per concern**: in a split-face trial each concern uses the split-face gap unless the user's own repeat shots show that gap is more than 2× noisier than the whole-face raw score; then that concern is judged on the whole-face trend and its card says why ([`measurementFor`](src/lib/analysis.ts)). On our validation run this keeps redness and texture split-face and moves pores to whole-face.
- **Split-face mode**: per check-in, `d_t = (treated − untreated) − d₀`, where d₀ is the baseline gap. Effect = mean of d_t, SE = max(sd(d_t), σ) / √n.
- **Working**: effect > max(2·SE, 2·σ), at least 4 check-ins, and day ≥ the category's earliest-effect day.
- **Getting worse**: the mirror image. It may fire from 3 check-ins and before the earliest-effect day, because stopping early is the safe side.
- Otherwise: **No effect beyond noise**, **Too early to tell** or **Not enough data**.

Every verdict carries its inputs (effect, SE, σ and its source, threshold, check-ins, days), and the UI shows them under “Why this verdict?”.

## How split-face scoring works

1. Each photo goes through MediaPipe Face Landmarker in the browser. That gives the face oval and a midline (forehead centre → nose bridge → nose tip → chin).
2. YouCam returns one mask PNG per concern (`enable_mask_overlay: false`), at exactly the size of the uploaded photo. The masks are drawn overlays: a grey (61,61,61) layer at fixed opacity over everything not detected, white outlines of the analysed area, and coloured detection pixels whose opacity carries intensity (redness tint, acne circles, pore and texture dots). We count only the coloured pixels.
3. For each side of the midline, inside the face oval, we take the detection density. We then put it on the raw-score scale: the whole-face deficit (100 − raw) is split between the sides in proportion to their densities, so the two sides average to YouCam's own raw score. Detections cover well under 1% of the face for pores and acne, so a plain coverage percentage would barely move.
4. **Validation (go/no-go)**: [`/validate`](src/app/validate/page.tsx) checks on 5+ untreated photos that the left − right gap is stable (SD ≤ 2σ√2). If the masks don't support this, split-face mode is dropped rather than faked. If a mask's aspect ratio doesn't match the photo, the side scores for that photo are skipped.
5. **Validated on real YouCam calls: see [Validation](#validation-real-youcam-calls) below.** Split-face is stable and sensitive for redness, and not usable for pores.

## YouCam API usage

Host `https://yce-api-01.makeupar.com`, Bearer key, server-side only ([`src/lib/youcam/client.ts`](src/lib/youcam/client.ts)).

| Step | Call | Route in this app |
|---|---|---|
| 1 | `POST /s2s/v2.0/file`: register the upload, get `file_id` and a pre-signed URL | `/api/upload` |
| 2 | `PUT` the JPEG to the pre-signed URL with the returned headers | `/api/upload` |
| 3 | `POST /s2s/v2.1/task/skin-analysis`: `dst_actions: ["hd_…"]`, `format: "json"`, `enable_mask_overlay: false` | `/api/analyze` |
| 4 | `GET /s2s/v2.1/task/skin-analysis/{task_id}`: poll until `success` or `error` | `/api/task/[id]` |
| — | Fetch mask PNGs through a same-origin proxy that only accepts HMAC-signed URLs | `/api/mask` |

- **HD concerns**: the trial's 1–3 targets, plus `hd_redness` and `hd_texture` as controls, capped at 4 per photo.
- **Units** (docs table, HD): 1–4 concerns = 12 units, 5–8 = 16. So one photo is 12 units, and 1,000 units is ~83 photos.
- **Speed:** 4.9–7.3 s per YouCam task (create → success); 7–10 s per photo end to end in the app, including upload and fetching masks.
- **Same photo, same score.** Sending an identical image twice returned identical scores to every decimal. YouCam adds no noise of its own; all scan-to-scan wobble comes from the capture (light, pose, camera). That's what the repeat-shot baseline measures.
- **Response shape** (real, not just docs): `hd_pore`, `hd_acne` and `hd_texture` come back once per region (`forehead`, `nose`, `cheek`, `whole`), in any order. We score on `whole` and keep the rest. There's also an `all` score, `skin_age` and a `resize_image` entry. See [`fixtures/docs/task-real-shape.json`](fixtures/docs/task-real-shape.json).
- **Capture rules enforced in the app**: short side ≥ 1080 px (upscaled with a note if the camera gives less), long side ≤ 2560, face width > 60% of the frame, a frontal pose, even left/right lighting, and holding still. YouCam error codes (`error_src_face_too_small`, `error_lighting_dark`, …) are turned into plain advice.

## Privacy

Trials, scores and small thumbnails live in IndexedDB on your device. There's no account. Each photo is sent to YouCam to be analysed and nowhere else. You can export or import everything as JSON.

## Validation (real YouCam calls)

Run 2026-11-02 with [`demo/positive_control.py`](demo/positive_control.py): the real app (production build, real YouCam HD analyses) driven through Chrome's fake camera with a licence-free stock face (Pexels 13770894). Nine photos: two untreated 3-shot baselines, then a third baseline with a **known soft red tint on one cheek** (peak 25% opacity), the side the trial marks as treated. This tests the measurement, not a skincare product.

| | Redness | Pores |
|---|---|---|
| Treated − untreated gap, 6 untreated shots | 9.5, 11.1, 9.8, 7.6, 9.8, 7.3 | −7.4, 25.5, −4.1, −1.1, 17.0, 1.5 |
| Spread of that gap (SD, 6 shots) | **±1.4** | **±13.0** |
| `/validate` stability bar (2·σ·√2, σ = whole-face raw SD) | 6.1 → **pass** | 5.7 → **fail** |
| Gap with the red tint (3 shots) | −7.9, −8.7, −7.6 | 8.3, 6.6, 3.7 |
| Shift caused by the tint | **−17.2 points (≈ 22× its standard error)** | +0.9 (no change, as expected) |

- **Positive control:** split-face sees a one-sided redness change of this size clearly, on the right side and in the right direction (the treated side's score drops), far outside the noise bar.
- **Negative control:** the same tint doesn't move pores, so the side score isn't just reacting to any change in the image.
- **Pores aren't usable for split-face yet:** their gap jumps by ±13 between shots of the same face. The per-concern noise bar stops false "working" calls on them, and the video and write-up say so.
- Two earlier 3-shot baselines of the same clip, recorded for the demo video, gave redness ±1.6 and ±2.4, and pores ±20.5 and ±9.3.
- Limits: this is one stock face through a fake camera, with a digital tint, not a real person in bathroom light over several weeks.

## Demo data, honestly

A real 6-week trial wasn't possible before the deadline. `/demo` replays a **simulated** trial, labelled “Simulated data” on screen. It starts from a baseline ([`DEMO_BASELINE`](src/lib/demo.ts), to be replaced with real baseline scans) and adds a documented synthetic drift: treated-side redness improves 0.22 points/day from day 10, capped at +7. Texture doesn't change. Per-shot noise is σ = 2.2 (raw) and 1.3 (each side). The replay walks through “Too early” → “No effect beyond noise” → “Working” for redness, while texture stays “No effect”.

Live, real parts: guided baseline capture, noise estimates from real repeat shots, and split-face side scores from real masks.

## Limitations

- Phone cameras, light and angle still add noise. Split-face cancels most of it, not all.
- With few check-ins the error bars are wide, which is why “not enough data” comes up often early on.
- The noise prior (σ₀ = 3) is a placeholder until it's calibrated on real repeat scans.
- Trial lengths for niacinamide, vitamin C and retinol are checked against the published abstracts; the other product types are not yet. The “judge from” day for each type is our own conservative cut-off, not a number from the papers ([`categories.ts`](src/lib/categories.ts)).
- This is not medical advice. See a dermatologist for skin conditions.

## Run it

```bash
npm install
cp .env.example .env.local   # add YOUCAM_API_KEY
npm run dev
npm test
```

With no key set, the app runs in **mock mode**: made-up scores, no masks, no units spent. Every mock result is flagged. Set `SAVE_FIXTURES=1` to save real task responses to `fixtures/real/` (git-ignored).

## Next steps

- A dermatologist share view (today there's a summary image with the numbers and no face; a live view for a dermatologist is next)
- Brand-side efficacy panels (aggregate split-face results, opt-in)

## Licence

MIT
