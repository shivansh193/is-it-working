"""
Kaggle kernel (CPU, internet on): build the Hyperframes composition from the dataset and either take a
preview sheet of snapshots (import sys, traceback

def _crash(t, v, tb):
    Path("/kaggle/working/logs").mkdir(parents=True, exist_ok=True)
    Path("/kaggle/working/logs/error.log").write_text("".join(traceback.format_exception(t, v, tb)))
    sys.__excepthook__(t, v, tb)

sys.excepthook = _crash

MODE = "snapshot") or render the delivery MP4 (MODE = "render").
Inputs: the private dataset with chN_*.mp4, marks.json and build.py. Outputs in /kaggle/working.
"""

import glob
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

MODE = "render"  # "snapshot" | "render"
HF = "hyperframes@0.8.227"
NODE = "v22.11.0"
W = Path("/kaggle/working")
LOG = W / "logs"
LOG.mkdir(parents=True, exist_ok=True)
SNAP_TIMES = [2.5, 6, 14, 21, 27, 36, 44, 52, 60, 68, 76, 86, 94, 104, 116, 124, 132, 148, 162, 171]


def sh(cmd: str, name: str, check: bool = True, cwd: str | None = None) -> subprocess.CompletedProcess:
    print(f"$ {cmd}", flush=True)
    r = subprocess.run(cmd, shell=True, text=True, capture_output=True, cwd=cwd, env=os.environ)
    (LOG / f"{name}.log").write_text(f"$ {cmd}\n--- stdout\n{r.stdout}\n--- stderr\n{r.stderr}\n")
    print(r.stdout[-3000:], r.stderr[-3000:], sep="\n", flush=True)
    if check and r.returncode != 0:
        raise SystemExit(f"{name} failed ({r.returncode})")
    return r


# ── toolchain ──────────────────────────────────────────────────────────────────────────────────────
node_dir = Path(f"/kaggle/tmp/node-{NODE}-linux-x64")
if not node_dir.exists():
    Path("/kaggle/tmp").mkdir(parents=True, exist_ok=True)
    tar = f"/kaggle/tmp/node.tar.xz"
    urllib.request.urlretrieve(f"https://nodejs.org/dist/{NODE}/node-{NODE}-linux-x64.tar.xz", tar)
    sh(f"tar -xJf {tar} -C /kaggle/tmp", "node-untar")
os.environ["PATH"] = f"{node_dir}/bin:" + os.environ["PATH"]
sh("node -v && npm -v", "node-version")

if shutil.which("ffmpeg") is None:
    sh("apt-get update -qq && apt-get install -y -qq ffmpeg", "ffmpeg")
sh("apt-get update -qq", "apt-update", check=False)
for pkg in ["libnss3", "libatk1.0-0", "libatk-bridge2.0-0", "libcups2", "libdrm2", "libxkbcommon0", "libxcomposite1",
            "libxdamage1", "libxfixes3", "libxrandr2", "libgbm1", "libpango-1.0-0", "libcairo2", "libasound2",
            "libatspi2.0-0", "libgtk-3-0", "fonts-liberation"]:
    r = sh(f"apt-get install -y -qq {pkg}", f"apt-{pkg}", check=False)
    if r.returncode != 0:
        sh(f"apt-get install -y -qq {pkg}t64", f"apt-{pkg}t64", check=False)

# ── build the composition ──────────────────────────────────────────────────────────────────────────
found = glob.glob("/kaggle/input/**/marks.json", recursive=True)
(LOG / "inputs.log").write_text(chr(10).join(glob.glob("/kaggle/input/**", recursive=True)[:200]))
assert found, "dataset not mounted: no marks.json under /kaggle/input"
src = Path(found[0]).parent
comp = W / "composition"
assets = comp / "assets"
(assets / "fonts").mkdir(parents=True, exist_ok=True)
for f in ["geist-sans/Geist-Regular", "geist-sans/Geist-Medium", "geist-sans/Geist-SemiBold", "geist-mono/GeistMono-Regular", "geist-mono/GeistMono-Medium"]:
    urllib.request.urlretrieve(f"https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/{f}.woff2", assets / "fonts" / (f.split("/")[1] + ".woff2"))
urllib.request.urlretrieve("https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js", assets / "gsap.min.js")
sh(f"python {src}/build.py --clips {src} --out {comp}", "build")

os.chdir(comp)
sh(f"npx -y {HF} browser ensure", "browser-ensure")
sh(f"npx -y {HF} lint", "lint", check=False)
sh(f"npx -y {HF} check --json > {LOG}/check.json", "check", check=False)

if MODE == "snapshot":
    sh(f"npx -y {HF} snapshot --at {','.join(str(t) for t in SNAP_TIMES)} --timeout 120000", "snapshot", check=False)
    pngs = sorted(glob.glob(str(comp / ".hyperframes/artifacts/snapshots/**/*.png"), recursive=True), key=os.path.getmtime)
    out = W / "snaps"
    out.mkdir(exist_ok=True)
    for p in pngs:
        shutil.copy(p, out / Path(p).name)
    print("snapshots:", len(pngs))
    try:
        from PIL import Image, ImageDraw

        ims = [Image.open(p).convert("RGB").resize((480, 270)) for p in pngs[:20]]
        sheet = Image.new("RGB", (480 * 4, 290 * ((len(ims) + 3) // 4)), "white")
        d = ImageDraw.Draw(sheet)
        for i, im in enumerate(ims):
            x, y = (i % 4) * 480, (i // 4) * 290
            sheet.paste(im, (x, y))
            d.text((x + 6, y + 272), f"{Path(pngs[i]).stem}", fill="black")
        sheet.save(W / "preview_sheet.jpg", quality=85)
    except Exception as ex:  # keep the PNGs even if the sheet fails
        print("sheet failed:", ex)
else:
    sh(f"npx -y {HF} render --quality delivery --browser-timeout 300 -o {W}/video_silent.mp4", "render")
    sh(f"ffprobe -v error -show_entries format=duration -of csv=p=0 {W}/video_silent.mp4", "ffprobe")
    # 20-frame preview sheet spread over the whole render
    sh(f'ffmpeg -v error -y -i {W}/video_silent.mp4 -vf "fps=20/175,scale=480:-1,tile=4x5" -frames:v 1 {W}/preview_sheet.jpg', "sheet", check=False)
    for t in [12, 76, 104, 153, 165]:  # every slide once fully revealed, for a close look
        sh(f"ffmpeg -v error -y -ss {t} -i {W}/video_silent.mp4 -frames:v 1 {W}/slide_{t}.jpg", f"slide-{t}", check=False)

shutil.rmtree(comp / "assets", ignore_errors=True)  # keep outputs small: clips are already in the dataset
print("done")
