import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const sha256 = relativePath => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relativePath))).digest("hex");

const expectedCounts = {
	action: 48,
	condition: 30,
	disease: 29,
	status: 5,
	conditionFluff: 13,
	skill: 36,
	sense: 8,
	variantrule: 230,
	generatedVariantrule: 13,
	quickrefNamedObjects: 401,
};

const expectedGuards = {
	"actions.json": ["data/actions.json", "c3ccb1766bd3e8e61451b9c110909ae69ce9d6ef8c1263c16ca97e00ac0eabba"],
	"conditionsdiseases.json": ["data/conditionsdiseases.json", "c2ae4f47b1f1576cd7e27f5b872e6c05a611ce08862dde1734ad7d5dafd486c2"],
	"fluff-conditionsdiseases.json": ["data/fluff-conditionsdiseases.json", "158279cf966b30d8da3d12f8cd449cb0b91f73f253a5664530e9830b6d7db5d8"],
	"skills.json": ["data/skills.json", "23327c7b6504232b0c6eb25690fec419c2aa447342337011668dbc53cc72c54f"],
	"senses.json": ["data/senses.json", "64812f6d9217e247b9ba6a280cdf4bcb3d9e6254742f6864edc28471e869ec2b"],
	"variantrules.json": ["data/variantrules.json", "4ee4f0f69d527620121751f82ece4cadfdea73fd8e5d98e5874a8e0526305c39"],
	"generated/bookref-quick.json": ["data/generated/bookref-quick.json", "ca2fbcb69306792c204a73da3490c31b2324e30740bb50c3a374d5ea355b5bef"],
	"generated/gendata-variantrules.json": ["data/generated/gendata-variantrules.json", "07a5efcae36fd7ed539573d82197e0928f363b16a244733352953d1103fba9a1"],
};

const report = readJson("translation/zh-TW/rules/generated/core-rules-import-report.json");
const index = readJson("data/zh-TW/rules/index.json");

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
assert.deepEqual(report.countFailures, {});
assert.deepEqual(report.canonicalFailures, []);

assert.equal(report.quickReference.matchedNamedBlocks, 395);
assert.deepEqual(report.quickReference.unmatchedEnglishNamedBlocks, []);
assert.equal(report.quickReference.unmatchedTranslatedNamedBlocks, 0);

for (const key of [
	"unmatchedEnglishEntities",
	"unmatchedTranslatedEntities",
	"arrayShapeMismatches",
	"typeShapeMismatches",
	"unmatchedTranslatedTags",
	"tagCanonicalDifferences",
	"diceDifferences",
	"numericUnresolved",
	"untranslatedVisibleStrings",
	"tagShapeMismatches",
]) assert.deepEqual(report.qa[key], [], `Expected report.qa.${key} to be empty`);

assert.equal(report.qa.sourceRepairsApplied.length, 27);
assert.equal(report.qa.sourceNameAliasesApplied.length, 2);
assert.equal(report.qa.numericDifferencesRawCount, 124);
assert.equal(report.qa.numericEquivalentDifferences.length, 124);
assert.equal(report.qa.untranslatedVisibleStringsRawCount, 47);
assert.equal(report.qa.intentionalUntranslatedStrings.length, 47);
assert.equal(report.qa.tagShapeDifferencesResolved.length, 28);

const numericReasonCounts = Object.groupBy(report.qa.numericEquivalentDifferences, it => it.reason);
assert.equal(numericReasonCounts["Arabic and written-number/fraction forms are equivalent"]?.length, 80);
assert.equal(numericReasonCounts["same numeric value set; repetition/formatting only"]?.length, 44);

assert.deepEqual(report.qa.sourceNameAliasesApplied, [
	{
		arrayKind: "variantrule",
		englishName: "Weapon Mastery Properties",
		translatedENGName: "Mastery Properties",
		source: "XPHB",
	},
	{
		arrayKind: "variantrule",
		englishName: "Training to Gain Levels",
		translatedENGName: "Variant: Training to Gain Levels",
		source: "XDMG",
	},
]);

assert.deepEqual(Object.keys(report.guards).sort(), Object.keys(expectedGuards).sort());
for (const [name, [canonicalPath, expectedHash]] of Object.entries(expectedGuards)) {
	const guard = report.guards[name];
	assert.equal(guard.byteIdentical, true, `${name} source backup differs from upstream English`);
	assert.equal(guard.localEnglishSha256, expectedHash);
	assert.equal(guard.sourceBackupSha256, expectedHash);
	assert.match(guard.translatedSourceSha256, /^[0-9a-f]{64}$/u);
	assert.equal(sha256(canonicalPath), expectedHash, `${canonicalPath} no longer matches locked v2.33.3 data`);
}

const actions = readJson("data/zh-TW/rules/actions.json");
const conditions = readJson("data/zh-TW/rules/conditionsdiseases.json");
const fluff = readJson("data/zh-TW/rules/fluff-conditionsdiseases.json");
const skills = readJson("data/zh-TW/rules/skills.json");
const senses = readJson("data/zh-TW/rules/senses.json");
const rules = readJson("data/zh-TW/rules/variantrules.json");
const generatedRules = readJson("data/zh-TW/rules/generated/gendata-variantrules.json");
const quickReference = readJson("data/zh-TW/rules/generated/bookref-quick.json");

assert.equal(actions.action.length, expectedCounts.action);
assert.equal(conditions.condition.length, expectedCounts.condition);
assert.equal(conditions.disease.length, expectedCounts.disease);
assert.equal(conditions.status.length, expectedCounts.status);
assert.equal(fluff.conditionFluff.length, expectedCounts.conditionFluff);
assert.equal(skills.skill.length, expectedCounts.skill);
assert.equal(senses.sense.length, expectedCounts.sense);
assert.equal(rules.variantrule.length, expectedCounts.variantrule);
assert.equal(generatedRules.variantrule.length, expectedCounts.generatedVariantrule);

const reference = quickReference.reference["bookref-quick"];
assert.equal(reference.contents.length, 5);
assert.deepEqual(reference.contents.map(it => it.headers.length), [4, 10, 20, 8, 4]);
assert.equal(quickReference.data["bookref-quick"].length, 5);

let quickrefNamedObjects = 0;
let quickrefNamedBodyObjects = 0;
const walk = (value, {isBody = false} = {}) => {
	if (Array.isArray(value)) return value.forEach(it => walk(it, {isBody}));
	if (!value || typeof value !== "object") return;
	if (typeof value.ENG_name === "string") {
		quickrefNamedObjects++;
		if (isBody) quickrefNamedBodyObjects++;
	}
	Object.values(value).forEach(it => walk(it, {isBody}));
};
walk(quickReference.reference);
walk(quickReference.data, {isBody: true});
assert.equal(quickrefNamedObjects, expectedCounts.quickrefNamedObjects);
assert.equal(quickrefNamedBodyObjects, 395);

for (const item of report.qa.intentionalUntranslatedStrings) {
	assert.equal(item.reason, "mechanical/numeric table cell or retained rules unit");
	const tags = [...item.english.matchAll(/\{@([A-Za-z0-9]+) [^{}]*\}/gu)];
	assert.ok(tags.every(match => ["dice", "damage"].includes(match[1])));
	const residual = item.english.replace(/\{@[A-Za-z0-9]+ [^{}]*\}/gu, "");
	assert.match(residual, /^[\d\s.,+×()½/−-]*(?:(?:gp|mph|lb|ft|sp|cp|pp|xp))?$/iu);
}

console.log("Core rules import validation: PASS");
console.log("48 actions; 64 conditions/diseases/statuses; 36 skills; 8 senses; 243 variant rules; 401 Quick Reference named objects.");
