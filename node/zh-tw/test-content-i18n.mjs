import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));

delete globalThis.I18nZhTwContent;
await import(`${pathToFileURL(path.join(ROOT, "js/zh-tw/content-i18n.js")).href}?test=${Date.now()}`);
const I18n = globalThis.I18nZhTwContent;
assert.equal(typeof I18n, "function");

assert.equal(I18n.getSpellLevel(0), "戲法");
assert.equal(I18n.getSpellLevel(5, {isIncludeWord: true}), "5環法術");
assert.equal(I18n.getSpellSchool("V"), "塑能");
assert.equal(I18n.getSpellLevelSchoolMeta({level: 3, school: "V", meta: {ritual: true}}), "3環塑能系（儀式）");
assert.equal(I18n.getSpellTime({number: 1, unit: "bonus"}, {isShort: true}), "附贈動作");
assert.equal(I18n.getSpellTimeList([{number: 1, unit: "action"}], {ritual: true}, {styleHint: "one"}), "1個動作或儀式");
assert.equal(I18n.getSpellRange({type: "point", distance: {type: "feet", amount: 60}}), "60尺");
assert.equal(I18n.getSpellRange({type: "cone", distance: {type: "feet", amount: 30}}), "自身（30尺錐狀）");
assert.equal(I18n.getSpellComponents({v: true, s: true, m: "一根樹枝"}, 1, {isPlainText: true}), "V、S、M（一根樹枝）");
assert.equal(I18n.getSpellDuration([{type: "timed", duration: {type: "minute", amount: 1}, concentration: true}]), "專注，至多1分鐘");
assert.equal(I18n.getSpellDuration([{type: "permanent", ends: ["dispel", "trigger"]}]), "直到被解除或被觸發");
assert.equal(I18n.getAbility("wisdom"), "感知");
assert.equal(I18n.getDamageType("necrotic"), "暗蝕");
assert.equal(I18n.getCondition("prone|XPHB"), "伏地");
assert.equal(I18n.getSpellAreaType("E"), "光環");

const canonicalPhb = readJson("data/spells/spells-phb.json");
const localizedPhb = readJson("data/zh-TW/spells/spells-phb.json");
const canonicalSnapshot = structuredClone(canonicalPhb.spell.slice(0, 3));
const localized = await I18n.pApplyEntities({
	prop: "spell",
	file: "spells-phb.json",
	entities: canonicalPhb.spell.slice(0, 3),
	fnLoad: async () => localizedPhb,
});

assert.deepEqual(canonicalPhb.spell.slice(0, 3), canonicalSnapshot, "runtime must not mutate canonical spell data");
assert.equal(localized[0].name, "Acid Splash");
assert.equal(localized[0]._displayName, "酸液飛濺");
assert.equal(I18n.getCanonicalName(localized[0]), "Acid Splash");
assert.equal(I18n.getDisplayName(localized[0]), "酸液飛濺");
assert.match(localized[0].entries[0], /你擲出一顆酸液球/u);
assert.match(localized[0].entries[0], /\{@damage 1d6\}/u);
assert.strictEqual(I18n.getCanonicalEntity(localized[0]), canonicalPhb.spell[0]);

const aidCanonical = canonicalPhb.spell.find(spell => spell.name === "Aid");
const aidLocalized = await I18n.pApplyEntities({
	prop: "spell",
	file: "spells-phb.json",
	entities: [aidCanonical],
	fnLoad: async () => localizedPhb,
});
assert.equal(aidLocalized[0].components.m, "一小片白布");
assert.equal(aidCanonical.components.m, "a tiny strip of white cloth");

const thunderCanonical = readJson("data/spells/spells-xge.json").spell.find(spell => spell.name === "Thunderclap");
const thunderSidecar = readJson("data/zh-TW/spells/spells-xge.json");
const [thunderLocalized] = await I18n.pApplyEntities({
	prop: "spell",
	file: "spells-xge.json",
	entities: [thunderCanonical],
	fnLoad: async () => thunderSidecar,
});
assert.equal(thunderLocalized.scalingLevelDice.label, "雷鳴傷害");
assert.equal(thunderCanonical.scalingLevelDice.label, "thunder damage");

const malformedSidecar = structuredClone(localizedPhb);
malformedSidecar.spell[0].entries = [];
const [shapeFallback] = await I18n.pApplyEntities({
	prop: "spell",
	file: "spells-phb.json",
	entities: [canonicalPhb.spell[0]],
	fnLoad: async () => malformedSidecar,
});
assert.deepEqual(shapeFallback.entries, canonicalPhb.spell[0].entries, "shape mismatch must fall back to canonical prose");
assert.equal(shapeFallback._displayName, "酸液飛濺", "independent valid fields may still localize");

const [missingFallback] = await I18n.pApplyEntities({
	prop: "spell",
	file: "spells-phb.json",
	entities: [canonicalPhb.spell[0]],
	fnLoad: async () => null,
});
assert.deepEqual(missingFallback, canonicalPhb.spell[0], "missing locale data must safely fall back to English");

const index = readJson("data/zh-TW/spells/index.json");
let spellCount = 0;
let fluffCount = 0;
for (const file of index.files) {
	const canonicalFile = readJson(`data/spells/${file}`);
	const localizedFile = readJson(`data/zh-TW/spells/${file}`);
	for (const prop of ["spell", "spellFluff"]) {
		if (!canonicalFile[prop]) continue;
		const applied = await I18n.pApplyEntities({
			prop,
			file,
			entities: canonicalFile[prop],
			fnLoad: async () => localizedFile,
		});
		assert.equal(applied.length, canonicalFile[prop].length, `${file}/${prop} entity count changed`);
		applied.forEach((entity, ix) => {
			assert.equal(entity.name, canonicalFile[prop][ix].name, `${file}/${prop}/${ix} canonical name changed`);
			assert.equal(entity.source, canonicalFile[prop][ix].source, `${file}/${prop}/${ix} source changed`);
			assert.ok(entity._displayName, `${file}/${prop}/${ix} missing display name`);
		});
		if (prop === "spell") spellCount += applied.length;
		else fluffCount += applied.length;
	}
}

assert.equal(spellCount, 936);
assert.equal(fluffCount, 89);
console.log(`Content localization runtime tests passed (${spellCount} spells; ${fluffCount} spell fluff entries).`);
