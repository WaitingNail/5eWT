import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const required = [
  "classes.html",
  "data/zh-TW/class.json",
  "data/zh-TW/class/index.json",
  "js/zh-tw/class-i18n.js",
  "js/zh-tw/class-body-i18n.js",
  "node/zh-tw/test-class-i18n.mjs",
  "node/zh-tw/test-class-body-i18n-full.mjs",
  "node/zh-tw/validate-full-class-translations.mjs",
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(upstreamRoot, relativePath))) throw new Error(`Missing applied file: ${relativePath}`);
}

const runNode = script => execFileSync(process.execPath, [script], {cwd: upstreamRoot, stdio: "inherit"});
for (const script of [
  "js/classes.js",
  "js/render-class.js",
  "js/render.js",
  "js/zh-tw/class-i18n.js",
  "js/zh-tw/class-body-i18n.js",
]) execFileSync(process.execPath, ["--check", script], {cwd: upstreamRoot, stdio: "inherit"});

runNode("node/zh-tw/test-class-i18n.mjs");
runNode("node/zh-tw/test-class-body-i18n.mjs");
runNode("node/zh-tw/test-class-body-i18n-full.mjs");
runNode("node/zh-tw/validate-full-class-translations.mjs");
execFileSync("git", ["diff", "--check"], {cwd: upstreamRoot, stdio: "inherit"});
console.log("zh-TW Class overlay verification passed.");
