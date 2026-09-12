import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const readText = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");
const itemIndex = readJson("data/zh-TW/items/index.json");
const readItemSidecar = file => (itemIndex.fileChunks?.[file] || [file]).reduce((out, chunkFile) => {
	const chunk = readJson(`data/zh-TW/items/${chunkFile}`);
	if (!out._meta && chunk._meta) out._meta = structuredClone(chunk._meta);
	for (const [prop, entities] of Object.entries(chunk)) {
		if (prop === "_meta" || !Array.isArray(entities)) continue;
		(out[prop] ||= []).push(...entities);
	}
	return out;
}, {});

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/render.js");
await import("../../js/zh-tw/content-i18n.js");

globalThis.VetoolsConfig = {get: () => "classic"};

const I18n = globalThis.I18nZhTwContent;
const baseData = await I18n.pApplyDataFile({
	file: "items-base.json",
	data: readJson("data/items-base.json"),
	fnLoad: async () => readJson("data/zh-TW/items/items-base.json"),
});
const itemData = await I18n.pApplyDataFile({
	file: "items.json",
	data: readJson("data/items.json"),
	fnLoad: async () => readItemSidecar("items.json"),
});
const variantData = await I18n.pApplyDataFile({
	file: "magicvariants.json",
	data: readJson("data/magicvariants.json"),
	fnLoad: async () => readJson("data/zh-TW/items/magicvariants.json"),
});

Renderer.item._addBasePropertiesAndTypes(baseData);

const allPurposeTool = itemData.item.find(it => it.name === "+1 All-Purpose Tool" && it.source === "TCE");
Renderer.item.enhanceItem(allPurposeTool, {styleHint: "classic"});
assert.equal(allPurposeTool.name, "+1 All-Purpose Tool");
assert.equal(allPurposeTool._displayName, "+1 萬能工具");
assert.equal(I18n.getBilingualName(allPurposeTool), "+1 萬能工具（+1 All-Purpose Tool）");
assert.equal(Renderer.utils.getBilingualName(allPurposeTool), "+1 萬能工具（+1 All-Purpose Tool）");
assert.match(allPurposeTool._entryType, /奇物/u);
assert.match(allPurposeTool._entryType, /施法法器/u);
assert.equal(allPurposeTool._attunement, "（需要同調；由奇械師）");
assert.match(Renderer.item.getTransformedTypeEntriesMeta({item: allPurposeTool, styleHint: "classic"}).entryTypeRarity, /非普通/u);
assert.match(Renderer.item.getRenderedEntries(allPurposeTool), /法術豁免DC/u);

const [genericVariants] = Renderer.item._getAndProcGenericVariants(variantData);
const plusOneWeapon = genericVariants.find(it => it.name === "+1 Weapon" && it.inherits.source === "DMG");
const longsword = baseData.baseitem.find(it => it.name === "Longsword" && it.source === "PHB");
const specificVariant = Renderer.item._createSpecificVariants_createSpecificVariant(longsword, plusOneWeapon, {});
Renderer.item.enhanceItem(specificVariant, {styleHint: "classic"});

assert.equal(specificVariant.name, "+1 Longsword", "specific-variant canonical name changed");
assert.equal(specificVariant._displayName, "+1 長劍");
assert.equal(specificVariant._baseDisplayName, "長劍");
assert.match(specificVariant._entryType, /\{@item Longsword\|PHB\|長劍\}/iu);
assert.match(Renderer.item.getRenderedEntries(specificVariant), /魔法武器/u);

const propertyText = Renderer.item.getRenderedDamageAndProperties(longsword)[1];
assert.match(propertyText, /多用（Versatile）/u);

const dagger = baseData.baseitem.find(it => it.name === "Dagger" && it.source === "XPHB");
Renderer.item.enhanceItem(dagger, {styleHint: "one"});
const daggerProperties = Renderer.item.getRenderedDamageAndProperties(dagger)[1];
const daggerEntries = Renderer.item.getRenderedEntries(dagger);
const daggerMastery = Renderer.item.getRenderedMastery(dagger);
assert.match(daggerProperties, /靈巧（Finesse）/u);
assert.match(daggerEntries, /靈巧（Finesse）/u);
assert.match(daggerEntries, /使用一把靈巧武器發動攻擊時/u);
assert.doesNotMatch(daggerEntries, /When making an attack with a Finesse weapon/u);
assert.match(daggerEntries, /精通：迅擊（Nick）/u);
assert.match(daggerMastery, /迅擊（Nick）/u);

const itemsPageSource = readText("js/items.js");
const itemModalSource = readText("js/filter-items.js");
const rendererSource = readText("js/render.js");
assert.match(itemsPageSource, /const displayName = I18nZhTwContent\.getBilingualName\(item\)/u);
assert.equal((itemsPageSource.match(/txt: displayName/g) || []).length, 2, "both mundane and magic item lists must render localized names");
assert.match(itemsPageSource, /englishName: I18nZhTwContent\.getCanonicalName\(item\)/u);
assert.match(itemModalSource, /\$\{displayName\}<\/div>/u);
assert.match(itemModalSource, /englishName: globalThis\.I18nZhTwContent\.getCanonicalName\(item\)/u);
assert.match(rendererSource, /const name = Renderer\.utils\.getBilingualName\(ent\)/u);

console.log("Item page integration tests: PASS");
console.log("Canonical hashes retained; localized lists, metadata, attunement, variants, properties, and prose rendered.");
