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
requireCondition(manifest.section15KernelParitySatisfied === true, "Section 15.1 kernel-parity manifest must pass the amended gate");
requireCondition(manifest.section152CalibrationSatisfied === true, "Committed calibration artifact must satisfy Section 15.2");
requireCondition(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0, "Reference-fixture manifest has no artifacts");
requireCondition(Array.isArray(manifest.remainingRequiredCoverage) && manifest.remainingRequiredCoverage.length === 0, "All amended release-gate coverage must be present");
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

function expectedProduct(values) {
  return values.reduce((product, value) => product * value, 1);
}

function readCoverageFixture(name) {
  const record = manifest.kernelCoverage?.[name];
  requireCondition(record && typeof record.path === "string" && typeof record.caseProperty === "string" && typeof record.gridProperty === "string", `Missing ${name} coverage record`);
  const fixture = readJson(record.path);
  const cases = fixture[record.caseProperty];
  const grid = fixture[record.gridProperty];
  requireCondition(Array.isArray(cases) && grid && typeof grid === "object", `Malformed ${name} coverage fixture`);
  return { cases, grid };
}

const susceptibilityCoverage = readCoverageFixture("susceptibility");
requireCondition(
  susceptibilityCoverage.grid.systematicCaseCount === expectedProduct([
    susceptibilityCoverage.grid.alphas.length,
    susceptibilityCoverage.grid.betas.length,
    susceptibilityCoverage.grid.doseLabels.length,
    susceptibilityCoverage.grid.strains.length,
    susceptibilityCoverage.grid.everInfected.length
  ]),
  "Susceptibility grid metadata has the wrong Cartesian size"
);
requireCondition(susceptibilityCoverage.cases.length >= susceptibilityCoverage.grid.systematicCaseCount, "Susceptibility fixture omits systematic grid cases");

const takeCoverage = readCoverageFixture("vaccineTake");
requireCondition(
  takeCoverage.grid.systematicCaseCount === expectedProduct([
    takeCoverage.grid.alphas.length,
    takeCoverage.grid.betas.length,
    takeCoverage.grid.dosesTCID50.length,
    takeCoverage.grid.takeContexts.length
  ]) && takeCoverage.cases.length === takeCoverage.grid.systematicCaseCount,
  "Vaccine-take fixture does not cover its declared Cartesian grid"
);

const boostCoverage = readCoverageFixture("comparatorBoost");
requireCondition(
  boostCoverage.grid.systematicCaseCount === expectedProduct([boostCoverage.grid.mu0Values.length, boostCoverage.grid.everInfected.length])
    && boostCoverage.cases.length === boostCoverage.grid.systematicCaseCount,
  "Boost fixture does not cover its declared Cartesian grid"
);

const scheduleCoverage = readCoverageFixture("schedule");
requireCondition(scheduleCoverage.grid.length === 3 && scheduleCoverage.cases.length === scheduleCoverage.grid.length * 12, "Schedule fixture must cover low/default/high products and every selected schedule");

const sheddingCoverage = readCoverageFixture("shedding");
requireCondition(
  sheddingCoverage.grid.systematicCaseCount === expectedProduct([
    sheddingCoverage.grid.sourceBins.length,
    sheddingCoverage.grid.daysSinceInfection.length,
    sheddingCoverage.grid.agesMonths.length
  ]) && sheddingCoverage.cases.length === sheddingCoverage.grid.systematicCaseCount,
  "Shedding fixture does not cover its declared Cartesian grid"
);

console.log(`Reference fixtures OK: ${manifest.artifacts.length} Section 15.1 artifact(s) and the Section 15.2 calibration gate pass.`);
