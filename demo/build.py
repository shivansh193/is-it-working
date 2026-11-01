"""
Builds the Hyperframes composition for the "Is it working?" demo video from marks.json.

  python build.py --clips <dir with chN_*.mp4 + marks.json> --out composition

Writes composition/index.html plus assets/ (clips copied; fonts and gsap are expected in assets/ already,
downloaded by the Kaggle kernel). Every cut and caption time is derived from marks.json; asserts check that
the plan sums to TARGET, sections don't overlap, and every trim stays inside its clip.
"""

import argparse
import html
import json
import shutil
from pathlib import Path

TARGET = 175.0  # 2:55, five seconds under the 3:00 limit
W, H = 1920, 1080

# Phone layout: recordings are 780x1688 (a 390x844 phone at 2x).
SCREEN_H = 860
SCREEN_W = round(780 * SCREEN_H / 1688)  # 397
BEZEL = 14
PH_X, PH_Y = 330, 40  # bezel top-left
SCR_X, SCR_Y = PH_X + BEZEL, PH_Y + BEZEL
CAP_Y, CAP_H = 958, 84

e = html.escape


def mark(marks: dict, ch: str, label: str) -> float:
    for m in marks[ch]["marks"]:
        if m["label"] == label:
            return m["t"]
    raise KeyError(f"{ch}: no mark {label!r}")


def build_plan(marks: dict) -> list[dict]:
    """The storyboard as data. Chapter segments are (media_start, media_end) trims of one clip."""
    m = lambda ch, label: mark(marks, ch, label)

    plan = [
        {"kind": "hook", "dur": 4.0},
        {"kind": "title", "dur": 4.0},
        {"kind": "slide", "id": "glance", "dur": 12.0},
        {"kind": "card", "n": 1, "title": "Start a trial", "dur": 1.5},
        {
            "kind": "chapter", "id": "ch1", "clip": "ch1_setup", "n": 1, "title": "Start a trial",
            "segs": [(1.5, 20.0)],
            "caps": [
                (0.0, "Start a trial in under a minute."),
                ("@5.5", "Name the product you're testing."),
                ("@" + str(m("ch1_setup", "time-to-effect note visible")), "Niacinamide: we won't judge before day 28."),
                ("@" + str(m("ch1_setup", "split-face visible")), "Split-face: the product goes on one cheek only."),
            ],
            "facts": [
                ("Time to effect", "Niacinamide is judged from day 28"),
                ("Design", "One cheek treated, the other is the control"),
                ("Storage", "Saved on the phone. No account."),
            ],
        },
        {"kind": "card", "n": 2, "title": "Guided baseline", "dur": 1.5},
        {
            "kind": "chapter", "id": "ch2", "clip": "ch2_capture", "n": 2, "title": "Guided baseline",
            # Cuts remove most of each ~9 s analysis wait (said in a caption and the side panel).
            "segs": [
                (2.3, 11.3),  # camera on, live checks, shot 1, analysing
                (13.0, 17.2),  # shot 1 analysed, first scores
                (19.0, 23.8),  # wait skipped, shot 2 taken
                (36.5, 39.5),  # shot 3 taken
                (42.3, 49.8),  # results page, noise summary
            ],
            "caps": [
                (0.0, "Stock video through Chrome's fake camera."),
                (4.5, "Live checks: face size, angle, light, stillness."),
                (9.0, "Each photo goes to YouCam: about 9 s, masks included."),
                (13.2, "Shots two and three. Waits cut for the video."),
                (17.2, "Same face, minutes apart, slightly different scores."),
                ("@" + str(m("ch2_capture", "shot 3 analysed, results page")), "Redness varies ±2.4. Pores ±9.3: too noisy to trust."),
            ],
            "facts": [
                ("Camera", "Pexels stock video via Chrome's fake camera"),
                ("API", "3 real YouCam HD analyses, 12 units each"),
                ("Noise", "Spread of 3 same-session shots, per concern"),
                ("Edit", "Waits between shots shortened"),
            ],
        },
        {"kind": "slide", "id": "youcam", "dur": 12.0},
        {"kind": "card", "n": 3, "title": "Split-face", "dur": 1.5},
        {
            "kind": "chapter", "id": "ch3", "clip": "ch3_split", "n": 3, "title": "Split-face",
            "segs": [(0.5, 15.0)],
            "caps": [
                (0.0, "Face Mesh finds the midline of the face."),
                (4.2, "YouCam's mask shows where the redness is."),
                ("@" + str(m("ch3_split", "side score table") - 0.5), "Each side gets its own score, from the same photo."),
                (11.6, "Pores pile up on one side and jump between shots."),
            ],
            "facts": [
                ("Midline", "MediaPipe Face Mesh, in the browser"),
                ("Masks", "YouCam PNG per concern, same size as the photo"),
                ("Side score", "Detections per side, on the raw-score scale"),
            ],
        },
        {"kind": "slide", "id": "design", "dur": 12.0},
        {"kind": "card", "n": 4, "title": "The verdict (simulated)", "dur": 1.5},
        {
            "kind": "chapter", "id": "ch4", "clip": "ch4_demo", "n": 4, "title": "The verdict",
            "segs": [(0.8, 29.8)],
            "caps": [
                (0.0, "A simulated 6-week trial, labelled on screen."),
                ("@" + str(m("ch4_demo", "day 12 too early")), "Day 12: too early to tell."),
                ("@" + str(m("ch4_demo", "day 28")), "Day 28: the change is inside the noise band."),
                ("@" + str(m("ch4_demo", "day 44 working")), "Day 44: redness beats the bar. Texture doesn't."),
                ("@" + str(m("ch4_demo", "why opened")), "Every verdict shows its numbers and its rule."),
                ("@" + str(m("ch4_demo", "rebuy card")), "Should I rebuy? A plain answer, with the cost so far."),
            ],
            "facts": [
                ("Data", "Simulated: placeholder baseline + documented drift"),
                ("Rule", "Change > 2×SE and > 2×noise, 4+ check-ins, day 28+"),
                ("Safety", "'Getting worse' can fire early"),
            ],
        },
        {"kind": "slide", "id": "results", "dur": 15.5},
        {"kind": "slide", "id": "who", "dur": 12.0},
        {"kind": "outro", "dur": 7.0},
    ]

    t = 0.0
    for p in plan:
        if p["kind"] == "chapter":
            dur = 0.0
            clipdur = marks[p["clip"]]["duration"]
            for a, b in p["segs"]:
                assert 0 <= a < b <= clipdur + 1e-6, f"{p['id']}: trim {a}-{b} outside clip (0-{clipdur})"
                dur += b - a
            p["dur"] = round(dur, 3)
            # Resolve "@<media time>" captions to chapter-local time (single-segment chapters only).
            caps = []
            for when, text in p["caps"]:
                if isinstance(when, str):  # "@<media time>": map into the segment that contains it
                    mt, acc = float(when[1:]), 0.0
                    for a, b in p["segs"]:
                        if a <= mt < b:
                            when = acc + mt - a
                            break
                        acc += b - a
                    else:
                        raise AssertionError(f"{p['id']}: caption at media {mt} falls in a cut")
                caps.append((round(when, 2), text))
            for i, (w0, _) in enumerate(caps):
                w1 = caps[i + 1][0] if i + 1 < len(caps) else p["dur"]
                assert 0 <= w0 < w1, f"{p['id']}: captions out of order at {w0}"
                assert 2.5 <= w1 - w0 <= 8.5, f"{p['id']}: caption {i} lasts {w1 - w0:.2f}s"
            p["caps"] = caps
        p["start"] = round(t, 3)
        t += p["dur"]
    assert abs(t - TARGET) < 0.01, f"plan is {t:.2f}s, target {TARGET}s"
    for a, b in zip(plan, plan[1:]):
        assert abs(a["start"] + a["dur"] - b["start"]) < 1e-6, "sections overlap or leave a gap"
    return plan


# ── Slide content (every number from the repo or a real run; see demo/STORYBOARD.md) ──────────────────
SLIDES = {
    "glance": {
        "label": "At a glance",
        "title": "Four parts, one honest answer",
        "cols": 2,
        "cards": [
            ("Phone browser", "Camera with live checks · MediaPipe Face Mesh · trials saved on the device"),
            ("Next.js on Vercel", "Route handlers hold the YouCam key · access code · signed mask proxy"),
            ("YouCam Skin Analysis HD", "Upload → task → poll · raw score and mask for each concern"),
            ("Verdict engine", "Plain TypeScript rule · your measured noise · 38 unit tests"),
        ],
    },
    "youcam": {
        "label": "How YouCam is used",
        "title": "Upload, analyse, read the masks",
        "cols": 3,
        "cards": [
            ("1 · POST /s2s/v2.0/file", "Returns a file_id and a pre-signed URL; the JPEG is PUT there"),
            ("2 · POST /s2s/v2.1/task/skin-analysis", "Up to 4 HD concerns (hd_redness, hd_pore, hd_texture…) = 12 units"),
            ("3 · GET …/task/{id}", "Polled until success: 4.9–7.3 s per task in our runs"),
            ("raw_score, not ui_score", "In our runs the UI score read 66 for a raw 46: it squeezes differences"),
            ("Per-concern masks", "Same size as the photo, so they split at the Face Mesh midline"),
            ("Per-region scores", "Pores, acne, texture also return forehead, nose and cheek"),
        ],
    },
    "design": {
        "label": "Design decisions",
        "title": "Why you can trust the answer",
        "cols": 2,
        "cards": [
            ("Same photo, two sides", "Light, sleep and the camera hit both cheeks equally, so they cancel out"),
            ("Your own noise", "'Working' needs a change bigger than 2× its error and 2× your scan noise"),
            ("Too early is an answer", "Niacinamide is judged from day 28; Bissett 2004 ran a 12-week split-face trial"),
            ("Same image, same score", "YouCam scored one photo twice identically: all noise comes from the capture"),
        ],
    },
    "results": {
        "label": "Results",
        "title": "What we measured, and what's weak",
        "cols": 2,
        "compact": True,
        "cards": [
            ("Measured · real runs", "11 real YouCam HD tasks; same photo twice → identical scores"),
            ("Measured · speed", "4.9–7.3 s per task; 7–10 s per photo end to end, masks included"),
            ("Measured · noise (2 baselines)", "Redness ±1.6 and ±2.4 · pores ±20.5 and ±9.3"),
            ("Measured · tests", "38 unit tests on the rule, noise, split maths and parser"),
            ("Weak · pores", "Too noisy for split-face so far. The noise bar stops false calls."),
            ("Weak · no real trial yet", "The verdict demo is simulated, and clears its bar by 0.1 (4.6 vs 4.5)"),
            ("Weak · placeholders", "Noise prior σ = 3 is a guess; 7 of 10 timing references unchecked"),
            ("Weak · footage", "Baselines used stock video through a fake camera, not a real user"),
        ],
    },
    "who": {
        "label": "Who it helps",
        "title": "Before you rebuy",
        "cols": 3,
        "cards": [
            ("Mid-bottle", "Someone 4 weeks into a ₹2,500 serum, deciding whether to buy it again"),
            ("At the dermatologist", "A summary image with the numbers and no face"),
            ("Next", "A dermatologist view; brand efficacy panels from opt-in split-face data"),
        ],
    },
}


CSS = f"""
@font-face {{ font-family: 'Geist'; src: url('assets/fonts/Geist-Regular.woff2') format('woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Geist'; src: url('assets/fonts/Geist-Medium.woff2') format('woff2'); font-weight: 500; }}
@font-face {{ font-family: 'Geist'; src: url('assets/fonts/Geist-SemiBold.woff2') format('woff2'); font-weight: 600; }}
@font-face {{ font-family: 'Geist Mono'; src: url('assets/fonts/GeistMono-Regular.woff2') format('woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Geist Mono'; src: url('assets/fonts/GeistMono-Medium.woff2') format('woff2'); font-weight: 500; }}
:root {{ --bg:#f6f2ec; --card:#fffdf9; --ink:#1d2a2e; --muted:#5d6a6e; --line:#e3dcd1; --accent:#2c6b64; }}
html, body {{ margin:0; background:var(--bg); }}
#root {{ position:relative; width:{W}px; height:{H}px; overflow:hidden; background:var(--bg); font-family:'Geist', sans-serif; color:var(--ink); }}
.bg {{ position:absolute; inset:0; background:var(--bg); }}
.full {{ position:absolute; left:0; top:0; width:{W}px; height:{H}px; }}
.mono {{ font-family:'Geist Mono', monospace; }}
.label {{ font-family:'Geist Mono', monospace; font-size:28px; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent); font-weight:500; }}
.center {{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }}
.hook-a {{ font-size:84px; font-weight:600; letter-spacing:-0.02em; }}
.hook-b {{ font-size:84px; font-weight:600; letter-spacing:-0.02em; color:var(--accent); margin-top:18px; }}
.title-main {{ font-size:120px; font-weight:600; letter-spacing:-0.03em; }}
.title-sub {{ font-size:40px; color:var(--muted); margin-top:20px; }}
.card-n {{ font-family:'Geist Mono', monospace; font-size:28px; color:var(--accent); letter-spacing:0.12em; }}
.card-t {{ font-size:96px; font-weight:600; letter-spacing:-0.02em; margin-top:12px; }}
.slide {{ padding:60px 140px 70px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; }}
.slide h2 {{ font-size:64px; font-weight:600; letter-spacing:-0.02em; margin:14px 0 48px; }}
.grid {{ display:grid; gap:24px; }}
.box {{ background:var(--card); border:1px solid var(--line); border-radius:22px; padding:28px 30px; }}
.box .k {{ font-family:'Geist Mono', monospace; font-size:28px; color:var(--accent); font-weight:500; letter-spacing:0.02em; }}
.box .v {{ font-size:32px; line-height:1.3; margin-top:12px; }}
.box.weak .k {{ color:var(--ink); }}
.compact .grid {{ gap:16px; }}
.compact .box {{ padding:18px 26px; }}
.compact .box .v {{ font-size:29px; margin-top:8px; }}
.compact h2 {{ margin-bottom:30px; }}
.bezel {{ position:absolute; left:{PH_X}px; top:{PH_Y}px; width:{SCREEN_W + 2 * BEZEL}px; height:{SCREEN_H + 2 * BEZEL}px; border-radius:58px; background:#1d2a2e; box-shadow:0 30px 70px rgba(29,42,46,0.22); }}
.screen {{ position:absolute; left:{SCR_X}px; top:{SCR_Y}px; width:{SCREEN_W}px; height:{SCREEN_H}px; border-radius:44px; object-fit:cover; background:#fff; }}
.panel {{ position:absolute; left:880px; top:120px; width:880px; }}
.panel .chap {{ font-size:72px; font-weight:600; letter-spacing:-0.02em; margin:12px 0 40px; }}
.fact {{ border-top:1px solid var(--line); padding:22px 0; }}
.fact .k {{ font-family:'Geist Mono', monospace; font-size:28px; color:var(--accent); text-transform:uppercase; letter-spacing:0.1em; }}
.fact .v {{ font-size:32px; margin-top:8px; line-height:1.3; }}
.caps {{ position:absolute; left:0; top:{CAP_Y}px; width:{W}px; height:{CAP_H}px; }}
.cap {{ position:absolute; left:160px; top:0; width:{W - 320}px; height:{CAP_H}px; display:flex; align-items:center; justify-content:center; }}
.cap span {{ display:inline-block; font-size:40px; font-weight:500; background:var(--card); border:1px solid var(--line); border-radius:999px; padding:12px 34px; }}
.outro-l {{ font-size:34px; color:var(--muted); margin-top:16px; }}
.outro-u {{ font-family:'Geist Mono', monospace; font-size:36px; color:var(--accent); margin-top:26px; }}
"""


def build_html(plan: list[dict], marks: dict) -> str:
    els: list[str] = []  # timed elements
    tl: list[str] = []  # GSAP lines
    z = 1
    caps_html: list[str] = []

    def fade(sel: str, start: float, dur: float, inn: float = 0.35, out: float = 0.3):
        tl.append(f'tl.fromTo("{sel}", {{opacity:0}}, {{opacity:1, duration:{inn}, ease:"power2.out"}}, {start:.3f});')
        tl.append(f'tl.to("{sel}", {{opacity:0, duration:{out}, ease:"power2.in"}}, {start + dur - out - 0.02:.3f});')

    def stagger(sel: str, start: float, each: float = 0.14):
        tl.append(f'tl.fromTo("{sel}", {{opacity:0, y:24}}, {{opacity:1, y:0, duration:0.5, stagger:{each:.3f}, ease:"power3.out"}}, {start:.3f});')

    for p in plan:
        s, d = p["start"], p["dur"]
        k = p["kind"]
        if k == "hook":
            els.append(f'<div id="hook" class="clip full center" data-start="{s}" data-duration="{d}" data-track-index="2" style="z-index:{z}"><div id="hook-in"><div class="hook-a" id="hook-a">₹2,500 serum. Four weeks in.</div><div class="hook-b" id="hook-b">Is it doing anything?</div></div></div>')
            tl.append(f'tl.fromTo("#hook-a", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.5, ease:"power3.out"}}, {s + 0.2:.3f});')
            tl.append(f'tl.fromTo("#hook-b", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.5, ease:"power3.out"}}, {s + 1.6:.3f});')
            tl.append(f'tl.to("#hook-in", {{opacity:0, duration:0.3}}, {s + d - 0.32:.3f});')
        elif k == "title":
            els.append(f'<div id="title" class="clip full center" data-start="{s}" data-duration="{d}" data-track-index="2" style="z-index:{z}"><div id="title-in" data-hold="true"><div class="label">YouCam Skin Analysis API · split-face trials</div><div class="title-main" style="margin-top:22px">Is it working?</div><div class="title-sub">Test your skincare like a dermatologist would.</div></div></div>')
            fade("#title-in", s, d)
        elif k == "card":
            cid = f"card{p['n']}"
            els.append(f'<div id="{cid}" class="clip full center" data-start="{s}" data-duration="{d}" data-track-index="2" style="z-index:{z}"><div id="{cid}-in"><div class="card-n">CHAPTER {p["n"]}</div><div class="card-t">{e(p["title"])}</div></div></div>')
            fade(f"#{cid}-in", s, d, 0.25, 0.2)
        elif k == "slide":
            sd = SLIDES[p["id"]]
            sid = f"s-{p['id']}"
            boxes = "".join(
                f'<div class="box{" weak" if kk.startswith("Weak") else ""}"><div class="k">{e(kk)}</div><div class="v">{e(vv)}</div></div>' for kk, vv in sd["cards"]
            )
            els.append(
                f'<div id="{sid}" class="clip full slide{" compact" if sd.get("compact") else ""}" data-start="{s}" data-duration="{d}" data-track-index="2" style="z-index:{z}"><div id="{sid}-in">'
                f'<div class="label">{e(sd["label"])}</div><h2>{e(sd["title"])}</h2>'
                f'<div class="grid" style="grid-template-columns:repeat({sd["cols"]}, 1fr)">{boxes}</div></div></div>'
            )
            tl.append(f'tl.fromTo("#{sid}-in .label, #{sid}-in h2", {{opacity:0, y:16}}, {{opacity:1, y:0, duration:0.45, stagger:0.1, ease:"power3.out"}}, {s + 0.1:.3f});')
            # Reveal cards across ~55% of the slide so something changes every 1–2 s, roughly with the narration.
            stagger(f"#{sid}-in .box", s + 0.6, max(0.14, d * 0.55 / len(sd['cards'])))
            tl.append(f'tl.to("#{sid}-in", {{opacity:0, duration:0.3}}, {s + d - 0.32:.3f});')
        elif k == "chapter":
            cid = p["id"]
            els.append(f'<div id="{cid}-bezel" class="clip bezel" data-start="{s}" data-duration="{d}" data-track-index="3" style="z-index:{z}"></div>')
            z += 1
            t = s
            for i, (a, b) in enumerate(p["segs"]):
                vid = f"{cid}-v{i}"
                els.append(
                    f'<video id="{vid}" class="clip screen" src="assets/{marks[p["clip"]]["mp4"]}" muted playsinline '
                    f'data-start="{t:.3f}" data-duration="{b - a:.3f}" data-media-start="{a:.3f}" data-track-index="4" style="z-index:{z}"></video>'
                )
                t += b - a
            z += 1
            facts = "".join(f'<div class="fact"><div class="k">{e(fk)}</div><div class="v">{e(fv)}</div></div>' for fk, fv in p["facts"])
            els.append(
                f'<div id="{cid}-panel" class="clip panel" data-start="{s}" data-duration="{d}" data-track-index="5" style="z-index:{z}"><div id="{cid}-panel-in">'
                f'<div class="label">Chapter {p["n"]}</div><div class="chap">{e(p["title"])}</div>{facts}</div></div>'
            )
            tl.append(f'tl.fromTo("#{cid}-panel-in .label, #{cid}-panel-in .chap", {{opacity:0, y:14}}, {{opacity:1, y:0, duration:0.4, stagger:0.08}}, {s + 0.1:.3f});')
            stagger(f"#{cid}-panel-in .fact", s + 0.4, max(0.14, d * 0.4 / len(p['facts'])))
            tl.append(f'tl.to("#{cid}-panel-in", {{opacity:0, duration:0.25}}, {s + d - 0.27:.3f});')
            for i, (w0, text) in enumerate(p["caps"]):
                w1 = p["caps"][i + 1][0] if i + 1 < len(p["caps"]) else d
                capid = f"{cid}-c{i}"
                caps_html.append(f'<div id="{capid}" class="clip cap" data-start="{s + w0:.3f}" data-duration="{w1 - w0:.3f}"><span id="{capid}-t">{e(text)}</span></div>')
                fade(f"#{capid}-t", s + w0, w1 - w0, 0.25, 0.18)
        elif k == "outro":
            els.append(
                f'<div id="outro" class="clip full center" data-start="{s}" data-duration="{d}" data-track-index="2" style="z-index:{z}"><div id="outro-in" data-hold="true">'
                f'<div class="title-main" style="font-size:96px">Is it working?</div>'
                f'<div class="outro-u">is-it-working-zeta.vercel.app</div>'
                f'<div class="outro-u" style="margin-top:10px">github.com/shivansh193/is-it-working</div>'
                f'<div class="outro-l" style="margin-top:44px">Built with the YouCam Skin Analysis API · MediaPipe · Next.js</div>'
                f'<div class="outro-l">Stock footage: Pexels 13770894 · Not medical advice</div></div></div>'
            )
            fade("#outro-in", s, d, 0.4, 0.5)
        z += 1

    total = plan[-1]["start"] + plan[-1]["dur"]
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>{CSS}</style>
<script src="assets/gsap.min.js"></script>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total:.3f}" data-width="{W}" data-height="{H}" data-fps="30">
<div class="bg"></div>
{chr(10).join(els)}
<div id="captions" class="clip caps" data-start="0" data-duration="{total:.3f}" data-track-kind="captions" data-track-index="9" style="z-index:{z + 1}">
{chr(10).join(caps_html)}
</div>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tl)}
window.__timelines["main"] = tl;
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", required=True)
    ap.add_argument("--out", default="composition")
    a = ap.parse_args()
    clips, out = Path(a.clips), Path(a.out)
    marks = json.loads((clips / "marks.json").read_text())
    plan = build_plan(marks)
    (out / "assets").mkdir(parents=True, exist_ok=True)
    for k, v in marks.items():
        if isinstance(v, dict):
            shutil.copy(clips / v["mp4"], out / "assets" / v["mp4"])
    (out / "index.html").write_text(build_html(plan, marks), encoding="utf-8")
    (out / "plan.json").write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
    for p in plan:
        print(f'{p["start"]:7.2f}  {p["dur"]:5.2f}  {p["kind"]:8s} {p.get("id", p.get("title", ""))}')
    print(f"total {plan[-1]['start'] + plan[-1]['dur']:.2f}s (target {TARGET}s)")


if __name__ == "__main__":
    main()
