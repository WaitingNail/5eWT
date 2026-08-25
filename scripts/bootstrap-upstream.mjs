import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const target = path.resolve("vendor", "5etools-src");
if (fs.existsSync(target)) {
  console.log(`Upstream already exists: ${target}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), {recursive: true});
const result = spawnSync("git", [
  "clone",
  "--branch", "v2.33.3",
  "--depth", "1",
  "https://github.com/5etools-mirror-3/5etools-src.git",
  target,
], {stdio: "inherit"});

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Upstream v2.33.3 is ready.");
