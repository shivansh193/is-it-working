import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side YouCam client. The API key never leaves the server.
 * Flow: POST /file (init) → PUT bytes to the pre-signed URL → POST /task/skin-analysis → GET /task/skin-analysis/{id}.
 */
const HOST = process.env.YOUCAM_API_HOST ?? "https://yce-api-01.makeupar.com";
const FILE_PATH = process.env.YOUCAM_FILE_PATH ?? "/s2s/v2.0/file";
const TASK_PATH = process.env.YOUCAM_TASK_PATH ?? "/s2s/v2.1/task/skin-analysis";

export const isMock = () => process.env.YOUCAM_MOCK === "1" || !process.env.YOUCAM_API_KEY;

function key(): string {
  const k = process.env.YOUCAM_API_KEY;
  if (!k) throw new YouCamError(500, "YOUCAM_API_KEY is not set");
  return k;
}

export class YouCamError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(HOST + path, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const msg = typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : text.slice(0, 300);
    throw new YouCamError(res.status, `YouCam ${path} → ${res.status}: ${msg}`, body);
  }
  return body as T;
}

interface FileInitResponse {
  data: {
    files: Array<{
      file_id: string;
      requests: Array<{ method: string; url: string; headers: Record<string, string> }>;
    }>;
  };
}

/** Steps 1+2: register the file, then PUT the bytes with exactly the headers YouCam returned. */
export async function uploadImage(bytes: Uint8Array, contentType: string, fileName: string): Promise<string> {
  const init = await call<FileInitResponse>(FILE_PATH, {
    method: "POST",
    body: JSON.stringify({ files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] }),
  });
  const file = init.data?.files?.[0];
  const req = file?.requests?.[0];
  if (!file?.file_id || !req?.url) throw new YouCamError(502, "File init returned no upload URL", init);
  const put = await fetch(req.url, { method: req.method || "PUT", headers: req.headers, body: Buffer.from(bytes) });
  if (!put.ok) throw new YouCamError(502, `Upload PUT failed: ${put.status} ${await put.text().catch(() => "")}`);
  return file.file_id;
}

/** Step 3. `format: "json"` so we get raw_score + mask_urls per concern. Masks stay separate (enable_mask_overlay: false). */
export async function createTask(fileId: string, dstActions: string[]): Promise<string> {
  const res = await call<{ data: { task_id: string } }>(TASK_PATH, {
    method: "POST",
    body: JSON.stringify({
      src_file_id: fileId,
      dst_actions: dstActions,
      miniserver_args: { enable_mask_overlay: false },
      format: "json",
    }),
  });
  if (!res.data?.task_id) throw new YouCamError(502, "Task create returned no task_id", res);
  return res.data.task_id;
}

/** Step 4. Raw body; parse with parseTask(). */
export async function getTask(taskId: string): Promise<unknown> {
  return call<unknown>(`${TASK_PATH}/${encodeURIComponent(taskId)}`);
}

// ── Mask proxy signing: the browser may only fetch mask URLs this server handed out. ──
const secret = () => process.env.MASK_SIGNING_SECRET || process.env.YOUCAM_API_KEY || "dev-only-secret";
export const signUrl = (u: string) => createHmac("sha256", secret()).update(u).digest("base64url");
export function verifyUrl(u: string, sig: string): boolean {
  const a = Buffer.from(signUrl(u));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
