import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deterministicBuildIdentity } from "./build-identity.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const artifact = resolve(root, "dist/index.html");
const original = readFileSync(artifact);
let staleRejected = false;
try {
  writeFileSync(artifact, Buffer.concat([original, Buffer.from("\n<!-- deliberately stale -->\n")]));
  execFileSync(process.execPath, [resolve(root, "scripts/check-artifact.mjs")], { cwd: root, stdio: "pipe" });
} catch {
  staleRejected = true;
} finally {
  writeFileSync(artifact, original);
}
if (!staleRejected) throw new Error("Artifact checker accepted a deliberately stale artifact");

const hiddenSourceResidue = resolve(root, `src/.build-identity-negative-${process.pid}`);
const identityWithoutResidue = deterministicBuildIdentity(root);
try {
  writeFileSync(hiddenSourceResidue, "ignored filesystem residue\n");
  if (deterministicBuildIdentity(root) !== identityWithoutResidue) throw new Error("Ignored hidden source residue changed the deterministic build identity");
} finally {
  unlinkSync(hiddenSourceResidue);
}

const hashes = [];
for (const githubSha of ["1111111111111111111111111111111111111111", "2222222222222222222222222222222222222222"]) {
  execFileSync(process.execPath, [resolve(root, "scripts/build.mjs")], { cwd: root, env: { ...process.env, GITHUB_SHA: githubSha }, stdio: "pipe" });
  hashes.push(createHash("sha256").update(readFileSync(artifact)).digest("hex"));
}
if (hashes[0] !== hashes[1]) throw new Error("CI GITHUB_SHA changed the committed artifact");
console.log(`Release negative checks OK: stale artifact rejected; CI-like builds are byte-identical (${hashes[0]}).`);
