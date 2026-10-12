import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const coverage = read("translation/zh-TW/upstream-v2.37.0/coverage.json");
assert.equal(coverage.upstream.tag, "v2.37.0");
assert.equal(coverage.upstream.commit, "8c026b807fac21862a309379a0c3228a0683198b");
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], {cwd: ROOT, encoding: "utf8"}).trim(), coverage.upstream.commit);
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "data"], {cwd: ROOT, stdio: "pipe"});
assert.deepEqual(read("translation/zh-TW/upstream-v2.37.0/pending.json"), []);
const qa = read("translation/zh-TW/upstream-v2.37.0/candidate-qa.json");
assert.ok(qa.every(it => it.kind === "tagShapeMismatches"), "Unresolved numeric/dice/reference changes");

const protectedKeys = new Set([
	"source", "page", "type", "id", "uid", "hash", "href", "path", "url", "level", "school", "edition",
	"className", "classSource", "subclassShortName", "subclassSource", "raceName", "raceSource",
	"classFeature", "subclassFeature", "classFeatures", "subclassFeatures", "reprintedAs", "set", "abbreviation",
	"range", "duration", "savingThrow", "damageInflict", "skill", "cr", "str", "dex", "con", "int", "wis", "cha",
]);
const issues = [];
let entities = 0;
const guards = {};
const walk = (en, zh, ctx, key = "") => {
	if (typeof en === "number" || typeof en === "boolean") {
		if (en !== zh) issues.push({ctx, reason: "numeric-or-boolean-changed"});
		return;
	}
	if (Array.isArray(en)) {
		if (!Array.isArray(zh) || en.length !== zh.length) { issues.push({ctx, reason: "array-shape"}); return; }
		en.forEach((v, i) => walk(v, zh[i], `${ctx}/${i}`, key));
		return;
	}
	if (!en || typeof en !== "object") {
		if (protectedKeys.has(key) && en !== zh) issues.push({ctx, reason: "canonical-string-changed", en, zh});
		return;
	}
	if (!zh || typeof zh !== "object") { issues.push({ctx, reason: "missing-object"}); return; }
	for (const [k, v] of Object.entries(en)) {
		if (!(k in zh)) issues.push({ctx: `${ctx}/${k}`, reason: "missing-key"});
		else walk(v, zh[k], `${ctx}/${k}`, k);
	}
};
for (const folder of Object.keys(coverage.counts)) {
	const index = read(`data/zh-TW/${folder}/index.json`);
	assert.equal(index._meta.upstreamTag, "v2.37.0");
	const totals = {};
	for (const file of index.files) {
		const canonicalPath = ["spells", "class", "bestiary"].includes(folder) ? `data/${folder}/${file}` : `data/${file}`;
		// Utility generator manifests also retain older, unchanged generator files.
		if (!fs.existsSync(path.join(ROOT, canonicalPath))) continue;
		const en = read(canonicalPath);
		const chunks = index.fileChunks?.[file] || [file];
		const zh = {};
		for (const chunk of chunks) for (const [prop, values] of Object.entries(read(`data/zh-TW/${folder}/${chunk}`))) {
			if (Array.isArray(values)) (zh[prop] ||= []).push(...values);
		}
		guards[canonicalPath] = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, canonicalPath))).digest("hex");
		for (const [prop, values] of Object.entries(zh)) {
			if (!Array.isArray(en[prop])) continue;
			assert.equal(values.length, en[prop].length, `${canonicalPath}/${prop}`);
			totals[prop] = (totals[prop] || 0) + values.length;
			values.forEach((localized, i) => {
				const original = en[prop][i];
				if (!original || typeof original !== "object") return;
				if (original.name && folder !== "utility-pages") assert.equal(localized.ENG_name, original.name, `${canonicalPath}/${prop}/${i} identity`);
				if (original.name && folder === "utility-pages") assert.equal(localized.name, original.name, `${canonicalPath}/${prop}/${i} utility identity`);
				walk(original, localized, `${canonicalPath}/${prop}/${i}`);
				entities++;
			});
		}
	}
	assert.deepEqual(totals, coverage.counts[folder], `${folder} current counts`);
}
assert.deepEqual(issues, [], JSON.stringify(issues.slice(0, 20)));
console.log(`v2.37.0 source, identities, array shapes, numeric rules and translation coverage: PASS (${entities} entities)`);
