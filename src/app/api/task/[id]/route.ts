import { NextRequest, NextResponse } from "next/server";
import { YouCamError, getTask, isMock, signUrl } from "@/lib/youcam/client";
import { mockTask } from "@/lib/youcam/mock";
import { parseTask } from "@/lib/youcam/parse";

export const runtime = "nodejs";

/** Poll a task. On success, returns parsed raw scores and signed mask-proxy URLs. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mock = id.startsWith("mock_");
  if (!mock && isMock()) return NextResponse.json({ error: "Mock mode is on" }, { status: 400 });
  try {
    const body = mock ? mockTask(id) : await getTask(id);
    const parsed = parseTask(body);
    if (!mock && parsed.status !== "running" && process.env.SAVE_FIXTURES === "1" && process.env.NODE_ENV !== "production") {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir("fixtures/real", { recursive: true });
      await writeFile(`fixtures/real/task-${id}.json`, JSON.stringify(body, null, 2));
    }
    const masks: Record<string, string[]> = {};
    for (const [c, r] of Object.entries(parsed.concerns)) {
      masks[c] = (r?.masks ?? []).map((u) => `/api/mask?u=${encodeURIComponent(u)}&s=${signUrl(u)}`);
    }
    return NextResponse.json({ ...parsed, masks, mock });
  } catch (e) {
    const err = e as YouCamError;
    return NextResponse.json({ status: "error", error: err.message }, { status: err.status || 500 });
  }
}
