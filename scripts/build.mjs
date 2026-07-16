import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const dist = resolve(root, "dist");
const temp = resolve(root, ".build");
rmSync(dist, { recursive: true, force: true });
rmSync(temp, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(temp, { recursive: true });

const bundlePath = resolve(temp, "app.js");
await build({
  entryPoints: [resolve(root, "src/app.ts")],
  outfile: bundlePath,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  absWorkingDir: root,
  logLevel: "error"
});

const css = readFileSync(resolve(root, "src/styles.css"), "utf8");
const js = readFileSync(bundlePath, "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'none';">
<title>Next-generation polio vaccine TPP generator</title>
<style>${css}</style>
</head>
<body><div id="app"></div><script>${js}</script></body>
</html>
`;
writeFileSync(resolve(dist, "index.html"), html);
if (!existsSync(resolve(dist, "index.html"))) throw new Error("Build did not produce dist/index.html");
console.log(`Wrote ${resolve(dist, "index.html")} (${Buffer.byteLength(html)} bytes)`);
