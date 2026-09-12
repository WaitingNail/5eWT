import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const patchPaths = [
	path.join(projectRoot, "patches", "0001-zh-tw-classes-runtime.patch"),
	path.join(projectRoot, "patches", "0002-zh-tw-items-runtime.patch"),
	path.join(projectRoot, "patches", "0003-zh-tw-monsters-runtime.patch"),
	path.join(projectRoot, "patches", "0004-zh-tw-monster-copy-identity.patch"),
	path.join(projectRoot, "patches", "0005-zh-tw-character-options-and-item-list-runtime.patch"),
	path.join(projectRoot, "patches", "0006-zh-tw-small-fragments-and-bastions.patch"),
	path.join(projectRoot, "patches", "0007-zh-tw-bilingual-names-and-bestiary-loading.patch"),
	path.join(projectRoot, "patches", "0008-zh-tw-dice-init-binding.patch"),
	path.join(projectRoot, "patches", "0009-zh-tw-subclass-and-item-entry-headings.patch"),
];
const copyRoots = [
  "requirements-zh-tw.txt",
  "data/zh-TW",
  "js/zh-tw",
  "node/zh-tw",
  "translation/zh-TW",
  "docs/zh-tw",
  "reports",
];

if (!fs.existsSync(path.join(upstreamRoot, ".git"))) {
  throw new Error("Missing vendor/5etools-src. Run npm run bootstrap first.");
}

function copyRecursive (sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, {recursive: true});
    for (const child of fs.readdirSync(sourcePath)) copyRecursive(path.join(sourcePath, child), path.join(targetPath, child));
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  fs.copyFileSync(sourcePath, targetPath);
}

for (const relativePath of copyRoots) {
  const sourcePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing overlay asset: ${relativePath}`);
  copyRecursive(sourcePath, path.join(upstreamRoot, relativePath));
}

const canGitApply = (patchPath, args) => {
  try {
    execFileSync("git", ["apply", ...args, "--check", patchPath], {cwd: upstreamRoot, stdio: "pipe"});
    return true;
  } catch {
    return false;
  }
};
const runGitApply = (patchPath, args) => execFileSync("git", ["apply", ...args, patchPath], {cwd: upstreamRoot, stdio: "inherit"});


// The runtime patches intentionally overlap (later stages extend shared data
// loading and rendering code). If the final patch can be reversed, the whole
// ordered stack is already present; checking older patches independently would
// fail because their context has since been extended by the newer patches.
if (!canGitApply(patchPaths.at(-1), ["--reverse"])) {
	for (const patchPath of patchPaths) {
		if (canGitApply(patchPath, [])) {
			runGitApply(patchPath, []);
		} else if (!canGitApply(patchPath, ["--reverse"])) {
			throw new Error(`zh-TW overlay patch does not apply cleanly: ${path.basename(patchPath)}`);
		}
	}
}

execFileSync(
	process.execPath,
	[path.join(upstreamRoot, "node", "zh-tw", "apply-site-i18n-html.mjs")],
	{cwd: upstreamRoot, stdio: "inherit"},
);

console.log("Applied zh-TW interface, bilingual entity names, Class, rules, spells, character-options, items, monsters, and Bastions overlay; assets were refreshed.");
