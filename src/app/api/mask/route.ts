import { NextRequest, NextResponse } from "next/server";
import { verifyUrl } from "@/lib/youcam/client";

export const runtime = "nodejs";

/** Same-origin proxy for YouCam mask PNGs, so the browser can read their alpha channel. Only signed URLs pass. */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const s = req.nextUrl.searchParams.get("s") ?? "";
  if (!u.startsWith("https://") || !verifyUrl(u, s)) return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: `Mask fetch ${res.status}` }, { status: 502 });
  return new NextResponse(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") ?? "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
