import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const sha256 = relative => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relative))).digest("hex");

const report = readJson("translation/zh-TW/bestiary/generated/monster-import-report.json");
const index = readJson("data/zh-TW/bestiary/index.json");
const expectedCounts = {
	monster: 4528,
	monsterFluff: 4063,
	legendaryGroup: 187,
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
assert.equal(index.files.length, 200);
assert.equal(new Set(index.files).size, index.files.length, "Bestiary index contains duplicate files");
assert.ok(index.files.includes("bestiary-mm.json"));
assert.ok(index.files.includes("bestiary-xmm.json"));
assert.ok(index.files.includes("fluff-bestiary-mm.json"));
assert.ok(index.files.includes("legendarygroups.json"));

assert.deepEqual(report.canonicalFailures, []);
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

assert.equal(report.qa.numericDifferencesRawCount, 456);
assert.equal(report.qa.numericEquivalentDifferences.length, 456);
assert.equal(report.qa.tagShapeDifferencesResolved.length, 247);
assert.ok(report.qa.sourceRepairsApplied.length >= 20);

const actualCounts = {monster: 0, monsterFluff: 0, legendaryGroup: 0};
let namesChecked = 0;
let localizedNames = 0;

for (const file of index.files) {
	const relativeCanonical = file === "legendarygroups.json"
		? "bestiary/legendarygroups.json"
		: `bestiary/${file}`;
	const guard = report.guards[relativeCanonical];
	assert.ok(guard, `Missing English guard for ${relativeCanonical}`);
	assert.equal(guard.byteIdentical, true, `${relativeCanonical} source backup differs from pinned upstream`);
	assert.equal(sha256(`data/${relativeCanonical}`), guard.localEnglishSha256, `${relativeCanonical} upstream hash changed`);

	const canonical = readJson(`data/${relativeCanonical}`);
	const localized = readJson(`data/zh-TW/bestiary/${file}`);
	for (const prop of ["monster", "monsterFluff", "legendaryGroup"]) {
		if (!canonical[prop]) continue;
		assert.equal(localized[prop].length, canonical[prop].length, `${file}/${prop} count changed`);
		actualCounts[prop] += localized[prop].length;
		localized[prop].forEach((entity, ix) => {
			const original = canonical[prop][ix];
			if (typeof original.name !== "string") return;
			assert.equal(entity.ENG_name, original.name, `${file}/${prop}/${ix} identity backup mismatch`);
			assert.equal(typeof entity.name, "string", `${file}/${prop}/${ix} missing localized name`);
			assert.ok(entity.name.trim(), `${file}/${prop}/${ix} has an empty localized name`);
			namesChecked++;
			if (entity.name !== entity.ENG_name) localizedNames++;
		});
	}
}

assert.deepEqual(actualCounts, expectedCounts);
assert.equal(namesChecked, 8778);
assert.equal(localizedNames, 8774, "Only machine identifiers R04M and X01 may retain their canonical names");

console.log("Monster translation validation: PASS");
console.log("4,528 monster stat blocks; 4,063 fluff entries; 187 legendary groups; canonical rules preserved.");
