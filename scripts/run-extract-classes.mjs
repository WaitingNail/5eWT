import path from "node:path";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.ZH_TW_UPSTREAM_ROOT = path.join(projectRoot, "vendor", "5etools-src");
await import("../node/zh-tw/extract-class-terms.mjs");
