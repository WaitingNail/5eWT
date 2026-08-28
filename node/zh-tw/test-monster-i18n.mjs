import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));

await import("../../js/zh-tw/content-i18n.js");
const I18n = globalThis.I18nZhTwContent;
assert.ok(I18n, "zh-TW content runtime was not registered");

const applyEntities = async ({file, prop}) => {
	const canonical = readJson(`data/bestiary/${file}`)[prop];
	const snapshot = structuredClone(canonical);
	const sidecar = readJson(`data/zh-TW/bestiary/${file}`);
	const applied = await I18n.pApplyEntities({
		prop,
		file,
		entities: canonical,
		fnLoad: async () => sidecar,
	});
	assert.deepEqual(canonical, snapshot, `${file}/${prop} runtime mutated canonical input`);
	assert.equal(applied.length, canonical.length, `${file}/${prop} count changed`);
	for (let ix = 0; ix < applied.length; ix++) {
		assert.strictEqual(I18n.getCanonicalEntity(applied[ix]), canonical[ix], `${file}/${prop}/${ix} lost canonical link`);
		assert.equal(applied[ix].name, canonical[ix].name, `${file}/${prop}/${ix} canonical name changed`);
		assert.ok(applied[ix]._displayName, `${file}/${prop}/${ix} missing display name`);
	}
	return {canonical, applied};
};

const {applied: monsters} = await applyEntities({file: "bestiary-mm.json", prop: "monster"});
const dragon = monsters.find(it => it.name === "Adult Black Dragon" && it.source === "MM");
assert.ok(dragon);
assert.equal(dragon._displayName, "成年黑龍");
assert.ok(dragon.trait.some(it => it.name === "水陸兩棲"));
assert.ok(dragon.action.some(it => it.name === "多重攻擊"));
assert.match(dragon._displayLanguages.join("、"), /通用語/u);
assert.match(dragon._displayLanguages.join("、"), /龍語/u);
assert.match(dragon.legendaryHeader[0], /傳奇動作/u);
assert.equal(I18n.getCanonicalName(dragon), "Adult Black Dragon");

const aboleth = monsters.find(it => it.name === "Aboleth" && it.source === "MM");
assert.ok(aboleth);
assert.match(aboleth._displayLanguages.join("、"), /深潛語/u);
assert.match(aboleth._displayLanguages.join("、"), /心靈感應 120 尺/u);

const acolyte = monsters.find(it => it.name === "Acolyte" && it.source === "MM");
assert.ok(acolyte);
assert.equal(acolyte._displayName, "侍僧");
assert.equal(acolyte.spellcasting[0].name, "施法");
assert.match(acolyte.spellcasting[0].headerEntries.join("\n"), /施法者/u);

const {applied: xmmMonsters} = await applyEntities({file: "bestiary-xmm.json", prop: "monster"});
assert.equal(xmmMonsters.length, readJson("data/bestiary/bestiary-xmm.json").monster.length);
assert.ok(xmmMonsters.some(it => it._displayName !== it.name), "2024 bestiary names were not localized");

const {applied: fluff} = await applyEntities({file: "fluff-bestiary-mm.json", prop: "monsterFluff"});
const aarakocraFluff = fluff.find(it => it.name === "Aarakocra" && it.source === "MM");
assert.equal(aarakocraFluff._displayName, "鳥羽人");
assert.ok(aarakocraFluff.entries?.length, "localized monster fluff was not applied");

const canonicalGroups = readJson("data/bestiary/legendarygroups.json");
const localizedGroups = await I18n.pApplyDataFile({
	file: "bestiary/legendarygroups.json",
	data: canonicalGroups,
	fnLoad: async () => readJson("data/zh-TW/bestiary/legendarygroups.json"),
});
assert.equal(localizedGroups.legendaryGroup.length, 187);
assert.ok(localizedGroups.legendaryGroup.some(it => it._displayName !== it.name));
assert.ok(localizedGroups.legendaryGroup.some(it => it.lairActions?.length || it.regionalEffects?.length));

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
await I18n.pApplyEntities({
	prop: "monster",
	file: "bestiary-mm.json",
	entities: readJson("data/bestiary/bestiary-mm.json").monster,
});
await I18n.pApplyDataFile({
	file: "bestiary/legendarygroups.json",
	data: canonicalGroups,
});
assert.ok(fetchedUrls.includes("data/zh-TW/bestiary/bestiary-mm.json"));
assert.ok(fetchedUrls.includes("data/zh-TW/bestiary/legendarygroups.json"));
I18n._pFileCache.clear();
delete globalThis.fetch;

console.log("Monster localization runtime tests: PASS");
console.log("Canonical identities retained; stat blocks, fluff, legendary groups, metadata, and fetch paths localized.");
