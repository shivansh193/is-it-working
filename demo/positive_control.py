"""
Digital positive control for split-face, run through the real app and the real YouCam API.

Two untreated 3-shot baselines of a stock face (Pexels 13770894) give the scan-to-scan noise and the
split-face stability (/validate's test on 6 shots). A third baseline of the same clip with a known soft red
tint on the image-right cheek (peak 25% opacity) checks that the treated − untreated redness gap moves by
more than the noise. It is a test of the measurement, not of a skincare product.

Usage: python demo/positive_control.py --base http://localhost:3124 --out demo/out/positive_control.json
Spends units: 9 photos × 12 = 108.
"""

import argparse
import asyncio
import json
import statistics as st
import time
from pathlib import Path

from playwright.async_api import async_playwright

RUNS = [
    ("control_a", "fixtures/real/video/face.y4m"),
    ("control_b", "fixtures/real/video/face.y4m"),
    ("tinted", "fixtures/real/video/face_tinted.y4m"),
]
TRIAL = {
    "name": "Positive control",
    "category": "niacinamide",
    "concerns": ["redness", "pore"],
    "mode": "split",
    "treatedSide": "image-right",
}

SEED = """async (t) => { await new Promise((res, rej) => { const r = indexedDB.open('is-it-working', 1);
  r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('trials', {keyPath: 'id'});
    db.createObjectStore('sessions', {keyPath: 'id'}).createIndex('trialId', 'trialId'); };
  r.onsuccess = () => { const tx = r.result.transaction('trials', 'readwrite'); tx.objectStore('trials').put(t); tx.oncomplete = res; };
  r.onerror = rej; }); }"""
READ = """async (id) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('is-it-working', 1); r.onsuccess = () => res(r.result); r.onerror = rej; });
  const all = await new Promise(res => { const q = db.transaction('sessions').objectStore('sessions').getAll(); q.onsuccess = () => res(q.result); });
  return all.filter(s => s.trialId === id).flatMap(s => s.shots.map(x => ({raw: x.raw, sides: x.sides || null, mock: !!x.mock})));
}"""


async def run_one(p, base: str, name: str, cam: str) -> list[dict]:
    b = await p.chromium.launch(
        headless=True,
        args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={Path(cam).resolve()}"],
    )
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, permissions=["camera"])
    pg = await ctx.new_page()
    tid = f"pc-{name}-{int(time.time())}"
    await pg.goto(base + "/new", wait_until="networkidle")
    await pg.evaluate(SEED, {**TRIAL, "id": tid, "startDate": time.strftime("%Y-%m-%d"), "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S")})
    await pg.goto(f"{base}/capture?id={tid}&kind=baseline", wait_until="networkidle")
    await pg.get_by_role("button", name="Turn on camera").click()
    for shot in range(1, 4):
        await pg.wait_for_function(
            "() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Take photo' && !b.disabled)", timeout=120_000
        )
        await asyncio.sleep(1.0)
        await pg.get_by_role("button", name="Take photo").click()
        if shot < 3:
            await pg.wait_for_function(f"() => document.body.innerText.includes('Shot {shot + 1} of 3')", timeout=150_000)
            skip = pg.get_by_role("button", name="Skip the wait")
            if await skip.count():
                await skip.click()
        else:
            await pg.wait_for_url("**/trial?**", timeout=150_000)
        print(f"  {name}: shot {shot} done", flush=True)
    shots = await pg.evaluate(READ, tid)
    await b.close()
    return shots


def sd(xs):
    return st.stdev(xs) if len(xs) > 1 else float("nan")


async def main(base: str, out: Path):
    results = {}
    async with async_playwright() as p:
        for name, cam in RUNS:
            results[name] = await run_one(p, base, name, cam)
    assert not any(s["mock"] for r in results.values() for s in r), "mock mode: set YOUCAM_API_KEY"
    gap = lambda s, c: s["sides"][c]["right"] - s["sides"][c]["left"]  # treated (image-right) − untreated
    summary = {}
    for c in ["redness", "pore"]:
        ctrl = [gap(s, c) for k in ("control_a", "control_b") for s in results[k] if c in (s.get("sides") or {})]
        tint = [gap(s, c) for s in results["tinted"] if c in (s.get("sides") or {})]
        raw_ctrl = [s["raw"][c] for k in ("control_a", "control_b") for s in results[k] if c in s["raw"]]
        raw_tint = [s["raw"][c] for s in results["tinted"] if c in s["raw"]]
        # Pooled within-session SD of the gap = split-face noise (what /validate's stability test looks at).
        within = []
        for k in ("control_a", "control_b"):
            g = [gap(s, c) for s in results[k] if c in (s.get("sides") or {})]
            m = st.mean(g)
            within += [(x - m) ** 2 for x in g]
        sigma_gap = (sum(within) / (len(within) - 2)) ** 0.5
        shift = st.mean(tint) - st.mean(ctrl)
        se = (sigma_gap**2 / len(tint) + sigma_gap**2 / len(ctrl)) ** 0.5
        summary[c] = {
            "control_gaps": [round(x, 2) for x in ctrl],
            "tinted_gaps": [round(x, 2) for x in tint],
            "gap_sd_all_controls": round(sd(ctrl), 2),
            "gap_noise_pooled_within_session": round(sigma_gap, 2),
            "shift_tinted_minus_control": round(shift, 2),
            "shift_over_se": round(shift / se, 1),
            "raw_control": [round(x, 2) for x in raw_ctrl],
            "raw_tinted": [round(x, 2) for x in raw_tint],
            "raw_sd_control": round(sd(raw_ctrl), 2),
        }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"results": results, "summary": summary}, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3124")
    ap.add_argument("--out", default="demo/out/positive_control.json")
    a = ap.parse_args()
    asyncio.run(main(a.base, Path(a.out)))
