import fs from "node:fs";
import path from "node:path";
import {execFileSync, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const UPSTREAM_REPOSITORY = "https://github.com/5etools-mirror-3/5etools-src.git";
const UPSTREAM_TAG = "v2.41.0";
const UPSTREAM_COMMIT = "32ef600fab87a585a61dd1a22e9b02dfc58c728a";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(projectRoot, "vendor", "5etools-src");

function ensureAdventureBaseline () {
  try { execFileSync("git", ["cat-file", "-e", "e5f3e77b303a92df10487207857200245e71957c^{commit}"], {cwd: target, stdio: "pipe"}); } catch {
    execFileSync("git", ["fetch", "--depth", "1", "origin", "tag", "v2.33.3"], {cwd: target, stdio: "inherit"});
  }
}

function verifyCommit () {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {cwd: target, encoding: "utf8"}).trim();
  if (actual !== UPSTREAM_COMMIT) {
    throw new Error(`Unexpected upstream commit: ${actual}; expected ${UPSTREAM_COMMIT}`);
  }
}

if (fs.existsSync(target)) {
  if (!fs.existsSync(path.join(target, ".git"))) throw new Error("vendor/5etools-src exists but is not a Git checkout.");
  verifyCommit();
  ensureAdventureBaseline();
  console.log(`Pinned upstream is already present: ${target}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), {recursive: true});
const result = spawnSync("git", ["clone", "--branch", UPSTREAM_TAG, "--depth", "1", UPSTREAM_REPOSITORY, target], {stdio: "inherit"});
if (result.status !== 0) process.exit(result.status ?? 1);
verifyCommit();
ensureAdventureBaseline();
console.log(`Upstream ${UPSTREAM_TAG} is ready.`);
