"use client";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { FACE_OVAL_IDX, MIDLINE_IDX, Pt, pickPts } from "./split";

const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
let landmarker: Promise<FaceLandmarker> | null = null;

export function getLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();
  return landmarker;
}

export interface FaceGeom {
  landmarks: Pt[];
  oval: Pt[];
  midline: Pt[];
  /** Face width as a fraction of image width (YouCam wants > 0.6). */
  widthFrac: number;
  /** Yaw proxy: nose tip offset from the cheek-to-cheek centre, as a fraction of face width. 0 = straight on. */
  yaw: number;
}

export async function detectFace(src: HTMLCanvasElement | HTMLImageElement | ImageBitmap): Promise<FaceGeom | null> {
  const lm = await getLandmarker();
  const res = lm.detect(src);
  const pts = res.faceLandmarks?.[0];
  if (!pts) return null;
  const landmarks = pts.map((p) => ({ x: p.x, y: p.y }));
  const l = landmarks[234];
  const r = landmarks[454];
  const nose = landmarks[1];
  const w = Math.abs(r.x - l.x);
  return {
    landmarks,
    oval: pickPts(landmarks, FACE_OVAL_IDX),
    midline: pickPts(landmarks, MIDLINE_IDX),
    widthFrac: w,
    yaw: w ? (nose.x - (l.x + r.x) / 2) / w : 0,
  };
}
