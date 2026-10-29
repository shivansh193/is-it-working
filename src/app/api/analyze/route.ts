import { NextRequest, NextResponse } from "next/server";
import { YouCamError, createTask, isMock } from "@/lib/youcam/client";
import { mockTaskId } from "@/lib/youcam/mock";
import { toDstActions } from "@/lib/youcam/parse";
import { hdUnits } from "@/lib/budget";
import { isConcern } from "@/lib/types";
import { requireAccess } from "@/lib/youcam/access";

export const runtime = "nodejs";

/** Body: { fileId, concerns: Concern[] }. Creates an HD skin-analysis task. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { fileId?: unknown; concerns?: unknown } | null;
  const fileId = typeof body?.fileId === "string" ? body.fileId : "";
  const concerns = Array.isArray(body?.concerns) ? body.concerns.filter((c): c is string => typeof c === "string") : [];
  if (!fileId || concerns.length === 0 || concerns.length > 8 || !concerns.every(isConcern)) {
    return NextResponse.json({ error: "Need fileId and 1–8 known concerns" }, { status: 400 });
  }
  const dst = toDstActions(concerns);
  const units = hdUnits(dst.length);
  if (isMock()) return NextResponse.json({ taskId: mockTaskId(dst), units: 0, mock: true });
  const denied = requireAccess(req);
  if (denied) return denied;
  try {
    const taskId = await createTask(fileId, dst);
    console.info(`[youcam] task ${taskId} created: ${dst.join(",")} (expected ${units} units on success)`);
    return NextResponse.json({ taskId, units, mock: false });
  } catch (e) {
    const err = e as YouCamError;
    return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status || 500 });
  }
}
