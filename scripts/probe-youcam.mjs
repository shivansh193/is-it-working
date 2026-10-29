// Real-API probe: upload → task → poll for each image given, save the raw response and masks to fixtures/real/,
// and report mask sizes against the photo. Spends units (12 per image for ≤4 HD concerns).
// Usage: node --env-file=.env.local scripts/probe-youcam.mjs <img.jpg> [more.jpg ...]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";

const HOST = process.env.YOUCAM_API_HOST ?? "https://yce-api-01.makeupar.com";
const FILE = process.env.YOUCAM_FILE_PATH ?? "/s2s/v2.0/file";
const TASK = process.env.YOUCAM_TASK_PATH ?? "/s2s/v2.1/task/skin-analysis";
const KEY = process.env.YOUCAM_API_KEY;
const ACTIONS = (process.env.PROBE_ACTIONS ?? "hd_redness,hd_texture,hd_pore,hd_acne").split(",");
const OUT = "fixtures/real/probe";
mkdirSync(OUT, { recursive: true });

const auth = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function api(path, init = {}) {
  const r = await fetch(HOST + path, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
  const t = await r.text();
  let b = t;
  try { b = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`${path} → ${r.status} ${t.slice(0, 400)}`);
  return b;
}

/** Width/height from a PNG header, or JPEG SOF marker. */
function dims(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "png", colorType: buf[25] };
  for (let i = 2; i < buf.length; ) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: "jpeg" };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

for (const [n, path] of process.argv.slice(2).entries()) {
  const tag = `${basename(path, ".jpg")}-run${n + 1}`;
  const bytes = readFileSync(path);
  const img = dims(bytes);
  console.log(`\n== ${tag}: ${img.w}×${img.h}, ${(bytes.length / 1e6).toFixed(2)} MB, actions ${ACTIONS.join(",")}`);
  const init = await api(FILE, { method: "POST", body: JSON.stringify({ files: [{ content_type: "image/jpeg", file_name: basename(path), file_size: bytes.length }] }) });
  const f = init.data.files[0];
  const req = f.requests[0];
  const put = await fetch(req.url, { method: req.method || "PUT", headers: req.headers, body: bytes });
  if (!put.ok) throw new Error(`PUT ${put.status}`);
  const t0 = Date.now();
  const task = await api(TASK, { method: "POST", body: JSON.stringify({ src_file_id: f.file_id, dst_actions: ACTIONS, miniserver_args: { enable_mask_overlay: false }, format: "json" }) });
  const id = task.data.task_id;
  let body;
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    body = await api(`${TASK}/${id}`);
    const st = body.data?.task_status;
    if (st === "success" || st === "error") break;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(body, null, 2));
  console.log(`status ${body.data?.task_status} in ${secs}s; top-level data keys: ${Object.keys(body.data ?? {}).join(", ")}`);
  if (body.data?.task_status !== "success") { console.log(JSON.stringify(body).slice(0, 600)); continue; }
  const output = body.data.results?.output ?? [];
  for (const o of output) {
    const masks = [];
    for (const [k, u] of (o.mask_urls ?? []).entries()) {
      const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
      const d = dims(buf);
      writeFileSync(`${OUT}/${tag}-${o.type}-${k}.${d?.type ?? "bin"}`, buf);
      masks.push(d ? `${d.w}×${d.h} ${d.type}${d.colorType !== undefined ? ` ct${d.colorType}` : ""}` : "?");
    }
    const extra = Object.keys(o).filter((k) => !["type", "ui_score", "raw_score", "mask_urls"].includes(k));
    console.log(`  ${o.type.padEnd(12)} raw ${String(o.raw_score).padEnd(8)} ui ${String(o.ui_score).padEnd(4)} masks [${masks.join(", ")}]${extra.length ? ` extra: ${extra.join(",")}` : ""}`);
  }
}
