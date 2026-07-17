import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export function deterministicBuildIdentity(root = resolve(new URL("..", import.meta.url).pathname)) {
  const inputs = [
    ...collect(resolve(root, "src")),
    resolve(root, "package.json"),
    resolve(root, "package-lock.json"),
    resolve(root, "scripts/build.mjs"),
    resolve(root, "scripts/build-identity.mjs")
  ].sort();
  const hash = createHash("sha256");
  for (const path of inputs) {
    hash.update(relative(root, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return `source-${hash.digest("hex").slice(0, 16)}`;
}

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collect(path) : [path];
  });
}
