import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const dist = resolve(root, "dist");
const artifact = resolve(dist, "index.html");
if (!existsSync(artifact)) throw new Error("Missing dist/index.html");
const entries = readdirSync(dist).filter((entry) => !entry.startsWith("."));
if (entries.length !== 1 || entries[0] !== "index.html") throw new Error(`dist must contain exactly index.html; found ${entries.join(", ")}`);
if (!statSync(artifact).isFile()) throw new Error("dist/index.html is not a file");
const html = readFileSync(artifact, "utf8");
for (const pattern of [/<script\s+[^>]*src=/i, /<link\s+[^>]*href=/i, /<img\s+[^>]*src=/i, /fetch\s*\(/i, /XMLHttpRequest/i, /import\s*\(/i]) {
  if (pattern.test(html)) throw new Error(`Self-contained artifact contains a runtime dependency matching ${pattern}`);
}
if (!html.includes("id=\"app\"")) throw new Error("Artifact does not contain the application mount point");
if (!html.includes("Rloc") && !html.includes("R_loc")) throw new Error("Artifact does not contain the model UI");
const hash = createHash("sha256").update(html).digest("hex");
console.log(`Artifact OK: ${artifact}`);
console.log(`SHA-256: ${hash}`);
