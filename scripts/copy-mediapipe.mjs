// Copies MediaPipe's wasm runtime into public/ so Face Mesh loads from our own origin.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe", { recursive: true });
console.log("copied mediapipe wasm → public/mediapipe");
