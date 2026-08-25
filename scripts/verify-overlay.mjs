import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const patchPath = path.join(projectRoot, "patches", "0001-zh-tw-classes-runtime.patch");
const expectedCommit = "e5f3e77b303a92df10487207857200245e71957c";

if (!fs.existsSync(path.join(upstreamRoot, ".git"))) {
  throw new Error("Missing vendor/5etools-src. Run npm run bootstrap and npm run apply first.");
}

const run = (command, args) => execFileSync(command, args, {
  cwd: upstreamRoot,
  stdio: "inherit",
});

const actualCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: upstreamRoot,
  encoding: "utf8",
}).trim();
if (actualCommit !== expectedCommit) {
  throw new Error("Unexpected upstream commit: " + actualCommit);
}

run("git", ["apply", "--reverse", "--check", patchPath]);
for (const file of [
  "js/classes.js",
  "js/filter-classes.js",
  "js/render-class.js",
  "js/render.js",
  "js/utils.js",
  "js/zh-tw/class-i18n.js",
  "js/zh-tw/class-body-i18n.js",
  "node/zh-tw/build-class-locale.mjs",
  "node/zh-tw/test-class-body-i18n.mjs",
  "node/zh-tw/test-class-body-i18n-full.mjs",
  "node/zh-tw/validate-full-class-translations.mjs",
]) {
  run("node", ["--check", file]);
}
run("node", ["node/zh-tw/test-class-body-i18n.mjs"]);
run("node", ["node/zh-tw/test-class-body-i18n-full.mjs"]);
run("node", ["node/zh-tw/validate-full-class-translations.mjs"]);
run("git", ["diff", "--check"]);
console.log("Complete zh-TW Classes overlay verification passed.");

