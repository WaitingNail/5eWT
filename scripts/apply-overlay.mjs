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
	"data/zh-TW/class.json",
	"js/zh-tw/class-i18n.js",
	"node/zh-tw/build-class-locale.mjs",
]) {
	const sourcePath = path.join(projectRoot, relativePath);
	const targetPath = path.join(upstreamRoot, relativePath);
	fs.mkdirSync(path.dirname(targetPath), {recursive: true});
	fs.copyFileSync(sourcePath, targetPath);
}

const runGitApply = args => execFileSync("git", ["apply", ...args, patchPath], {
	cwd: upstreamRoot,
	stdio: "inherit",
});

try {
	runGitApply(["--check"]);
	runGitApply([]);
	console.log("Applied zh-TW Classes overlay.");
} catch {
	try {
		runGitApply(["--reverse", "--check"]);
		console.log("zh-TW Classes overlay is already applied.");
	} catch {
		throw new Error("Classes overlay does not apply cleanly to the pinned upstream tag.");
	}
}
