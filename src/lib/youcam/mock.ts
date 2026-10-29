import { rng } from "../stats";

/**
 * Mock mode (no API key, or YOUCAM_MOCK=1). Returns a docs-shaped response with made-up scores and no masks,
 * so the capture flow can be exercised without spending units. Every result produced here is flagged `mock`.
 */
export function mockTaskId(dstActions: string[]): string {
  const seed = Math.floor(Math.random() * 1e9);
  return `mock_${seed}_${Buffer.from(dstActions.join(",")).toString("base64url")}`;
}

export function mockTask(taskId: string): unknown {
  const [, seedStr, enc] = taskId.split("_");
  const actions = Buffer.from(enc ?? "", "base64url").toString().split(",").filter(Boolean);
  const r = rng(Number(seedStr) || 1);
  const base: Record<string, number> = { hd_redness: 68, hd_acne: 74, hd_texture: 61, hd_pore: 57, hd_age_spot: 70, hd_moisture: 55, hd_oiliness: 63, hd_wrinkle: 66 };
  return {
    status: 200,
    data: {
      task_status: "success",
      results: {
        output: actions.map((type) => {
          const raw = (base[type] ?? 60) + 3 * r.normal();
          return { type, raw_score: +raw.toFixed(2), ui_score: Math.min(99, Math.round(raw + 15)), mask_urls: [] };
        }),
      },
    },
  };
}
