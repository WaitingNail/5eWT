import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const itemIndex = readJson("data/zh-TW/items/index.json");
const readItemSidecar = file => {
	const files = itemIndex.fileChunks?.[file] || [file];
	return files.reduce((out, chunkFile) => {
		const chunk = readJson(`data/zh-TW/items/${chunkFile}`);
		if (!out._meta && chunk._meta) out._meta = structuredClone(chunk._meta);
		for (const [prop, entities] of Object.entries(chunk)) {
			if (prop === "_meta" || !Array.isArray(entities)) continue;
			(out[prop] ||= []).push(...entities);
		}
		return out;
	}, {});
};

await import("../../js/zh-tw/content-i18n.js");
const I18n = globalThis.I18nZhTwContent;

assert.ok(I18n, "zh-TW content runtime was not registered");

const specs = [
	["items.json", ["item", "itemGroup"]],
	["items-base.json", ["baseitem", "itemProperty", "itemType", "itemTypeAdditionalEntries", "itemEntry", "itemMastery"]],
	["magicvariants.json", ["magicvariant"]],
	["fluff-items.json", ["itemFluff"]],
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
const actualCounts = {};
let localizedNames = 0;

for (const [file, props] of specs) {
	const canonical = readJson(`data/${file}`);
	const sidecar = readItemSidecar(file);
	const snapshot = structuredClone(canonical);
	const applied = await I18n.pApplyDataFile({
		file,
		data: canonical,
		fnLoad: async () => sidecar,
	});

	assert.deepEqual(canonical, snapshot, `${file} runtime mutated canonical input`);
	for (const prop of props) {
		assert.equal(applied[prop].length, canonical[prop].length, `${file}/${prop} count changed`);
		actualCounts[prop] = applied[prop].length;
		for (let ix = 0; ix < applied[prop].length; ix++) {
			const entity = applied[prop][ix];
			const original = canonical[prop][ix];
			assert.strictEqual(I18n.getCanonicalEntity(entity), original, `${file}/${prop}/${ix} lost canonical link`);
			if (original.name == null) continue;
			assert.equal(entity.name, original.name, `${file}/${prop}/${ix} canonical name changed`);
			assert.ok(entity._displayName, `${file}/${prop}/${ix} missing display name`);
			assert.notEqual(entity._displayName, entity.name, `${file}/${prop}/${ix} visible name remained canonical English`);
			localizedNames++;
		}
	}
}

assert.deepEqual(actualCounts, expectedCounts);
assert.equal(localizedNames, 4020);

const canonicalItems = readJson("data/items.json");
const localizedItems = await I18n.pApplyDataFile({
	file: "items.json",
	data: canonicalItems,
	fnLoad: async () => readItemSidecar("items.json"),
});
const tool = localizedItems.item.find(it => it.name === "+1 All-Purpose Tool" && it.source === "TCE");
assert.ok(tool);
assert.equal(tool._displayName, "+1 萬能工具");
assert.match(tool.entries.join("\n"), /法術豁免DC/u);
assert.equal(I18n.getCanonicalName(tool), "+1 All-Purpose Tool");
const absorbingTattooGroup = localizedItems.itemGroup.find(it => it.name === "Absorbing Tattoo" && it.source === "TCE");
assert.equal(absorbingTattooGroup.items[0], "Acid Absorbing Tattoo|TCE", "group link identity changed");
assert.equal(absorbingTattooGroup._displayItems[0], "強酸吸收刺青");

const fetchedUrls = [];
globalThis.fetch = async url => {
	fetchedUrls.push(url);
	const absolute = path.join(ROOT, url);
	return {
		ok: fs.existsSync(absolute),
		status: fs.existsSync(absolute) ? 200 : 404,
		statusText: fs.existsSync(absolute) ? "OK" : "Not Found",
		json: async () => readJson(url),
	};
};
I18n._pFileCache.clear();
const fetchedItems = await I18n.pApplyDataFile({file: "items.json", data: canonicalItems});
assert.equal(fetchedItems.item.length, 2428);
assert.equal(fetchedItems.itemGroup.length, 109);
assert.equal(fetchedItems.item[0]._displayName, "+1 萬能工具");
assert.deepEqual(fetchedUrls, [
	"data/zh-TW/items/index.json",
	...itemIndex.fileChunks["items.json"].map(file => `data/zh-TW/items/${file}`),
]);
I18n._pFileCache.clear();
delete globalThis.fetch;

const canonicalBase = readJson("data/items-base.json");
const localizedBase = await I18n.pApplyDataFile({
	file: "items-base.json",
	data: canonicalBase,
	fnLoad: async () => readJson("data/zh-TW/items/items-base.json"),
});
const alchemist = localizedBase.baseitem.find(it => it.name === "Alchemist's Supplies" && it.source === "PHB");
assert.equal(alchemist._displayName, "鍊金工具");
assert.match(alchemist.additionalEntries[0], /鍊金工具/u);
const twoHanded = localizedBase.itemProperty.find(it => it.abbreviation === "2H" && it.source === "PHB");
assert.equal(twoHanded.entries[0].name, "雙手");
assert.match(twoHanded.entries[0].entries[0], /雙手並用/u);
const treasure = localizedBase.itemType.find(it => it.abbreviation === "$" && it.source === "DMG");
assert.equal(treasure.name, "Treasure");
assert.equal(treasure._displayName, "寶藏");
const cleave = localizedBase.itemMastery.find(it => it.name === "Cleave" && it.source === "XPHB");
assert.equal(cleave._displayName, "橫掃");
assert.match(cleave.entries[0], /額外攻擊/u);

const canonicalVariants = readJson("data/magicvariants.json");
const localizedVariants = await I18n.pApplyDataFile({
	file: "magicvariants.json",
	data: canonicalVariants,
	fnLoad: async () => readJson("data/zh-TW/items/magicvariants.json"),
});
const plusOneAmmo = localizedVariants.magicvariant.find(it => it.name === "+1 Ammunition" && it.inherits.source === "DMG");
assert.equal(plusOneAmmo._displayName, "+1 彈藥");
assert.equal(plusOneAmmo.inherits.namePrefix, "+1 ", "canonical variant name rule changed");
assert.match(plusOneAmmo.inherits.entries[0], /魔法彈藥/u);

const canonicalFluff = readJson("data/fluff-items.json");
const localizedFluff = await I18n.pApplyDataFile({
	file: "fluff-items.json",
	data: canonicalFluff,
	fnLoad: async () => readJson("data/zh-TW/items/fluff-items.json"),
});
assert.equal(localizedFluff.itemFluff[0].name, canonicalFluff.itemFluff[0].name);
assert.equal(localizedFluff.itemFluff[0]._displayName, "+1 命運主宰之牌");

assert.equal(I18n.getItemRarity("very rare"), "極稀有");
assert.equal(I18n.getItemRarityShort("uncommon"), "非普");
assert.equal(I18n.getItemWeaponCategory("martial"), "軍用武器");

console.log("Item localization runtime tests: PASS");
console.log("3,097 item rules entities; 948 item fluff entries; 4,020 localized names.");
