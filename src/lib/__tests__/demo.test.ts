import { describe, expect, it } from "vitest";
import { buildDemo } from "../demo";
import { trialVerdict } from "../analysis";

describe("simulated demo trial", () => {
  const { trial, sessions } = buildDemo();
  it("walks through the verdict states as the replay advances", () => {
    expect(trialVerdict(trial, sessions, "redness", 12).kind).toBe("too_early");
    expect(trialVerdict(trial, sessions, "redness", 44).kind).toBe("working");
    expect(trialVerdict(trial, sessions, "texture", 44).kind).toBe("no_effect");
  });
  it("is labelled as a demo", () => {
    expect(trial.demo).toBe(true);
  });
});
