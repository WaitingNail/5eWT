import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const [command, ...args] = process.argv.slice(2);

if (!command) throw new Error("Missing command.");
if (!fs.existsSync(path.join(upstreamRoot, ".git"))) {
  throw new Error("Missing vendor/5etools-src. Run npm run bootstrap and npm run apply first.");
}

const result = spawnSync(command, args, {
  cwd: upstreamRoot,
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

