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
assert.equal(I18n.getSizeFull("M"), "中型");
assert.equal(I18n.getSizeShort("S"), "小");
assert.equal(I18n.getFeatCategory("EB"), "傳奇恩賜");
assert.equal(I18n.getOptionalFeatureType("EI"), "魔能祈喚");
assert.equal(I18n.getSkill("Animal Handling"), "馴獸");
assert.equal(I18n.getLanguage("Undercommon"), "地底通用語");
assert.equal(I18n.localizeAbilityText("Str +2; Any +1"), "力量 +2; 任一屬性 +1");
assert.equal(I18n.localizeSkillText("Choose two: Arcana, History"), "自選二項：奧秘, 歷史");
assert.equal(I18n.localizeSpeedText("walk 30 ft., fly 60 ft. (hover)"), "步行 30 尺, 飛行 60 尺 (懸浮)");
assert.equal(
	I18n.localizeRulesText(`<a href="#strength">Strength</a> Level 4+`),
	`<a href="#strength">力量</a> 4級以上`,
	"visible-text localization must not alter canonical link targets",
);

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

const characterOptionSpecs = [
	["races.json", ["race", "subrace"]],
	["fluff-races.json", ["raceFluff"]],
	["backgrounds.json", ["background"]],
	["fluff-backgrounds.json", ["backgroundFluff"]],
	["feats.json", ["feat"]],
	["fluff-feats.json", ["featFluff"]],
	["optionalfeatures.json", ["optionalfeature"]],
	["fluff-optionalfeatures.json", ["optionalfeatureFluff"]],
];
const expectedCharacterOptionCounts = {
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
const actualCharacterOptionCounts = {};
let localizedCharacterOptionNames = 0;

for (const [file, props] of characterOptionSpecs) {
	const canonicalFile = readJson(`data/${file}`);
	const localizedFile = readJson(`data/zh-TW/character-options/${file}`);
	const canonicalSnapshot = structuredClone(canonicalFile);
	const appliedFile = await I18n.pApplyDataFile({
		file,
		data: canonicalFile,
		fnLoad: async () => localizedFile,
	});

	assert.deepEqual(canonicalFile, canonicalSnapshot, `${file} runtime mutated canonical data`);
	for (const prop of props) {
		assert.equal(appliedFile[prop].length, canonicalFile[prop].length, `${file}/${prop} entity count changed`);
		actualCharacterOptionCounts[prop] = appliedFile[prop].length;
		appliedFile[prop].forEach((entity, ix) => {
			const canonical = canonicalFile[prop][ix];
			assert.equal(entity.name, canonical.name, `${file}/${prop}/${ix} canonical name changed`);
			assert.equal(entity.source, canonical.source, `${file}/${prop}/${ix} source changed`);
			assert.strictEqual(I18n.getCanonicalEntity(entity), canonical, `${file}/${prop}/${ix} canonical entity link changed`);
			if (canonical.name == null) return;
			assert.ok(entity._displayName, `${file}/${prop}/${ix} missing localized display name`);
			assert.notEqual(entity._displayName, canonical.name, `${file}/${prop}/${ix} display name remained English`);
			localizedCharacterOptionNames++;
		});
	}

	if (file === "fluff-races.json") {
		assert.equal(appliedFile.raceFluffMeta.uncommon.name, "罕見種族");
		assert.match(appliedFile.raceFluffMeta.monstrous.entries[0], /戰役/u);
		assert.equal(canonicalFile.raceFluffMeta.uncommon.name, "Uncommon Races");
	}
}

assert.deepEqual(actualCharacterOptionCounts, expectedCharacterOptionCounts);
assert.equal(localizedCharacterOptionNames, 1326);

const duplicateCanonicalSubraces = [
	{name: "Ixalan", source: "PSX", raceName: "Goblin", raceSource: "PSZ", entries: ["Goblin prose."]},
	{name: "Ixalan", source: "PSX", raceName: "Vampire", raceSource: "PSZ", entries: ["Vampire prose."]},
];
const duplicateLocalizedSubraces = {
	subrace: [
		{ENG_name: "Ixalan", name: "地精依夏蘭", source: "PSX", raceName: "Goblin", raceSource: "PSZ", entries: ["地精正文。"]},
		{ENG_name: "Ixalan", name: "吸血鬼依夏蘭", source: "PSX", raceName: "Vampire", raceSource: "PSZ", entries: ["吸血鬼正文。"]},
	],
};
const duplicateApplied = await I18n.pApplyEntities({
	prop: "subrace",
	file: "races.json",
	entities: duplicateCanonicalSubraces,
	fnLoad: async () => duplicateLocalizedSubraces,
});
assert.deepEqual(duplicateApplied.map(it => it._displayName), ["地精依夏蘭", "吸血鬼依夏蘭"]);
assert.deepEqual(duplicateApplied.map(it => it.entries[0]), ["地精正文。", "吸血鬼正文。"]);

const canonicalBackgrounds = readJson("data/backgrounds.json");
const missingCharacterOptionFallback = await I18n.pApplyDataFile({
	file: "backgrounds.json",
	data: canonicalBackgrounds,
	fnLoad: async () => null,
});
assert.deepEqual(missingCharacterOptionFallback, canonicalBackgrounds, "missing character-option locale data must safely fall back to English");
assert.notStrictEqual(missingCharacterOptionFallback, canonicalBackgrounds, "fallback should isolate callers from accidental mutation");

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/render.js");

const localizedBackgroundData = await I18n.pApplyDataFile({
	file: "backgrounds.json",
	data: readJson("data/backgrounds.json"),
	fnLoad: async () => readJson("data/zh-TW/character-options/backgrounds.json"),
});
const acolyte = localizedBackgroundData.background.find(it => it.name === "Acolyte" && it.source === "PHB");
assert.equal(acolyte.startingEquipment[0]._[0].displayName, "聖徽（出任神職時的禮物）");
assert.equal(acolyte.startingEquipment[0]._[1].special, "薰香");
assert.equal(acolyte.startingEquipment[0]._[2].special, "祭袍");
assert.equal(localizedBackgroundData.background.filter(it => it._copy).length, 26);
await DataUtil.pDoMetaMerge("test:localized-backgrounds", localizedBackgroundData, {isSkipMetaMergeCache: true});
assert.equal(localizedBackgroundData.background.filter(it => it._copy).length, 0, "all localized background copies must resolve");
const baldursGateAcolyte = localizedBackgroundData.background.find(it => it.name === "Baldur's Gate Acolyte" && it.source === "BGDIA");
assert.match(JSON.stringify(baldursGateAcolyte.entries), /博德之門特性/u);

const canonicalRaceData = readJson("data/races.json");
const localizedRaceSidecar = readJson("data/zh-TW/character-options/races.json");
const localizedRawRaceData = await I18n.pApplyDataFile({
	file: "races.json",
	data: canonicalRaceData,
	fnLoad: async () => localizedRaceSidecar,
});
const aasimar2024 = localizedRawRaceData.race.find(it => it.name === "Aasimar" && it.source === "XPHB");
assert.equal(aasimar2024.sizeEntry.name, "體型：");
const aasimar = localizedRawRaceData.race.find(it => it.name === "Aasimar" && it.source === "MPMM");
assert.equal(aasimar._versions[0].name, "Aasimar; Necrotic Shroud");
assert.equal(aasimar._versions[0]._displayName, "阿斯莫; 死靈斗篷");
assert.equal(aasimar._versions[0]._mod.entries.replace, "Celestial Revelation");
assert.match(JSON.stringify(aasimar._versions[0]._mod.entries.items), /天界啟示/u);
assert.equal([...localizedRawRaceData.race, ...localizedRawRaceData.subrace].filter(it => it._copy).length, 17);
await DataUtil.pDoMetaMerge("test:localized-races", localizedRawRaceData, {isSkipMetaMergeCache: true});
assert.equal([...localizedRawRaceData.race, ...localizedRawRaceData.subrace].filter(it => it._copy).length, 0, "all localized race copies must resolve");
const processedRaceData = DataUtil.race.getPostProcessedSiteJson(localizedRawRaceData, {isAddBaseRaces: true});
const highElf = processedRaceData.race.find(it => it.name === "Elf (High)" && it.source === "PHB");
assert.ok(highElf, "expected merged PHB High Elf");
assert.equal(highElf._displayName, "精靈 (高等)", "merged race must compose localized base and subrace names");
assert.equal(highElf._baseDisplayName, "精靈");
assert.equal(I18n.getCanonicalName(highElf), "Elf (High)", "merged race must preserve its canonical English name");

const baseDragonborn = processedRaceData.race.find(it => it.name === "Dragonborn (Base)" && it.source === "PHB");
assert.ok(baseDragonborn, "expected synthetic PHB Dragonborn base race");
assert.equal(baseDragonborn._displayName, "龍裔（基礎）");
assert.equal(baseDragonborn._baseRaceEntries[0].entries[0], "此種族有多個亞種，如下所列：");

console.log(`Content localization runtime tests passed (${spellCount} spells; ${fluffCount} spell fluff entries; 1,331 character-option entities).`);
