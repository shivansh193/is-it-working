"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaceGeom, detectFace, getLandmarker } from "@/lib/facemesh";
import { LightCheck, checkLight, drawToCanvas, fitForHD, loadImage, motion } from "@/lib/image";
import { ImageSide } from "@/lib/types";

interface Guide {
  ok: boolean;
  msg: string;
  light?: LightCheck;
  /** Raw check values, exposed as a data attribute for debugging and tuning. */
  metrics?: string;
}

/**
 * Guided selfie capture: face outline, live light / framing / stillness checks, and a timed gap between repeat shots.
 * The preview is mirrored like a mirror; the captured photo is not.
 */
export function Capture({
  total,
  done,
  gapSeconds,
  treatedSide,
  busy,
  onShot,
}: {
  total: number;
  done: number;
  gapSeconds: number;
  treatedSide?: ImageSide;
  busy: boolean;
  onShot: (canvas: HTMLCanvasElement, face: FaceGeom | null) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guide>({ ok: false, msg: "Starting camera…" });
  const [wait, setWait] = useState(0);
  const prevDone = useRef(done);

  // Gap between repeat shots, so the noise estimate reflects real re-takes, not identical frames.
  useEffect(() => {
    if (done > prevDone.current && done < total) setWait(gapSeconds);
    prevDone.current = done;
  }, [done, total, gapSeconds]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const start = useCallback(async () => {
    setCamError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      setStream(s);
      getLandmarker().catch(() => {});
    } catch (e) {
      setCamError((e as Error).name === "NotAllowedError" ? "Camera permission was denied." : "No camera available.");
    }
  }, []);

  useEffect(() => {
    if (stream && video.current) {
      video.current.srcObject = stream;
      video.current.play().catch(() => {});
    }
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  // Live checks, ~2.5×/s on a small frame.
  useEffect(() => {
    if (!stream) return;
    let prev: ImageData | null = null;
    let alive = true;
    let tick = 0;
    let face: FaceGeom | null = null;
    const loop = async () => {
      const v = video.current;
      if (!alive || !v || !v.videoWidth) return void setTimeout(loop, 300);
      const w = 192;
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      const small = drawToCanvas(v, w, h);
      const img = small.getContext("2d")!.getImageData(0, 0, w, h);
      const light = checkLight(img);
      const mv = prev ? motion(prev, img) : 0;
      prev = img;
      if (tick++ % 2 === 0) face = await detectFace(drawToCanvas(v, 360, Math.round((v.videoHeight / v.videoWidth) * 360))).catch(() => null);
      let g: Guide;
      if (!face) g = { ok: false, msg: "Centre your face in the outline", light };
      else if (face.widthFrac < 0.6) g = { ok: false, msg: "Move closer — fill the outline", light };
      else if (face.widthFrac > 0.9) g = { ok: false, msg: "Move back a little", light };
      // Thresholds calibrated 2026-11-01 on two straight-on stock faces, which read |yaw| ≈ 0.13–0.15 and
      // moved ~10 between checks (frames ~0.4 s apart). The first guesses (0.08, 7) rejected both.
      else if (Math.abs(face.yaw) > 0.2) g = { ok: false, msg: "Face the camera straight on", light };
      else if (!light.ok) g = { ok: false, msg: light.hint!, light };
      else if (mv > 14) g = { ok: false, msg: "Hold still", light };
      else g = { ok: true, msg: "Looks good — hold still and tap", light };
      if (face) g.metrics = `w=${face.widthFrac.toFixed(3)} yaw=${face.yaw.toFixed(3)} light=${light.mean.toFixed(0)} bal=${light.balance.toFixed(3)} mv=${mv.toFixed(1)}`;
      if (alive) setGuide(g);
      setTimeout(loop, 380);
    };
    loop();
    return () => {
      alive = false;
    };
  }, [stream]);

  const snap = async () => {
    const v = video.current;
    if (!v) return;
    const { w, h } = fitForHD(v.videoWidth, v.videoHeight);
    const canvas = drawToCanvas(v, w, h);
    onShot(canvas, await detectFace(canvas).catch(() => null));
  };

  const fromFile = async (f: File) => {
    const url = URL.createObjectURL(f);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    const { w, h } = fitForHD(img.naturalWidth, img.naturalHeight);
    const canvas = drawToCanvas(img, w, h);
    onShot(canvas, await detectFace(canvas).catch(() => null));
  };

  // Mirrored preview: the user's left cheek (image-right) shows on the screen's left.
  const treatedOnScreen = treatedSide ? (treatedSide === "image-right" ? "left" : "right") : null;
  const ready = guide.ok && wait === 0 && !busy;

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-[#1d2a2e]">
        {stream ? (
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-white/85">
            <div className="space-y-3">
              <p className="display text-xl">Same spot. Same light. Every time.</p>
              <p className="text-sm text-white/65">Hair back, no makeup, glasses off. Face a window or soft lamp so both cheeks are lit evenly.</p>
              <button className="btn btn-primary" onClick={start}>
                Turn on camera
              </button>
              {camError && <p className="text-sm text-[#f3b6b1]">{camError}</p>}
            </div>
          </div>
        )}
        {stream && (
          <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <mask id="hole">
                <rect width="300" height="400" fill="white" />
                <ellipse cx="150" cy="190" rx="105" ry="140" fill="black" />
              </mask>
            </defs>
            <rect width="300" height="400" fill="rgba(20,28,30,0.45)" mask="url(#hole)" />
            <ellipse cx="150" cy="190" rx="105" ry="140" fill="none" stroke={guide.ok ? "#9fe0c4" : "#fff"} strokeWidth="2.5" strokeDasharray={guide.ok ? "0" : "6 6"} />
            <line x1="150" y1="60" x2="150" y2="320" stroke="rgba(255,255,255,0.35)" strokeDasharray="3 5" />
            {treatedOnScreen && (
              <text x={treatedOnScreen === "left" ? 70 : 230} y="370" textAnchor="middle" fill="#9fe0c4" fontSize="13" fontWeight="600">
                treated side
              </text>
            )}
          </svg>
        )}
        {stream && (
          <div className="absolute inset-x-3 top-3 flex justify-between text-xs font-semibold text-white">
            <span className="rounded-full bg-black/45 px-2.5 py-1">
              Shot {Math.min(done + 1, total)} of {total}
            </span>
            {guide.light && <span className="rounded-full bg-black/45 px-2.5 py-1">light {Math.round(guide.light.mean)}</span>}
          </div>
        )}
      </div>

      {stream && (
        <>
          <p className="text-center text-base font-medium" aria-live="polite" data-metrics={guide.metrics} style={{ color: guide.ok ? "var(--v-working)" : "var(--ink)" }}>
            {busy ? "Analysing…" : wait > 0 ? `Next shot in ${wait}s — relax, then re-centre` : guide.msg}
          </p>
          <button className="btn btn-primary w-full py-4 text-lg" disabled={!ready} onClick={snap}>
            {busy ? "Analysing…" : wait > 0 ? `Wait ${wait}s` : "Take photo"}
          </button>
          {wait > 0 && (
            <button className="w-full text-center text-sm text-muted underline" onClick={() => setWait(0)}>
              Skip the wait (makes your noise estimate less realistic)
            </button>
          )}
        </>
      )}
      <label className="block text-center text-sm text-muted">
        or{" "}
        <span className="cursor-pointer text-accent underline">
          use a photo from your device
          <input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
        </span>
      </label>
    </div>
  );
}
