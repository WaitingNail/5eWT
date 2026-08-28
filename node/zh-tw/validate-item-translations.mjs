import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const sha256 = relative => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relative))).digest("hex");

const report = readJson("translation/zh-TW/items/generated/item-import-report.json");
const index = readJson("data/zh-TW/items/index.json");
const readItemSidecar = file => (index.fileChunks?.[file] || [file]).reduce((out, chunkFile) => {
	const chunk = readJson(`data/zh-TW/items/${chunkFile}`);
	if (!out._meta && chunk._meta) out._meta = structuredClone(chunk._meta);
	for (const [prop, entities] of Object.entries(chunk)) {
		if (prop === "_meta" || !Array.isArray(entities)) continue;
		(out[prop] ||= []).push(...entities);
	}
	return out;
}, {});
const expectedItemChunks = [
	...Array.from({length: 9}, (_, ix) => `items-${`${ix}`.padStart(3, "0")}.json`),
	"item-groups.json",
];
const expectedCounts = {
	item: 2428,
	itemGroup: 109,
	baseitem: 230,
	itemProperty: 26,
	itemType: 67,
	itemTypeAdditionalEntries: 2,
	itemEntry: 13,
	itemMastery: 8,
	magicvariant: 214,
	itemFluff: 948,
};

assert.equal(report.status, "pass");
assert.deepEqual(report.upstream, {
	tag: "v2.33.3",
	commit: "e5f3e77b303a92df10487207857200245e71957c",
});
assert.equal(report.source.repository, "https://github.com/tjliqy/5etools-cn");
assert.equal(report.source.commit, "46b15d04f548c23c526084deae078e3568500349");
assert.equal(report.source.license, "CC BY-NC-SA 4.0");
assert.deepEqual(report.counts, expectedCounts);
assert.deepEqual(index.entityCounts, expectedCounts);
assert.deepEqual(index.files, ["items.json", "items-base.json", "magicvariants.json", "fluff-items.json"]);
assert.deepEqual(index.fileChunks, {"items.json": expectedItemChunks});
assert.equal(fs.existsSync(path.join(ROOT, "data/zh-TW/items/items.json")), false, "monolithic item sidecar should not be generated");

for (const key of [
	"unmatchedEnglishEntities",
	"unmatchedTranslatedEntities",
	"arrayShapeMismatches",
	"typeShapeMismatches",
	"tagShapeMismatches",
	"unmatchedTranslatedTags",
	"tagCanonicalDifferences",
	"diceDifferences",
	"numericUnresolved",
	"untranslatedVisibleStrings",
]) assert.deepEqual(report.qa[key], [], `Expected report.qa.${key} to be empty`);

assert.equal(report.qa.numericDifferencesRawCount, 362);
assert.equal(report.qa.numericEquivalentDifferences.length, 362);
assert.equal(report.qa.tagShapeDifferencesResolved.length, 80);
assert.ok(report.qa.sourceRepairsApplied.length >= 30);

const specs = [
	["items.json", ["item", "itemGroup"]],
	["items-base.json", ["baseitem", "itemProperty", "itemType", "itemTypeAdditionalEntries", "itemEntry", "itemMastery"]],
	["magicvariants.json", ["magicvariant"]],
	["fluff-items.json", ["itemFluff"]],
];
let localizedNames = 0;

for (const [file, props] of specs) {
	const guard = report.guards[file];
	assert.ok(guard, `Missing English guard for ${file}`);
	assert.equal(guard.byteIdentical, true, `${file} source backup differs from pinned upstream`);
	assert.equal(sha256(`data/${file}`), guard.localEnglishSha256, `${file} upstream hash changed`);

	const canonical = readJson(`data/${file}`);
	const localized = readItemSidecar(file);
	for (const prop of props) {
		assert.equal(localized[prop].length, canonical[prop].length, `${file}/${prop} count changed`);
		localized[prop].forEach((entity, ix) => {
			const original = canonical[prop][ix];
			if (typeof original.name !== "string") return;
			assert.equal(entity.ENG_name, original.name, `${file}/${prop}/${ix} identity backup mismatch`);
			assert.notEqual(entity.name, entity.ENG_name, `${file}/${prop}/${ix} visible name remained English`);
			localizedNames++;
		});
	}
}

assert.equal(localizedNames, 4020);
console.log("Item translation validation: PASS");
console.log("3,097 item rules entities; 948 item fluff entries; 4,020 localized names.");
