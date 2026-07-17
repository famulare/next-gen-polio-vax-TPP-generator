import { performance } from "node:perf_hooks";
import { buildFrontier } from "../src/model/frontier";
import { computePointMetrics } from "../src/model/metrics";
import { buildSettingSurface, defaultScenario } from "../src/model/model";
import { buildScheduleState } from "../src/model/schedule";

const scenario = defaultScenario();
const state = buildScheduleState(scenario.vaccine, scenario.schedule);

function medianWarmMilliseconds(label: string, operation: () => void): number {
  operation();
  const samples: number[] = [];
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const start = performance.now();
    operation();
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  const median = samples[1];
  if (median === undefined) throw new Error(`${label} produced no timing samples`);
  return median;
}

const selectedMilliseconds = medianWarmMilliseconds("selected scenario", () => { computePointMetrics(scenario, state); });
const surfaceMilliseconds = medianWarmMilliseconds("setting surface", () => { buildSettingSurface(scenario, state); });
const frontierMilliseconds = medianWarmMilliseconds("frontier", () => { buildFrontier(scenario); });

const targets = [
  ["selected scenario", selectedMilliseconds, 100],
  ["setting surface", surfaceMilliseconds, 300],
  ["frontier", frontierMilliseconds, 2_000]
] as const;
for (const [label, observed, maximum] of targets) {
  if (observed > maximum) throw new Error(`${label} median ${observed.toFixed(1)} ms exceeds ${maximum} ms target`);
}
console.log(`Performance targets OK: selected ${selectedMilliseconds.toFixed(1)} ms; surface ${surfaceMilliseconds.toFixed(1)} ms; frontier ${frontierMilliseconds.toFixed(1)} ms.`);
