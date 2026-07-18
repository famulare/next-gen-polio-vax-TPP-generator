import { clearSettingSurfaceCache, defaultScenario, evaluateScenario, settingSurfaceCacheStats } from "../src/model/model";
import { SETTING_DISPLAY_DOMAIN } from "../src/model/parameters";
import { clearTransmissionCaches, transmissionCacheStats } from "../src/model/transmission";

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error("Cache memory check requires node --expose-gc");
const mebibyte = 1024 * 1024;
const maximumRetainedGrowth = 128 * mebibyte;

clearTransmissionCaches();
clearSettingSurfaceCache();
gc();
const baseline = process.memoryUsage().arrayBuffers;
for (let index = 0; index < 12; index += 1) {
  evaluateDistinctEnvelope(index);
  gc();
}
gc();
const retained = process.memoryUsage().arrayBuffers;
const growth = retained - baseline;
const stats = transmissionCacheStats();
const surfaceStats = settingSurfaceCacheStats();
if (growth > maximumRetainedGrowth) throw new Error(`Transmission recomputation retained ${(growth / mebibyte).toFixed(1)} MiB of ArrayBuffers`);
if (stats.linkKernels > stats.capacity || stats.sheddingProfiles > stats.capacity || stats.perExposureProfiles > stats.capacity) throw new Error("Transmission cache exceeded its declared capacity");
if (surfaceStats.entries > surfaceStats.capacity) throw new Error("Setting-surface cache exceeded its declared capacity");
console.log(`Cache memory OK: retained ArrayBuffer growth ${(growth / mebibyte).toFixed(1)} MiB; entries ${JSON.stringify({ ...stats, settingSurfaces: surfaceStats.entries, settingSurfaceCapacity: surfaceStats.capacity })}.`);

function evaluateDistinctEnvelope(index: number): void {
  const scenario = defaultScenario();
  const fraction = index / 11;
  const exposure = SETTING_DISPLAY_DOMAIN.exposure.min
    * (SETTING_DISPLAY_DOMAIN.exposure.max / SETTING_DISPLAY_DOMAIN.exposure.min) ** fraction;
  scenario.envelope.TihMin = exposure;
  scenario.envelope.TihMax = exposure;
  scenario.envelope.ThsMin = exposure;
  scenario.envelope.ThsMax = exposure;
  void evaluateScenario(scenario);
}
