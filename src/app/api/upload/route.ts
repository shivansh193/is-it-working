import { NextRequest, NextResponse } from "next/server";
import { YouCamError, isMock, uploadImage } from "@/lib/youcam/client";

export const runtime = "nodejs";
const MAX = 10 * 1024 * 1024;

/** Body: the image bytes (image/jpeg or image/png). Returns the YouCam file_id. */
export async function POST(req: NextRequest) {
  const type = req.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png)$/.test(type)) return NextResponse.json({ error: "Send image/jpeg or image/png" }, { status: 415 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX) return NextResponse.json({ error: "Image must be 1 byte – 10 MB" }, { status: 413 });
  if (isMock()) return NextResponse.json({ fileId: `mockfile_${bytes.byteLength}`, mock: true });
  try {
    const fileId = await uploadImage(bytes, type, type === "image/png" ? "selfie.png" : "selfie.jpg");
    return NextResponse.json({ fileId, mock: false });
  } catch (e) {
    const err = e as YouCamError;
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
