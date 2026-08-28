import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const sha256 = relative => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relative))).digest("hex");

const report = readJson("translation/zh-TW/spells/generated/spell-import-report.json");
const index = readJson("data/zh-TW/spells/index.json");

assert.equal(report.status, "pass");
assert.deepEqual(report.upstream, {
	tag: "v2.33.3",
	commit: "e5f3e77b303a92df10487207857200245e71957c",
});
assert.equal(report.source.repository, "https://github.com/tjliqy/5etools-cn");
assert.equal(report.source.commit, "46b15d04f548c23c526084deae078e3568500349");
assert.equal(report.source.license, "CC BY-NC-SA 4.0");
assert.deepEqual(report.counts, {spell: 936, spellFluff: 89});
assert.deepEqual(index.entityCounts, report.counts);
assert.equal(index.files.length, 26);
assert.equal(Object.keys(report.guards).length, 26);
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

assert.equal(report.qa.numericDifferencesRawCount, 389);
assert.equal(report.qa.numericEquivalentDifferences.length, 389);
assert.equal(report.qa.tagShapeDifferencesResolved.length, 21);
assert.equal(report.qa.sourceRepairsApplied.length, 54);

let spellCount = 0;
let fluffCount = 0;
let visibleNames = 0;
for (const file of index.files) {
	const relative = `spells/${file}`;
	const guard = report.guards[relative];
	assert.ok(guard, `Missing guard for ${relative}`);
	assert.equal(guard.byteIdentical, true, `${relative} source backup differs from upstream English`);
	assert.equal(sha256(`data/${relative}`), guard.localEnglishSha256, `${relative} upstream hash changed`);

	const canonical = readJson(`data/${relative}`);
	const localized = readJson(`data/zh-TW/${relative}`);
	for (const prop of ["spell", "spellFluff"]) {
		if (!canonical[prop]) continue;
		assert.equal(localized[prop].length, canonical[prop].length, `${relative}/${prop} count changed`);
		localized[prop].forEach((entity, ix) => {
			assert.equal(entity.ENG_name, canonical[prop][ix].name, `${relative}/${prop}/${ix} identity backup mismatch`);
			assert.notEqual(entity.name, entity.ENG_name, `${relative}/${prop}/${ix} visible name remained English`);
			assert.equal(entity.source, canonical[prop][ix].source, `${relative}/${prop}/${ix} source changed`);
			visibleNames++;
		});
		if (prop === "spell") spellCount += localized[prop].length;
		else fluffCount += localized[prop].length;
	}
}

assert.equal(spellCount, 936);
assert.equal(fluffCount, 89);
assert.equal(visibleNames, 1025);
console.log("Spell translation validation: PASS");
console.log(`${spellCount} spells; ${fluffCount} spell fluff entries; ${visibleNames} localized names.`);
