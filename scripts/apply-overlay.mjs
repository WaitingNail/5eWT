import fs from "node:fs";
import path from "node:path";
import {execFileSync, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const runtimePatch = path.join(projectRoot, "patches", "0026-zh-tw-v2.39.1-runtime.patch");
const imagePatch = path.join(projectRoot, "patches", "0027-zh-tw-v2.39.1-image-sources.patch");
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

const runGitApply = (patchPath, args) => execFileSync("git", ["apply", ...args, patchPath], {cwd: upstreamRoot, stdio: "inherit"});


if (!fs.readFileSync(path.join(upstreamRoot, "js/utils.js"), "utf8").includes("// 5eWT zh-TW runtime v2.39.1")) {
	runGitApply(runtimePatch, []);
}

if (spawnSync("git", ["apply", "--reverse", "--check", imagePatch], {cwd: upstreamRoot}).status !== 0) {
	runGitApply(imagePatch, []);
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
