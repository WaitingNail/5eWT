import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {review, normalizeText, normalizeTree} from "./apply-reviewed-site-semantics.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cache = new Map();
const read = file => { if (!cache.has(file)) cache.set(file, JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"))); return cache.get(file); };
const get = (obj, ptr) => ptr.split("/").reduce((v, k) => v?.[k], obj);
const strings = (obj, out = []) => {
	if (typeof obj === "string") out.push(obj);
	else if (Array.isArray(obj)) obj.forEach(v => strings(v, out));
	else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (!k.startsWith("ENG_") && !["_copy", "_meta"].includes(k)) strings(v, out);
	return out;
};
const signature = text => [...text.matchAll(/\{@(condition|variantrule|skill|action|status|spell|creature|item|dc|dice|damage|hit|atk) ([^{}]+)\}/gu)]
	.map(([, type, payload]) => { const parts = payload.split("|"); return [type, parts[0].toLowerCase(), ...["dc", "dice", "damage", "hit", "atk"].includes(type) ? [] : [(parts[1] || "").toLowerCase()]].join("|"); }).sort();
const sourceStrings = new Map();
for (const record of review.corrections) {
	if (!sourceStrings.has(record.sourceFile)) sourceStrings.set(record.sourceFile, new Set(strings(read(record.sourceFile))));
	assert.ok(sourceStrings.get(record.sourceFile).has(record.english), `Source drift: ${record.file}:${record.path}`);
	assert.equal(get(read(record.file), record.path), normalizeText(record.after), `Reviewed meaning regressed: ${record.file}:${record.path}`);
	assert.deepEqual(signature(record.after), signature(record.english), `Rule targets, roll formulas, or reference multiplicity changed: ${record.file}:${record.path}`);
}
for (const record of review.positiveControls) assert.equal(get(read(record.file), record.path), normalizeText(record.before), `Correct master sense changed: ${record.file}:${record.path}`);
await import("../../js/zh-tw/content-i18n.js");
for (const [condition, [label]] of Object.entries(review.terms.condition)) {
	assert.equal(globalThis.I18nZhTwContent.getCondition(condition), label);
	for (const entry of read("data/zh-TW/rules/conditionsdiseases.json").condition.filter(e => e.ENG_name?.toLowerCase() === condition)) assert.equal(entry.name, label, `Condition name differs across editions: ${condition} ${entry.source}`);
}
const allLabels = new Set(Object.values(review.terms.condition).flatMap(([label, aliases]) => [label, ...aliases]));
let fileCount = 0, conditionTags = 0;
function scan (folder) {
	for (const entry of fs.readdirSync(folder, {withFileTypes: true})) {
		if (entry.name === "canonical-v2.33.3") continue;
		const file = path.join(folder, entry.name);
		if (entry.isDirectory()) { scan(file); continue; }
		if (!file.endsWith(".json")) continue;
		++fileCount;
		for (const text of strings(JSON.parse(fs.readFileSync(file, "utf8")))) for (const [, payload] of text.matchAll(/\{@condition ([^{}]+)\}/gu)) {
			const [name, , display] = payload.split("|");
			const term = review.terms.condition[name.toLowerCase()];
			if (!term || !display || !allLabels.has(display)) continue; // Preserve contextual links, e.g. "Appendix A".
			++conditionTags;
			assert.equal(display, term[0], `${file}: wrong condition meaning or inconsistent label: ${payload}`);
		}
	}
}
scan(path.join(ROOT, "data/zh-TW"));
const fixture = {name:"Test", source:"XPHB", level:5, ENG_name:"Test", entries:["{@condition Incapacitated|XPHB|無力}"], _copy:{name:"Test", entries:["無力狀態"]}};
const original = structuredClone(fixture); normalizeTree(fixture);
assert.deepEqual(signature(fixture.entries[0]), signature(original.entries[0]));
assert.deepEqual(fixture._copy, original._copy); assert.equal(fixture.level, 5); assert.equal(fixture.ENG_name, "Test");
assert.deepEqual(normalizeTree(structuredClone(fixture)), fixture, "Terminology normalization must be idempotent");
console.log(JSON.stringify({reviewedCorrections:review.corrections.length, positiveControls:review.positiveControls.length, scannedFiles:fileCount, conditionTags, sourceGuards:"passed", mechanicsAndReferenceMultisets:"passed", shared2014And2024Terminology:"passed", scope:"targeted semantic review; not full-site sentence-by-sentence certification"}));
