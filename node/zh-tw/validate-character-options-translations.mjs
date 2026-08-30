import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const sha256 = relative => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relative))).digest("hex");

const report = readJson("translation/zh-TW/character-options/generated/character-options-import-report.json");
const index = readJson("data/zh-TW/character-options/index.json");

const expectedCounts = {
	race: 160,
	subrace: 98,
	raceFluff: 221,
	background: 161,
	backgroundFluff: 160,
	feat: 276,
	featFluff: 41,
	optionalfeature: 213,
	optionalfeatureFluff: 1,
};
const fileProps = new Map([
	["races.json", ["race", "subrace"]],
	["fluff-races.json", ["raceFluff"]],
	["backgrounds.json", ["background"]],
	["fluff-backgrounds.json", ["backgroundFluff"]],
	["feats.json", ["feat"]],
	["fluff-feats.json", ["featFluff"]],
	["optionalfeatures.json", ["optionalfeature"]],
	["fluff-optionalfeatures.json", ["optionalfeatureFluff"]],
]);

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
assert.deepEqual(index.files, [...fileProps.keys()]);
assert.equal(Object.keys(report.guards).length, fileProps.size);
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

assert.equal(report.qa.numericDifferencesRawCount, 96);
assert.equal(report.qa.numericEquivalentDifferences.length, 96);
assert.equal(report.qa.tagShapeDifferencesResolved.length, 62);
assert.equal(report.qa.sourceRepairsApplied.length, 26);
assert.equal(report.qa.intentionalUntranslatedStrings.length, 13);

const counts = {};
let totalEntities = 0;
let localizedNames = 0;
let unnamedEntities = 0;

for (const [file, props] of fileProps) {
	const guard = report.guards[file];
	assert.ok(guard, `Missing guard for ${file}`);
	assert.equal(guard.byteIdentical, true, `${file} source backup differs from upstream English`);
	assert.equal(sha256(`data/${file}`), guard.localEnglishSha256, `${file} upstream hash changed`);

	const canonical = readJson(`data/${file}`);
	const localized = readJson(`data/zh-TW/character-options/${file}`);
	for (const prop of props) {
		assert.equal(localized[prop].length, canonical[prop].length, `${file}/${prop} count changed`);
		counts[prop] = localized[prop].length;
		totalEntities += localized[prop].length;

		localized[prop].forEach((entity, ix) => {
			const canonicalEntity = canonical[prop][ix];
			assert.equal(entity.source, canonicalEntity.source, `${file}/${prop}/${ix} source changed`);
			if (canonicalEntity.name == null) {
				assert.equal(entity.name, canonicalEntity.name, `${file}/${prop}/${ix} unnamed identity changed`);
				assert.equal(entity.ENG_name, undefined, `${file}/${prop}/${ix} should not synthesize an English name`);
				unnamedEntities++;
				return;
			}

			assert.equal(entity.ENG_name, canonicalEntity.name, `${file}/${prop}/${ix} identity backup mismatch`);
			assert.notEqual(entity.name, entity.ENG_name, `${file}/${prop}/${ix} visible name remained English`);
			localizedNames++;
		});
	}
}

assert.deepEqual(counts, expectedCounts);
assert.equal(totalEntities, 1331);
assert.equal(localizedNames, 1326);
assert.equal(unnamedEntities, 5);

const raceFluffSidecar = readJson("data/zh-TW/character-options/fluff-races.json");
assert.deepEqual(Object.keys(raceFluffSidecar.raceFluffMeta).sort(), ["monstrous", "uncommon"]);
assert.equal(raceFluffSidecar.raceFluffMeta.uncommon.name, "罕見種族");
assert.equal(raceFluffSidecar.raceFluffMeta.monstrous.name, "怪物冒險者");

const canonicalBackgrounds = readJson("data/backgrounds.json");
const localizedBackgrounds = readJson("data/zh-TW/character-options/backgrounds.json");
const canonicalRaces = readJson("data/races.json");
const localizedRaces = readJson("data/zh-TW/character-options/races.json");

const acolyte = localizedBackgrounds.background.find(it => it.ENG_name === "Acolyte" && it.source === "PHB");
assert.equal(acolyte.startingEquipment[0]._[0].displayName, "聖徽（出任神職時的禮物）");
assert.equal(acolyte.startingEquipment[0]._[1].special, "薰香");
assert.equal(acolyte.startingEquipment[0]._[2].special, "祭袍");

let localizedEquipmentLabels = 0;
const validateEquipment = (canonical, localized, context) => {
	if (Array.isArray(canonical)) {
		assert.ok(Array.isArray(localized), `${context} localized shape changed`);
		assert.equal(localized.length, canonical.length, `${context} localized length changed`);
		return canonical.forEach((child, ix) => validateEquipment(child, localized[ix], `${context}/${ix}`));
	}
	if (!canonical || typeof canonical !== "object") return;
	for (const [key, value] of Object.entries(canonical)) {
		if (["displayName", "special"].includes(key) && typeof value === "string") {
			assert.notEqual(localized[key], value, `${context}/${key} remained English`);
			localizedEquipmentLabels++;
			continue;
		}
		if (value && typeof value === "object") validateEquipment(value, localized[key], `${context}/${key}`);
	}
};
canonicalBackgrounds.background.forEach((entity, ix) => {
	const localized = localizedBackgrounds.background[ix];
	if (entity.startingEquipment) validateEquipment(entity.startingEquipment, localized.startingEquipment, `background/${ix}/startingEquipment`);
	if (!entity._copy) return;
	assert.equal(localized._copy.name, entity._copy.name);
	assert.equal(localized._copy.source, entity._copy.source);
});
assert.equal(localizedEquipmentLabels, 189);

for (const prop of ["race", "subrace"]) canonicalRaces[prop].forEach((entity, ix) => {
	const localized = localizedRaces[prop][ix];
	if (entity._copy) {
		assert.equal(localized._copy.name, entity._copy.name);
		assert.equal(localized._copy.source, entity._copy.source);
	}
});

const aasimar2024 = localizedRaces.race.find(it => it.ENG_name === "Aasimar" && it.source === "XPHB");
assert.equal(aasimar2024.sizeEntry.name, "體型：");
assert.match(aasimar2024.sizeEntry.entries[0], /中型/u);

const aasimar = localizedRaces.race.find(it => it.ENG_name === "Aasimar" && it.source === "MPMM");
assert.equal(aasimar._versions[0].ENG_name, "Aasimar; Necrotic Shroud");
assert.equal(aasimar._versions[0].name, "阿斯莫; 死靈斗篷");
assert.equal(aasimar._versions[0]._mod.entries.replace, "Celestial Revelation");
assert.match(JSON.stringify(aasimar._versions[0]._mod.entries.items), /天界啟示/u);

const dankwoodGoblin = localizedRaces.race.find(it => it.ENG_name === "Goblin (Dankwood)" && it.source === "AWM");
const replaceText = dankwoodGoblin._copy._mod.entries.find(it => it.mode === "replaceTxt");
assert.deepEqual(replaceText, {mode: "replaceTxt", replace: "地精", with: "陰林地精", flags: "i"});

console.log("Character-option translation validation: PASS");
console.log(`${totalEntities} entities; ${localizedNames} localized names; ${localizedEquipmentLabels} localized equipment labels; ${fileProps.size} guarded source files.`);
