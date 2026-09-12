import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
const readText = relativePath => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/zh-tw/site-i18n-data.js");
await import("../../js/zh-tw/site-i18n.js");
await import("../../js/render.js");
await import("../../js/zh-tw/content-i18n.js");

globalThis.VetoolsConfig = {get: () => "one"};
globalThis.DataLoader = {getAllFromCacheAll: () => []};

const I18n = globalThis.I18nZhTwContent;

const pGetLocalizedData = async () => {
	const canonical = readJson("data/cultsboons.json");
	const sidecar = readJson("data/zh-TW/cults-boons/cultsboons.json");
	const snapshot = structuredClone(canonical);
	const localized = await I18n.pApplyDataFile({
		file: "cultsboons.json",
		data: canonical,
		fnLoad: async () => sidecar,
	});
	assert.deepEqual(canonical, snapshot, "runtime localization mutated canonical input");
	return {canonical, sidecar, localized};
};

const getBaseName = name => name
	.replace(/\s*\{@recharge(?: [^}]*)?\}$/u, "")
	.replace(/\s*\([^()]+\)$/u, "")
	.trim();

const assertNestedNamesBilingual = ({canonical, localized, context}) => {
	if (Array.isArray(canonical)) {
		assert.equal(localized.length, canonical.length, `${context} array shape changed`);
		canonical.forEach((child, ix) => assertNestedNamesBilingual({canonical: child, localized: localized[ix], context: `${context}/${ix}`}));
		return;
	}
	if (!canonical || typeof canonical !== "object") return;

	if (typeof canonical.name === "string") {
		assert.match(localized.name, /\p{Script=Han}/u, `${context} name was not translated`);
		assert.equal(localized.ENG_name, canonical.name, `${context} lost its English name`);
		assert.match(localized._displayName, /\p{Script=Han}/u, `${context} lacks a localized display name`);
		assert.ok(
			localized._displayName.includes(`（${getBaseName(canonical.name)}）`),
			`${context} display name is not bilingual: ${localized._displayName}`,
		);
	}

	for (const [key, child] of Object.entries(canonical)) {
		if (["name", "source", "otherSources", "reprintedAs"].includes(key)) continue;
		if (child && typeof child === "object") {
			assertNestedNamesBilingual({canonical: child, localized: localized[key], context: `${context}/${key}`});
		}
	}
};

test("all cults and supernatural boons load with bilingual names", async () => {
	const {canonical, localized} = await pGetLocalizedData();
	assert.equal(localized.cult.length, 30);
	assert.equal(localized.boon.length, 12);

	for (const prop of ["cult", "boon"]) {
		for (let ix = 0; ix < canonical[prop].length; ix++) {
			const original = canonical[prop][ix];
			const entity = localized[prop][ix];
			assert.equal(entity.name, original.name, `${prop}/${ix} canonical identity changed`);
			assert.strictEqual(I18n.getCanonicalEntity(entity), original, `${prop}/${ix} lost canonical link`);
			assert.match(entity._displayName, /\p{Script=Han}/u, `${prop}/${ix} top-level name was not translated`);
			assert.equal(I18n.getBilingualName(entity), `${entity._displayName}（${original.name}）`);
			assertNestedNamesBilingual({canonical: original.entries, localized: entity.entries, context: `${prop}/${ix}/entries`});
		}
	}
});

test("Gaze of Corruption is translated exactly and rendered with one bilingual heading", async () => {
	const {localized} = await pGetLocalizedData();
	const atropus = localized.cult.find(it => it.name === "Cult of Atropus, the World Born Dead" && it.source === "MTF");
	assert.ok(atropus);
	assert.equal(I18n.getBilingualName(atropus), "阿託普斯教派，生而為死的世界（Cult of Atropus, the World Born Dead）");

	const gaze = atropus.entries[0];
	assert.equal(gaze.name, "腐敗凝視{@recharge}");
	assert.equal(gaze.ENG_name, "Gaze of Corruption {@recharge}");
	assert.equal(gaze._displayName, "腐敗凝視（Gaze of Corruption）{@recharge}");
	assert.equal(
		gaze.entries[0],
		"邪教徒以其30尺內一個能看見的生物為目標。目標必須成功通過一次{@dc 15}體質豁免，否則受到16（{@damage 3d10}）點暗蝕傷害，並陷入{@condition poisoned||中毒}狀態1分鐘。{@condition poisoned||中毒}的目標可以在其每個回合結束時重複進行該豁免，成功時終止自己身上的效應。",
	);
	assert.match(gaze.entries[0], /\{@dc 15\}.*\{@damage 3d10\}.*\{@condition poisoned\|\|中毒\}/u);
	assert.doesNotMatch(gaze.entries[0], /The cultist targets|Constitution saving throw|necrotic damage/iu);

	const rendered = globalThis.Renderer.get().render(gaze);
	assert.match(rendered, /腐敗凝視（Gaze of Corruption）/u);
	assert.equal((gaze._displayName.match(/\{@recharge/gu) || []).length, 1, "recharge suffix was duplicated in the bilingual heading");
	assert.doesNotMatch(rendered, /腐敗凝視[^<]*充能[^<]*Gaze of Corruption[^<]*充能/u);
	assert.doesNotMatch(rendered, /The cultist targets/iu);
});

test("summary rules and all visible prose are localized", async () => {
	const {sidecar, localized} = await pGetLocalizedData();
	const baalzebul = localized.cult.find(it => it.name === "Cult of Baalzebul" && it.source === "MTF");
	assert.equal(baalzebul.goal.entry, "以那些竊取榮譽和尊重者的代價，恢復榮譽和尊重");
	assert.match(baalzebul.cultists.entry, /非玩家角色/u);
	assert.match(baalzebul.signatureSpells.entry, /次級幻象.*1環法術.*魅影之力.*2環法術/u);

	const juiblex = localized.boon.find(it => it.name === "Demonic Boon of Juiblex");
	assert.equal(juiblex.ability.entry, "體質屬性值獲得至多+8的加值，智力、感知與魅力屬性值受到等量減值");
	const orcus = localized.boon.find(it => it.name === "Demonic Boon of Orcus");
	assert.equal(orcus.ability.entry, "智力或感知屬性值，或兩者皆獲得至多+4的加值");

	const untranslated = [];
	const visit = (value, context = "", key = "") => {
		if (["_meta", "otherSources", "reprintedAs"].includes(key)) return;
		if (typeof value === "string") {
			if (["ENG_name", "source", "type", "tag", "uid"].includes(key)) return;
			const visible = value.replace(/\{@[^{}]+\}/gu, "");
			if (/[A-Za-z]{2,}/u.test(visible)) untranslated.push({context, visible});
			return;
		}
		if (Array.isArray(value)) return value.forEach((child, ix) => visit(child, `${context}/${ix}`, key));
		if (value && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => visit(child, `${context}/${childKey}`, childKey));
	};
	visit(sidecar);
	assert.deepEqual(untranslated, [], `untranslated visible prose: ${JSON.stringify(untranslated.slice(0, 5))}`);

	const report = readJson("translation/zh-TW/cults-boons/generated/cults-boons-import-report.json");
	assert.equal(report.status, "pass");
	assert.deepEqual(report.counts, {cult: 30, boon: 12});
	assert.deepEqual(report.qa.untranslatedVisibleStrings, []);
	assert.deepEqual(report.qa.numericUnresolved, []);
});

test("the page runtime, filters, renderer labels, and faction term use zh-TW", () => {
	const pageSource = readText("js/cultsboons.js");
	const filterSource = readText("js/filter-cultsboons.js");
	const renderSource = readText("js/render.js");
	const htmlSource = readText("cultsboons.html");

	assert.match(pageSource, /pApplyDataFile\(\{\s*file: "cultsboons\.json"/u);
	assert.match(pageSource, /Renderer\.utils\.getBilingualName\(it\)/u);
	assert.match(pageSource, /it\.__prop === "cult" \? "邪教" : "恩賜"/u);
	assert.match(filterSource, /"Boon, Demonic": "恩賜，惡魔", "Cult": "邪教"/u);
	assert.match(filterSource, /getCultBoonType\(it\)/u);
	for (const label of ["目標：", "典型邪教徒：", "招牌法術：", "屬性值調整："]) assert.ok(renderSource.includes(`name: "${label}"`));
	assert.match(htmlSource, /<title>邪教與超自然恩賜 - 5etools<\/title>/u);
	assert.match(htmlSource, /src="js\/zh-tw\/content-i18n\.js"/u);

	const faction = I18n.localizeRulesText("Membership in the Order of the Gauntlet");
	assert.equal(faction, "成員資格：鐵手套教團");
	assert.doesNotMatch(faction, /Order of the Gauntlet|臂鎧教團|臂鎧騎士團|護手令會/iu);

	const bastions = readJson("data/zh-TW/bastions/bastions.json");
	const tournamentField = bastions.facility.find(it => it.ENG_name === "Order of the Gauntlet Tournament Field");
	assert.equal(tournamentField.name, "鐵手套教團比武場");
	assert.deepEqual(tournamentField.prerequisite[0].membership, ["鐵手套教團"]);
	assert.match(JSON.stringify(tournamentField.entries), /鐵手套教團/u);

	const items = readJson("data/zh-TW/items/items-004.json");
	const trinket = items.item.find(it => it.ENG_name === "Order of the Gauntlet Trinket");
	assert.equal(trinket.name, "鐵手套教團飾品");
	assert.equal(trinket.entries[0].caption, "鐵手套教團飾品");

	const rulesText = JSON.stringify(readJson("data/zh-TW/rules/variantrules.json").variantrule);
	assert.match(rulesText, /鐵手套教團/u);
	assert.doesNotMatch(rulesText, /臂鎧教團Order of the Gauntlet/u);
	assert.equal(I18n.getCultBoonType("Demonic"), "惡魔");
	assert.equal(I18n.getCultBoonType("Diabolical"), "魔鬼");
	assert.equal(I18n.getCultBoonType("Elder Evil"), "遠古邪物");
});

console.log("Cults and supernatural boons localization tests: PASS");
console.log("30 cults; 12 boons; bilingual headings; fully localized visible prose.");
