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

globalThis.VetoolsConfig = {get: () => "classic"};
globalThis.DataLoader = {getAllFromCacheAll: () => []};

const I18n = globalThis.I18nZhTwContent;
const FOLDER = "data/zh-TW/reference-pages";

const pGetLocalizedData = async file => {
	const canonical = readJson(`data/${file}`);
	const sidecar = readJson(`${FOLDER}/${file}`);
	const snapshot = structuredClone(canonical);
	const localized = await I18n.pApplyDataFile({file, data: canonical, fnLoad: async () => sidecar});
	assert.deepEqual(canonical, snapshot, `${file} runtime localization mutated canonical input`);
	return {canonical, sidecar, localized};
};

const getNameBase = name => name
	.replace(/\s*\{@recharge(?: [^}]*)?\}$/u, "")
	.replace(/\s*(?:\([^()]+\)|（[^（）]+）)$/u, "")
	.replace(/\s*[:：.。]$/u, "")
	.trim();

const assertNestedNamesBilingual = ({canonical, localized, context}) => {
	if (Array.isArray(canonical)) {
		assert.equal(localized.length, canonical.length, `${context} array shape changed`);
		canonical.forEach((child, ix) => assertNestedNamesBilingual({canonical: child, localized: localized[ix], context: `${context}/${ix}`}));
		return;
	}
	if (!canonical || typeof canonical !== "object") return;

	if (typeof canonical.name === "string" && ["entries", "item", "inset", "insetReadaloud"].includes(canonical.type)) {
		assert.match(localized._displayName || "", /\p{Script=Han}/u, `${context} lacks a localized heading`);
		assert.ok(
			localized._displayName.includes(`（${getNameBase(canonical.name)}）`),
			`${context} heading is not bilingual: ${localized._displayName}`,
		);
	}

	for (const [key, value] of Object.entries(canonical)) {
		if (key === "name" || !value || typeof value !== "object") continue;
		assertNestedNamesBilingual({canonical: value, localized: localized[key], context: `${context}/${key}`});
	}
};

test("all four reference pages load complete bilingual entity names", async () => {
	const expected = {
		"charcreationoptions.json": {charoption: 44},
		"rewards.json": {reward: 277},
		"languages.json": {language: 201, languageScript: 6},
		"deities.json": {deity: 563},
	};

	for (const [file, props] of Object.entries(expected)) {
		const {canonical, localized} = await pGetLocalizedData(file);
		for (const [prop, count] of Object.entries(props)) {
			assert.equal(localized[prop].length, count, `${file}/${prop} count changed`);
			for (let ix = 0; ix < count; ix++) {
				const original = canonical[prop][ix];
				const entity = localized[prop][ix];
				assert.equal(entity.name, original.name, `${file}/${prop}/${ix} canonical name changed`);
				assert.match(entity._displayName, /\p{Script=Han}/u, `${file}/${prop}/${ix} name was not translated`);
				assert.ok(I18n.getBilingualName(entity).includes(`（${original.name}）`), `${file}/${prop}/${ix} name is not bilingual`);
				if (original.entries) assertNestedNamesBilingual({canonical: original.entries, localized: entity.entries, context: `${file}/${prop}/${ix}/entries`});
			}
		}
	}
});

test("character options and rewards preserve mechanics while translating prose and headings", async () => {
	const {localized: charoptions} = await pGetLocalizedData("charcreationoptions.json");
	const alagondar = charoptions.charoption.find(it => it.name === "Alagondar Scion");
	assert.equal(I18n.getBilingualName(alagondar), "阿拉貢達的後裔（Alagondar Scion）");
	assert.match(alagondar.prerequisite[0].note, /不符合這個先決條件/u);
	assert.equal(alagondar.prerequisite[0].race[0].name, "human");
	assert.equal(alagondar.prerequisite[0].race[0]._displayName, "人類");
	assert.match(Renderer.utils.prerequisite.getHtml(alagondar.prerequisite), /人類（Human）/u);

	const anvilwrought = charoptions.charoption.find(it => it.name === "Anvilwrought");
	assert.equal(anvilwrought.entries[1].entries[0]._displayName, "構裝生物耐力（Constructed Resilience）");
	assert.match(Renderer.get().render(anvilwrought.entries[1].entries[0]), /構裝生物耐力（Constructed Resilience）/u);

	const {localized: rewards} = await pGetLocalizedData("rewards.json");
	const ancientSeal = rewards.reward.find(it => it.name === "Ancient Seal");
	assert.equal(I18n.getBilingualName(ancientSeal), "古代封印（Ancient Seal）");
	assert.equal(ancientSeal.entries[1].entries[0]._displayName, "宣言（Pronouncement）");
	assert.match(Renderer.reward.getRenderedString(ancientSeal), /詛咒（Curse）/u);

	const unkh = rewards.reward.find(it => it.name === "Unkh");
	assert.equal(unkh.entries[0].items[5]._displayName, "能力（Power）：");
	assert.match(Renderer.get().render(unkh.entries[0].items[5]), /能力（Power）：/u);
	assert.match(unkh.entries[0].items[5].entry, /體質屬性值變為23/u);
	assert.equal(unkh.entries[0].items[5].type, "item");
});

test("language and deity metadata render in zh-TW with English terminology", async () => {
	const {localized: languages} = await pGetLocalizedData("languages.json");
	const primordial = languages.language.find(it => it.name === "Primordial" && it.source === "PHB");
	const languageMeta = Renderer.language.getLanguageRenderableEntriesMeta(primordial);
	assert.equal(I18n.getBilingualName(primordial), "原初語（Primordial）");
	assert.equal(languageMeta.entryType, "{@i 奇異語言（Exotic Language）}");
	assert.match(languageMeta.entryScript, /矮人語（Dwarvish）/u);
	assert.match(languageMeta.entriesContent.at(-1), /氣族語（Auran）.*水族語（Aquan）.*火族語（Ignan）.*土族語（Terran）/u);
	assert.doesNotMatch(languageMeta.entriesContent.join(" "), /This language is a family|Creatures that speak different dialects/iu);

	const deepSpeech = languages.language.find(it => it.name === "Deep Speech" && it.source === "PHB");
	assert.match(Renderer.language.getLanguageRenderableEntriesMeta(deepSpeech).entryScript, /無文字（none）/u);

	const {localized: deities} = await pGetLocalizedData("deities.json");
	const abbathor = deities.deity.find(it => it.name === "Abbathor" && it.source === "MTF");
	const deityAttributes = Renderer.deity.getDeityRenderableEntriesMeta(abbathor).entriesAttributes.join("\n");
	assert.equal(I18n.getBilingualName(abbathor), "阿巴索（Abbathor）");
	assert.match(deityAttributes, /陣營（Alignment）/u);
	assert.match(deityAttributes, /矮人（Dwarven）/u);
	assert.match(deityAttributes, /詭術（Trickery）/u);
	assert.match(deityAttributes, /貪婪/u);
	assert.match(deityAttributes, /聖徽（Symbol）/u);

	const athreos = deities.deity.find(it => it.name === "Athreos" && it.source === "MOT");
	const athreosMyth = athreos.entries[0].entries[3].entries[3];
	assert.equal(athreosMyth._displayName, "雅睿歐斯的傳說（Myths of Athreos）");
	assert.match(Renderer.get().render(athreosMyth), /雅睿歐斯的傳說（Myths of Athreos）/u);

	const arwai = deities.deity.find(it => it.name === "Arawai" && it.source === "ERLW");
	assert.equal(arwai.symbolImg.title, "天命諸神");

	const bahgtruParent = deities.deity.find(it => it.name === "Bahgtru" && it.source === "SCAG");
	const bahgtruChildRaw = readJson("data/deities.json").deity.find(it => it.name === "Bahgtru" && it.source === "VGM");
	const bahgtruMerged = {...I18n.getCanonicalEntity(bahgtruParent), ...bahgtruChildRaw};
	const [bahgtru] = await I18n.pApplyEntities({
		prop: "deity",
		file: "deities.json",
		entities: [bahgtruMerged],
		fnLoad: async () => readJson(`${FOLDER}/deities.json`),
	});
	assert.equal(I18n.getBilingualField(bahgtru, "domains"), "戰爭（War）");
	assert.match(bahgtru.symbolImg?.title || "", /\p{Script=Han}|^$/u);
});

test("sidecars contain Chinese-only prose and a passing guarded import report", () => {
	const contentKeys = new Set([
		"name", "shortName", "caption", "title", "label", "by", "text", "quote", "author", "note",
		"entries", "entry", "items", "footnotes", "headerEntries", "footerEntries", "colLabels", "rowLabels", "rows", "row", "tables", "default", "columns",
	]);
	const rootExtra = {
		charoption: ["prerequisite"],
		language: ["dialects", "origin", "typicalSpeakers"],
		deity: ["altNames", "category", "domains", "pantheon", "plane", "province", "symbol", "symbolImg", "title", "worshipers"],
	};
	const ignoredKeys = new Set(["ENG_name", "ENG_shortName", "type", "style", "colStyles", "rowStyles", "href", "path", "credit", "source", "page", "data"]);
	const untranslated = [];
	const stripTags = value => {
		let out = value;
		let previous;
		do {
			previous = out;
			out = out.replace(/\{@[^{}]*\}/gu, "");
		} while (out !== previous);
		return out.replace(/<[^>]*>/gu, "");
	};
	const visitVisible = (value, context) => {
		if (typeof value === "string") {
			if (/[A-Za-z]{3,}/u.test(stripTags(value))) untranslated.push({context, value});
			return;
		}
		if (Array.isArray(value)) return value.forEach((child, ix) => visitVisible(child, `${context}/${ix}`));
		if (!value || typeof value !== "object") return;
		for (const [key, child] of Object.entries(value)) {
			if (ignoredKeys.has(key) || !contentKeys.has(key)) continue;
			visitVisible(child, `${context}/${key}`);
		}
	};

	for (const file of ["charcreationoptions.json", "rewards.json", "languages.json", "deities.json"]) {
		const sidecar = readJson(`${FOLDER}/${file}`);
		for (const [prop, entities] of Object.entries(sidecar)) {
			if (!Array.isArray(entities)) continue;
			entities.forEach((entity, ix) => {
				for (const key of contentKeys) if (key in entity) visitVisible(entity[key], `${file}/${prop}/${ix}/${key}`);
				for (const key of rootExtra[prop] || []) if (key in entity) visitVisible(entity[key], `${file}/${prop}/${ix}/${key}`);
			});
		}
	}
	assert.deepEqual(untranslated, [], `English remains in visible prose: ${JSON.stringify(untranslated.slice(0, 5))}`);

	const report = readJson("translation/zh-TW/reference-pages/generated/reference-pages-import-report.json");
	assert.equal(report.status, "pass");
	assert.deepEqual(report.counts, {
		charoption: 44,
		charoptionFluff: 5,
		reward: 277,
		rewardFluff: 0,
		language: 201,
		languageScript: 6,
		languageFluff: 26,
		deity: 563,
	});
	assert.deepEqual(report.canonicalFailures, []);
	assert.deepEqual(report.qa.untranslatedVisibleStrings, []);
	assert.deepEqual(report.qa.numericUnresolved, []);
});

test("page lists, filters, dynamic labels, and HTML shells use the localized runtime", () => {
	const pageChecks = {
		"js/charcreationoptions.js": [/getBilingualName\(it\)/u, /_fOptionTypeDisplay/u],
		"js/rewards.js": [/getBilingualName\(reward\)/u, /getRewardType\(reward\.type/u],
		"js/languages.js": [/getBilingualName\(it\)/u, /字型（Fonts）/u, /下載（Downloads）/u],
		"js/deities.js": [/getBilingualName\(ent\)/u, /getBilingualField\(ent, "domains"\)/u],
	};
	for (const [file, patterns] of Object.entries(pageChecks)) {
		const source = readText(file);
		patterns.forEach(pattern => assert.match(source, pattern, `${file} is missing localized runtime integration`));
	}

	const renderSource = readText("js/render.js");
	for (const text of [
		"陣營（Alignment）",
		"領域（Domains）",
		"典型使用者（Typical Speakers）",
		"你可以用此特性取代背景的標準特性。",
	]) assert.match(renderSource, new RegExp(text.replace(/[()[\]{}.*+?^$|\\]/g, "\\$&"), "u"));
	assert.match(renderSource, /entry\._displayName \|\| entry\.name/u, "generic nested headings do not honor bilingual display names");

	for (const [file, title] of [
		["charcreationoptions.html", "其他角色創建選項"],
		["rewards.html", "超自然贈禮與獎勵"],
		["languages.html", "語言"],
		["deities.html", "神祇"],
	]) {
		const html = readText(file);
		assert.match(html, new RegExp(`<title>${title} - 5etools<\\/title>`, "u"));
		assert.match(html, /src="js\/zh-tw\/content-i18n\.js"/u);
	}
});

console.log("Reference-page localization tests: PASS");
console.log("44 character options; 277 rewards; 201 languages; 563 deities; bilingual headings and Chinese prose.");
