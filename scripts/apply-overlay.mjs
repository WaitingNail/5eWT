import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const patchPaths = [path.join(projectRoot, "patches", "0020-zh-tw-v2.37.0-runtime.patch")];
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

for (const script of ["build-utility-ui-data.mjs", "apply-prior-page-repairs.mjs"]) {
  execFileSync(process.execPath, [path.join(projectRoot, "node", "zh-tw", script)], {cwd: projectRoot, stdio: "inherit"});
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
if (!fs.readFileSync(path.join(upstreamRoot, "js/utils.js"), "utf8").includes("// 5eWT zh-TW runtime v2.37.0")) {
	for (const patchPath of patchPaths) {
		if (canGitApply(patchPath, [])) {
			runGitApply(patchPath, []);
		} else if (!canGitApply(patchPath, ["--reverse"])) {
			throw new Error(`zh-TW overlay patch does not apply cleanly: ${path.basename(patchPath)}`);
		}
	}
}

// Follow-up patches are checked separately from the pinned upstream overlay.
for (const relativePath of ["patches/0021-zh-tw-page-list-fixes.patch", "patches/0022-zh-tw-class-sidecar-loader.patch", "patches/0023-zh-tw-page-completions.patch"]) {
	const patchPath = path.join(projectRoot, relativePath);
	// 0023 advances the Class module cache key introduced by 0022.
	if (relativePath.endsWith("0022-zh-tw-class-sidecar-loader.patch") && canGitApply(path.join(projectRoot, "patches/0023-zh-tw-page-completions.patch"), ["--reverse"])) continue;
	if (canGitApply(patchPath, [])) runGitApply(patchPath, []);
	else if (!canGitApply(patchPath, ["--reverse"])) throw new Error(`zh-TW follow-up patch does not apply cleanly: ${relativePath}`);
}

execFileSync(process.execPath, [path.join(upstreamRoot, "node/zh-tw/build-adventure-compatibility.mjs")], {cwd: upstreamRoot, stdio: "inherit"});

execFileSync(process.execPath, [path.join(upstreamRoot, "node/zh-tw/apply-reviewed-site-semantics.mjs")], {cwd: upstreamRoot, stdio: "inherit"});

const deployedImageRoot = "https://raw.githubusercontent.com/WaitingNail/5eWT-img/main/";
const utilsPath = path.join(upstreamRoot, "js", "utils.js");
const utilsSource = fs.readFileSync(utilsPath, "utf8");
const imageRootAssignment = /globalThis\.DEPLOYED_IMG_ROOT\s*=\s*(?:undefined|["'][^"']*["']);/g;
const imageRootMatches = [...utilsSource.matchAll(imageRootAssignment)];
if (imageRootMatches.length !== 1) {
	throw new Error(`Expected one DEPLOYED_IMG_ROOT assignment in ${path.relative(projectRoot, utilsPath)}, found ${imageRootMatches.length}.`);
}
const utilsLocalized = utilsSource.replace(
	imageRootAssignment,
	`globalThis.DEPLOYED_IMG_ROOT = "${deployedImageRoot}";`,
);
if (utilsLocalized !== utilsSource) fs.writeFileSync(utilsPath, utilsLocalized);

execFileSync(
	process.execPath,
	[path.join(upstreamRoot, "node", "zh-tw", "apply-site-i18n-html.mjs")],
	{cwd: upstreamRoot, stdio: "inherit"},
);

console.log(`Applied zh-TW interface, bilingual entity names, Class, rules, spells, character-options, items, monsters, Bastions, cults/boons, reference pages, adventures, vehicles, recipes, homecrafts, and psionics overlay; images use ${deployedImageRoot}`);
