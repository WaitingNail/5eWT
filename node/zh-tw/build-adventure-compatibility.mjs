import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baseline = "e5f3e77b303a92df10487207857200245e71957c";
const folder = path.join(root, "data/zh-TW/adventures");
const canonicalFolder = path.join(folder, "canonical-v2.33.3");
fs.mkdirSync(canonicalFolder, {recursive: true});
let count = 0;
for (const file of fs.readdirSync(folder).filter(it => /^adventure-.*\.json$/.test(it))) {
	const locale = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
	if (locale._meta?.upstreamTag !== "v2.33.3") throw new Error(`Unexpected adventure translation baseline: ${file}`);
	const bytes = execFileSync("git", ["show", `${baseline}:data/adventure/${file}`], {cwd: root, maxBuffer: 32 * 1024 * 1024});
	fs.writeFileSync(path.join(canonicalFolder, file), bytes);
	count++;
}
console.log(`Prepared ${count} exact canonical adventure snapshots for existing reviewed translations; v2.37.0 adventure sources remain intact.`);
