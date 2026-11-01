"use client";
import { useMemo, useState } from "react";
import { Measurement, costSoFar, rawSeries, trialVerdict, verdictSessions } from "@/lib/analysis";
import { getCategory } from "@/lib/categories";
import { download, renderShareCard } from "@/lib/share";
import { CONCERN_LABEL, Concern, Session, Trial } from "@/lib/types";
import { Verdict } from "@/lib/verdict";
import { VerdictCard } from "./VerdictCard";
import { TrendChart } from "./TrendChart";
import { SplitView } from "./SplitView";

export function Results({ trial, sessions, asOfDay = Infinity, simulated = false }: { trial: Trial; sessions: Session[]; asOfDay?: number; simulated?: boolean }) {
  const cat = getCategory(trial.category);
  const verdicts = useMemo(() => trial.concerns.map((c) => [c, trialVerdict(trial, sessions, c, asOfDay)] as [Concern, Verdict & Measurement]), [trial, sessions, asOfDay]);
  const [focus, setFocus] = useState<Concern>(trial.concerns[0]);
  const fv = verdicts.find(([c]) => c === focus)?.[1];
  const days = verdicts[0]?.[1].days ?? 0;

  return (
    <div className="space-y-4">
      {verdicts.map(([c, v]) => (
        <VerdictCard key={c} concern={c} v={v} />
      ))}

      <Rebuy trial={trial} verdicts={verdicts} days={days} />

      {trial.concerns.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Concern to chart">
          {trial.concerns.map((c) => (
            <button key={c} className="chip" aria-pressed={c === focus} onClick={() => setFocus(c)}>
              {CONCERN_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      {fv &&
        (fv.mode === "split" ? (
          <>
            <TrendChart
              title={`Treated − untreated gap: ${CONCERN_LABEL[focus]}`}
              unit="vs baseline gap"
              points={verdictSessions(trial, sessions, focus, asOfDay)}
              bar={fv.threshold}
              maxDay={Math.max(days, cat.minDays)}
              minDays={cat.minDays}
            />
            <SplitView trial={trial} sessions={sessions} concern={focus} asOfDay={asOfDay} />
          </>
        ) : (
          <>
            <TrendChart
              title={`Raw score: ${CONCERN_LABEL[focus]}`}
              points={rawSeries(trial, sessions, focus, asOfDay)}
              bar={fv.threshold}
              maxDay={Math.max(days, cat.minDays)}
              minDays={cat.minDays}
            />
            {/* A split-face trial that fell back to whole face still shows the sides, for transparency. */}
            {trial.mode === "split" && <SplitView trial={trial} sessions={sessions} concern={focus} asOfDay={asOfDay} />}
          </>
        ))}

      <button
        className="btn btn-ghost w-full"
        onClick={() => download(`is-it-working-${trial.name.replace(/\W+/g, "-").toLowerCase()}.png`, renderShareCard(trial, verdicts, simulated))}
      >
        Save summary image (no face)
      </button>
    </div>
  );
}

function Rebuy({ trial, verdicts, days }: { trial: Trial; verdicts: Array<[Concern, Verdict & Measurement]>; days: number }) {
  const cat = getCategory(trial.category);
  const by = (k: Verdict["kind"]) => verdicts.filter(([, v]) => v.kind === k).map(([c]) => CONCERN_LABEL[c].toLowerCase());
  const working = by("working");
  const worse = by("worse");
  const none = by("no_effect");
  const early = by("too_early");
  let text: string;
  if (worse.length) text = `Your ${worse.join(" and ")} got measurably worse. Consider stopping, and see a dermatologist if it continues.`;
  else if (working.length)
    text = `Yes, for ${working.join(" and ")}: the change is bigger than your scan noise.${none.length ? ` No measurable effect on ${none.join(" or ")}.` : ""}`;
  else if (early.length) text = `Don't judge yet. Products like this rarely show results before day ${cat.minDays}. You're on day ${days}.`;
  else if (none.length) text = `So far, no change bigger than your scan noise after ${days} days. If it's not cheap, consider switching.`;
  else text = "Not enough check-ins to say. Keep going.";
  const cost = costSoFar(trial, days);
  return (
    <section className="card p-4">
      <div className="label">Should I rebuy?</div>
      <p className="display mt-1 text-lg leading-snug">{text}</p>
      {cost !== undefined && (
        <p className="mt-2 text-sm text-muted">
          Spent so far: ₹{Math.round(cost).toLocaleString("en-IN")} of ₹{trial.price!.toLocaleString("en-IN")} ({days} of ~{trial.supplyDays} days of product).
        </p>
      )}
      {working.length > 0 && !worse.length && trial.link && (
        <a href={trial.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-3 w-full">
          Reorder this product
        </a>
      )}
      {!working.length && !worse.length && none.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Before buying another bottle, check its active ingredient: a different product with the same one may not do better for you.
        </p>
      )}
    </section>
  );
}
