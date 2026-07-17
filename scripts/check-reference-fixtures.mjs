import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(projectRoot, relativePath), "utf8"));
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(resolve(projectRoot, relativePath))).digest("hex");
}

const provenance = readJson("src/data/provenance.json");
const manifest = readJson("reference/fixtures/manifest-v1.json");

requireCondition(manifest.schemaVersion === "ReferenceFixtureV1", "Unexpected reference-fixture manifest schema");
requireCondition(manifest.section15KernelParitySatisfied === false, "Partial fixtures must not claim Section 15.1 parity");
requireCondition(manifest.section152CalibrationSatisfied === true, "Committed calibration artifact must satisfy Section 15.2");
requireCondition(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0, "Reference-fixture manifest has no artifacts");
requireCondition(Array.isArray(manifest.remainingRequiredCoverage) && manifest.remainingRequiredCoverage.length > 0, "Partial-fixture manifest must name missing coverage");
requireCondition(
  manifest.calibrationArtifact?.path === "reference/fixtures/calibration-report-v1.json"
    && manifest.calibrationArtifact?.schemaVersion === "DistributionNativePrevalenceCalibrationReportV1"
    && manifest.calibrationArtifact?.calibrationGateSatisfied === true
    && sha256(manifest.calibrationArtifact.path) === manifest.calibrationArtifact.sha256,
  "Calibration artifact is missing, stale, or does not pass its gate"
);

for (const source of manifest.sourceRepositories ?? []) {
  requireCondition(
    source.commit === provenance.sourceCommits?.[source.repository],
    `Fixture manifest commit does not match provenance for ${source.repository}`
  );
}

for (const artifact of manifest.artifacts) {
  requireCondition(typeof artifact.path === "string" && typeof artifact.sha256 === "string", "Malformed fixture artifact record");
  requireCondition(sha256(artifact.path) === artifact.sha256, `Fixture hash mismatch: ${artifact.path}`);
  const fixture = readJson(artifact.path);
  requireCondition(fixture.schemaVersion === artifact.schemaVersion, `Fixture schema mismatch: ${artifact.path}`);
  requireCondition(fixture.releaseGateSatisfied === false, `Partial fixture must not claim release eligibility: ${artifact.path}`);
  requireCondition(typeof fixture.source?.repository === "string", `Fixture source repository is missing: ${artifact.path}`);
  const sourceCommitKey = {
    "india-polio": "indiaPolio",
    cessationStability: "cessationStability"
  }[fixture.source.repository];
  requireCondition(typeof sourceCommitKey === "string", `Unknown fixture source repository: ${fixture.source.repository}`);
  requireCondition(
    fixture.source?.commit === provenance.sourceCommits?.[sourceCommitKey],
    `Fixture source commit does not match provenance: ${artifact.path}`
  );
  requireCondition(
    fixture.source?.sourceFilesRead?.every((file) => provenance.sourceFiles?.includes(file)),
    `Fixture reads an undeclared source file: ${artifact.path}`
  );
}

console.log(`Reference fixtures OK: ${manifest.artifacts.length} partial Section 15.1 artifact(s); Section 15.2 calibration passes.`);
