import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const patchPath = path.join(projectRoot, "patches", "0001-zh-tw-classes-runtime.patch");

if (!fs.existsSync(path.join(upstreamRoot, ".git"))) {
  throw new Error("Missing vendor/5etools-src. Run npm run bootstrap first.");
}

for (const relativePath of [
  "requirements-zh-tw.txt",
  "data/zh-TW",
  "js/zh-tw/class-i18n.js",
  "js/zh-tw/class-body-i18n.js",
  "node/zh-tw",
  "translation/zh-TW",
  "reports",
]) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(upstreamRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  if (fs.statSync(sourcePath).isDirectory()) {
    fs.cpSync(sourcePath, targetPath, {recursive: true, force: true});
  } else {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

const runGitApply = (args, {stdio = "inherit"} = {}) => execFileSync("git", ["apply", ...args, patchPath], {
  cwd: upstreamRoot,
  stdio,
});

try {
  runGitApply(["--check"], {stdio: "pipe"});
  runGitApply([]);
  console.log("Applied the complete zh-TW Classes overlay.");
} catch {
  try {
    runGitApply(["--reverse", "--check"], {stdio: "pipe"});
    console.log("The zh-TW Classes runtime patch is already applied; sidecars were refreshed.");
  } catch {
    throw new Error("Classes overlay does not apply cleanly to the pinned upstream tag.");
  }
}
