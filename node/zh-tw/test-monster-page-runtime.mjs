import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const readText = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/render.js");
await import("../../js/zh-tw/content-i18n.js");

globalThis.VetoolsConfig = {get: () => "classic"};
globalThis.DataLoader = {getFromCache: () => null};

const I18n = globalThis.I18nZhTwContent;
const canonical = readJson("data/bestiary/bestiary-mm.json");
const localized = await I18n.pApplyEntities({
	prop: "monster",
	file: "bestiary-mm.json",
	entities: canonical.monster,
	fnLoad: async () => readJson("data/zh-TW/bestiary/bestiary-mm.json"),
});

const dragon = localized.find(it => it.name === "Adult Black Dragon" && it.source === "MM");
Renderer.monster.updateParsed(dragon);
const dragonEntries = Renderer.monster.getSubEntries(dragon, {renderer: Renderer.get()});
assert.ok(dragonEntries.entsTrait.some(it => it.name === "水陸兩棲"));
assert.ok(dragonEntries.entsAction.some(it => it.name === "多重攻擊"));
assert.match(Renderer.monster.getLegendaryActionIntro(dragon, {styleHint: "classic"}), /傳奇動作/u);

const acolyte = localized.find(it => it.name === "Acolyte" && it.source === "MM");
Renderer.monster.updateParsed(acolyte);
const spellcastingHtml = Renderer.monster.getSpellcastingRenderedTraits(Renderer.get(), acolyte)[0].rendered;
assert.match(spellcastingHtml, /戲法/u);
assert.match(spellcastingHtml, /法術位/u);
assert.doesNotMatch(spellcastingHtml, /At will|slots|Spellcasting/iu);

const bgdiaCanonical = readJson("data/bestiary/bestiary-bgdia.json");
const bgdiaLocalized = await I18n.pApplyEntities({
	prop: "monster",
	file: "bestiary-bgdia.json",
	entities: bgdiaCanonical.monster,
	fnLoad: async () => readJson("data/zh-TW/bestiary/bestiary-bgdia.json"),
});
const lulu = structuredClone(bgdiaLocalized.find(it => it.name === "Lulu" && it.source === "BGDIA"));
await DataUtil.monster.pMergeCopy(bgdiaLocalized, lulu, {isErrorOnMissing: true});
assert.equal(lulu._copy, undefined, "localized monster copy was not resolved");
assert.equal(lulu._displayName, "露露");
assert.ok(lulu.trait.some(it => it.name === "無敵光環"), "copied traits were assembled before localization");
assert.ok(lulu.action.some(it => it.name === "獠牙"), "copied actions were assembled before localization");

const bestiaryIndex = readJson("data/zh-TW/bestiary/index.json");
const allLocalized = [];
for (const file of bestiaryIndex.files) {
	const source = readJson(`data/bestiary/${file}`);
	const entities = await I18n.pApplyEntities({
		prop: "monster",
		file,
		entities: source.monster || [],
		fnLoad: async () => readJson(`data/zh-TW/bestiary/${file}`),
	});
	entities.forEach(monster => monster.__prop = "monster");
	allLocalized.push(...entities);
}
const copyRecords = allLocalized.filter(monster => monster._copy);
assert.ok(copyRecords.length > 0);

const fnLoadJson = DataUtil.loadJSON;
DataUtil.loadJSON = async url => {
	const data = readJson(url.replace(/^\\.\\//, ""));
	await DataUtil.pDoMetaMerge(`test:${url}`, data, {isSkipMetaMergeCache: true});
	return data;
};
try {
	for (const monster of copyRecords) {
		const resolved = structuredClone(monster);
		try {
			await DataUtil.monster.pMergeCopy(allLocalized, resolved, {isErrorOnMissing: true});
		} catch (error) {
			throw new Error(`${monster.name}|${monster.source}: ${error.message}`, {cause: error});
		}
		assert.equal(resolved._copy, undefined, `${monster.name}|${monster.source}`);
	}
} finally {
	DataUtil.loadJSON = fnLoadJson;
}

const metadata = I18n.localizeMonsterMetaText("A large dragon, chaotic evil; darkvision 120 ft.; fire and poisoned");
assert.match(metadata, /^A 大型 龍/u, "ordinary English articles must not be replaced by rule-code translations");
assert.match(metadata, /混亂邪惡/u);
assert.match(metadata, /黑暗視覺 120 尺/u);
assert.match(metadata, /火焰/u);
assert.match(metadata, /中毒/u);

const bestiarySource = readText("js/bestiary.js");
const rendererSource = readText("js/render-bestiary.js");
const utilsSource = readText("js/utils.js");
assert.match(bestiarySource, /_displayName/u);
assert.match(bestiarySource, /怪物圖鑑/u);
assert.match(bestiarySource, /資料卡/u);
assert.match(bestiarySource, /傳奇動作/u);
assert.match(rendererSource, /_displayAc/u);
assert.match(rendererSource, /_displayLanguages/u);
assert.match(rendererSource, /傳奇動作/u);
assert.match(rendererSource, /巢穴動作/u);
assert.match(rendererSource, /區域效應/u);
const monsterPreApplyIndex = utilsSource.indexOf("data = await globalThis.I18nZhTwContent.pApplyEntities");
const monsterMetaMergeIndex = utilsSource.indexOf("await DataUtil.pDoMetaMerge(CryptUtil.uid(), json");
assert.ok(
	monsterPreApplyIndex >= 0 && monsterMetaMergeIndex > monsterPreApplyIndex,
	"monster sidecars must be applied before resolving _copy inheritance",
);

console.log("Monster page integration tests: PASS");
console.log("Localized list labels, stat metadata, spellcasting, actions, legendary text, and canonical rule values render correctly.");
