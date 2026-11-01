"""
Records the demo chapters of "Is it working?" with a scripted, human-paced browser.

- Phone viewport (390x844, is_mobile) because the app is phone-first; each chapter is its own video.
- Chrome's fake camera plays a licence-free stock clip (Pexels 6278878) so the real capture flow runs:
  live Face Mesh checks, real YouCam HD analyses (12 units per photo), real masks.
- marks.json holds the seconds-from-start of every key moment; the editor places cuts and captions from it.

Usage: python demo/record.py --base http://localhost:3124 --cam fixtures/real/video/face.y4m --out demo/out
Run against a local production build (no access code locally, so no secret ever appears on screen).
"""

import argparse
import asyncio
import json
import time
from pathlib import Path

from playwright.async_api import Page, async_playwright

# Playwright records frames at CSS-viewport size (device_scale_factor is ignored), so for crisp phone footage
# we use a 2x-size viewport and zoom the page body 2x: the same 390x844 phone layout at double resolution.
VIEW = {"width": 780, "height": 1688}
VIDEO = VIEW
ZOOM = 2

CURSOR_JS = """
(() => {
  const add = () => {
    if (!document.getElementById('__demo_zoom')) {
      const st = document.createElement('style');
      st.id = '__demo_zoom';
      st.textContent = 'body{zoom:__ZOOM__} [class*="sm:flex-row"]{flex-direction:column!important}';
      document.documentElement.appendChild(st);
    }
    if (document.getElementById('__demo_cursor')) return;
    const d = document.createElement('div');
    d.id = '__demo_cursor';
    Object.assign(d.style, {
      position: 'fixed', left: '-80px', top: '-80px', width: '44px', height: '44px', borderRadius: '50%',
      background: 'rgba(44,107,100,0.35)', border: '4px solid rgba(44,107,100,0.9)', zIndex: 2147483647,
      pointerEvents: 'none', transform: 'translate(-50%,-50%) scale(1)', transition: 'transform 120ms ease',
    });
    document.documentElement.appendChild(d);
    addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { d.style.transform = 'translate(-50%,-50%) scale(1.6)'; }, true);
    addEventListener('mouseup', () => { d.style.transform = 'translate(-50%,-50%) scale(1)'; }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
})();
""".replace("__ZOOM__", str(ZOOM))


class Chapter:
    def __init__(self, name: str, page: Page):
        self.name, self.page, self.t0, self.marks = name, page, time.monotonic(), []
        self.mx, self.my = VIEW["width"] / 2, VIEW["height"] * 0.6

    def mark(self, label: str):
        t = round(time.monotonic() - self.t0, 2)
        self.marks.append({"t": t, "label": label})
        print(f"  [{self.name}] {t:6.2f}s  {label}", flush=True)

    async def pause(self, s: float):
        await asyncio.sleep(s)

    async def glide(self, x: float, y: float, steps: int = 28):
        await self.page.mouse.move(x, y, steps=steps)
        self.mx, self.my = x, y

    async def click(self, locator, after: float = 0.8, label: str | None = None):
        await locator.scroll_into_view_if_needed()
        box = await locator.bounding_box()
        assert box, f"no box for {locator}"
        await self.glide(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await self.pause(0.25)
        await self.page.mouse.down()
        await self.pause(0.08)
        await self.page.mouse.up()
        if label:
            self.mark(label)
        await self.pause(after)

    async def type(self, locator, text: str, label: str | None = None):
        await self.click(locator, after=0.3)
        await self.page.keyboard.type(text, delay=70)
        if label:
            self.mark(label)
        await self.pause(0.6)

    async def scroll_to(self, locator, block: str = "center", after: float = 1.0):
        await locator.evaluate(f"e => e.scrollIntoView({{behavior: 'smooth', block: '{block}'}})")
        await self.pause(after)

    async def drag_range(self, slider, frac: float, label: str | None = None):
        box = await slider.bounding_box()
        assert box
        cur = await slider.evaluate("e => (e.value - e.min) / (e.max - e.min)")
        y = box["y"] + box["height"] / 2
        pad = 8 * ZOOM  # thumb radius
        x_of = lambda f: box["x"] + pad + f * (box["width"] - 2 * pad)
        await self.glide(x_of(cur), y)
        await self.pause(0.2)
        await self.page.mouse.down()
        await self.page.mouse.move(x_of(frac), y, steps=40)
        await self.page.mouse.up()
        if label:
            self.mark(label)
        await self.pause(1.6)


async def new_chapter(ctx, name: str, url: str) -> Chapter:
    page = await ctx.new_page()
    ch = Chapter(name, page)
    await page.goto(url, wait_until="networkidle")
    ch.mark("page loaded")
    await page.mouse.move(ch.mx, ch.my)
    return ch


async def finish(ch: Chapter, out: Path, all_marks: dict):
    await ch.pause(0.8)
    ch.mark("end")
    await ch.page.close()
    src = Path(await ch.page.video.path())
    dst = out / f"{ch.name}.webm"
    if dst.exists():
        dst.unlink()
    src.rename(dst)
    all_marks[ch.name] = {"file": dst.name, "marks": ch.marks}


async def main(base: str, cam: str, out: Path, only: set[str]):
    out.mkdir(parents=True, exist_ok=True)
    marks_file = out / "marks.json"
    all_marks = json.loads(marks_file.read_text()) if marks_file.exists() else {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                f"--use-file-for-fake-video-capture={cam}",
            ],
        )
        ctx = await browser.new_context(
            viewport=VIEW,
            device_scale_factor=1,
            is_mobile=True,
            has_touch=False,
            record_video_dir=str(out / "raw"),
            record_video_size=VIDEO,
            permissions=["camera"],
        )
        await ctx.add_init_script(CURSOR_JS)
        trial_url = None

        # ── 1 · Start a trial ───────────────────────────────────────────────
        if "setup" in only or "capture" in only or "split" in only:
            ch = await new_chapter(ctx, "ch1_setup", base + "/")
            pg = ch.page
            await ch.pause(1.2)
            await ch.click(pg.get_by_role("link", name="Start a trial"), after=1.2, label="start trial clicked")
            await ch.type(pg.get_by_placeholder("e.g. 10% niacinamide serum"), "Niacinamide 10% serum", label="product typed")
            await ch.scroll_to(pg.get_by_text("Products like this usually need"), after=2.2)
            ch.mark("time-to-effect note visible")
            await ch.click(pg.get_by_role("button", name="Dark spots"), after=0.4)
            await ch.click(pg.get_by_role("button", name="Pores"), after=0.8, label="concerns chosen")
            await ch.scroll_to(pg.get_by_text("Split-face (recommended)"), after=2.0)
            ch.mark("split-face visible")
            await ch.click(pg.get_by_role("button", name="my left cheek"), after=0.8, label="cheek chosen")
            await ch.type(pg.get_by_placeholder("2500"), "2500", label="price typed")
            await ch.click(pg.get_by_role("button", name="Take baseline photos"), after=1.5, label="baseline clicked")
            await pg.wait_for_url("**/capture?**")
            trial_url = pg.url.replace("/capture?", "/trial?").replace("&kind=baseline", "")
            all_marks["trial_url"] = trial_url
            await finish(ch, out, all_marks)
        trial_url = trial_url or all_marks.get("trial_url")

        # ── 2 · Guided baseline (fake camera, real YouCam) ──────────────────
        if "capture" in only:
            ch = await new_chapter(ctx, "ch2_capture", trial_url.replace("/trial?", "/capture?") + "&kind=baseline")
            pg = ch.page
            await ch.pause(1.5)
            await ch.click(pg.get_by_role("button", name="Turn on camera"), after=0.5, label="camera on")
            take = pg.get_by_role("button", name="Take photo")
            for shot in range(1, 4):
                await take.wait_for(state="visible", timeout=60_000)
                await pg.wait_for_function("() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Take photo' && !b.disabled)", timeout=90_000)
                ch.mark(f"guide ok {shot}")
                await ch.pause(1.2)
                await ch.click(take, after=0.2, label=f"shot {shot} taken")
                if shot < 3:
                    await pg.wait_for_function(f"() => document.body.innerText.includes('Shot {shot + 1} of 3')", timeout=150_000)
                    ch.mark(f"shot {shot} analysed")
                    err = pg.locator("text=/failed|No face|too small|out of frame/i")
                    if await err.count():
                        raise RuntimeError("capture error: " + await err.first.inner_text())
                    await ch.pause(2.0)
                    skip = pg.get_by_role("button", name="Skip the wait")
                    if await skip.count():
                        await ch.click(skip, after=0.6, label=f"wait skipped {shot}")
                else:
                    await pg.wait_for_url("**/trial?**", timeout=150_000)
                    ch.mark("shot 3 analysed, results page")
            await ch.pause(1.0)
            await ch.scroll_to(pg.get_by_text("Baseline done"), block="start", after=3.0)
            ch.mark("noise summary visible")
            await finish(ch, out, all_marks)

        # ── 3 · Split-face view ─────────────────────────────────────────────
        if "split" in only:
            ch = await new_chapter(ctx, "ch3_split", trial_url)
            pg = ch.page
            await ch.pause(1.5)
            await ch.scroll_to(pg.get_by_text("Split-face: Redness"), block="start", after=0.5)
            ch.mark("split view (redness) top")
            await ch.pause(3.5)
            await ch.scroll_to(pg.get_by_role("cell", name="baseline"), block="center", after=2.5)
            ch.mark("side score table")
            await ch.scroll_to(pg.get_by_role("group", name="Concern to chart"), block="start", after=0.5)
            await ch.click(pg.get_by_role("group", name="Concern to chart").get_by_role("button", name="Pores"), after=0.5, label="pores selected")
            await ch.scroll_to(pg.get_by_text("Split-face: Pores"), block="start", after=3.5)
            ch.mark("split view (pores)")
            await finish(ch, out, all_marks)

        # ── 4 · Verdict on the simulated demo trial ─────────────────────────
        if "demo" in only:
            ch = await new_chapter(ctx, "ch4_demo", base + "/demo")
            pg = ch.page
            await ch.pause(2.5)
            ch.mark("simulated banner visible")
            slider = pg.get_by_role("slider", name="Replay day")
            await ch.scroll_to(slider, block="start", after=1.0)
            ch.mark("day 12 too early")
            await ch.pause(2.5)
            await ch.drag_range(slider, (28 - 4) / 40, label="day 28")
            await ch.pause(2.0)
            await ch.drag_range(slider, (44 - 4) / 40, label="day 44 working")
            await ch.pause(2.5)
            await ch.click(pg.get_by_role("button", name="Why this verdict?").first, after=0.5, label="why opened")
            await ch.scroll_to(pg.get_by_text("Your scan-to-scan noise").first, block="center", after=3.5)
            ch.mark("why panel read")
            await ch.scroll_to(pg.get_by_text("Should I rebuy?"), block="start", after=3.5)
            ch.mark("rebuy card")
            await ch.scroll_to(pg.get_by_text("Treated − untreated gap"), block="start", after=3.0)
            ch.mark("gap chart")
            await finish(ch, out, all_marks)

        await ctx.close()
        await browser.close()
    marks_file.write_text(json.dumps(all_marks, indent=2))
    print("wrote", marks_file)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3124")
    ap.add_argument("--cam", default="fixtures/real/video/face.y4m")
    ap.add_argument("--out", default="demo/out")
    ap.add_argument("--only", default="setup,capture,split,demo", help="comma list: setup,capture,split,demo")
    a = ap.parse_args()
    asyncio.run(main(a.base, str(Path(a.cam).resolve()), Path(a.out), set(a.only.split(","))))
