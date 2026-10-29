import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const ACCESS_HEADER = "x-access-code";

/**
 * Routes that spend YouCam units need the access code when ACCESS_CODE is set (production).
 * Unset (local dev) means open. Returns a 401 response to send, or null to carry on.
 */
export function requireAccess(req: NextRequest): NextResponse | null {
  const code = process.env.ACCESS_CODE;
  if (!code) return null;
  const given = Buffer.from((req.headers.get(ACCESS_HEADER) ?? "").trim().toLowerCase());
  const want = Buffer.from(code.trim().toLowerCase());
  if (given.length === want.length && timingSafeEqual(given, want)) return null;
  return NextResponse.json({ error: "access_code_required" }, { status: 401 });
}
