import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {I18nZhTwAdventure} from "../../js/zh-tw/adventure-i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const canonical = read("data/adventure/adventure-cos.json");
const localized = read("data/zh-TW/adventures/adventure-cos.json");
const index = read("data/adventures.json").adventure.find(it => it.id === "CoS");
const originalSnapshot = JSON.stringify(canonical);
const translationSnapshot = JSON.stringify(localized);
const view = I18nZhTwAdventure.createLocalizedView({canonical, localized, index});
assert.equal(JSON.stringify(canonical), originalSnapshot);
assert.equal(JSON.stringify(localized), translationSnapshot);
assert.equal(view.dataDocument.data.length, 26);
assert.equal(view.index.contents.length, 26);
assert.match(view.index.name, /^施特拉德的詛咒（Curse of Strahd）$/u);

const visibleKeys = I18nZhTwAdventure._visibleKeys;
let strings = 0;
let headings = 0;
let readaloud = 0;
let maps = 0;
const walk = (en, zh, context) => {
	if (typeof en === "string") {
		assert.equal(typeof zh, "string", `Missing string ${context}`);
		strings++;
		return;
	}
	if (Array.isArray(en)) {
		assert.equal(zh.length, en.length, `Array shape ${context}`);
		en.forEach((it, ix) => walk(it, zh[ix], `${context}/${ix}`));
		return;
	}
	if (!en || typeof en !== "object") return assert.deepEqual(zh, en, context);
	if (en.type === "insetReadaloud") readaloud++;
	if (en.imageType === "map" || en.imageType === "mapPlayer") maps++;
	for (const [key, value] of Object.entries(en)) {
		if (!visibleKeys.has(key)) {
			assert.deepEqual(zh[key], value, `Canonical metadata/mechanics changed: ${context}/${key}`);
			continue;
		}
		if (key === "name") {
			assert.equal(zh.ENG_name, value, `Heading identity: ${context}`);
			if (/[A-Za-z]{2}/u.test(value)) assert.match(zh.name, /\p{Script=Han}/u, `Untranslated heading: ${context}`);
			headings++;
		}
		walk(value, zh[key], `${context}/${key}`);
	}
};
walk(canonical.data, localized.data, "data");
assert.equal(readaloud, 684);
assert.equal(headings, 1277);

const tagPattern = /\{@(\w+) ([^{}]*)\}/gu;
const referenceTags = new Set(["creature", "spell", "item", "skill", "condition", "sense", "recipe", "deck", "hazard", "status", "table", "reward", "variantrule", "race", "background"]);
const signature = document => {
	const out = [];
	for (const [, tag, body] of JSON.stringify(document).matchAll(tagPattern)) {
		const parts = body.split("|");
		if (referenceTags.has(tag)) out.push([tag, parts[0], parts[1] || ""]);
		else if (tag === "card") out.push([tag, ...parts.slice(0, 3)]);
		else if (tag === "quickref") out.push([tag, ...Array.from({length: 4}, (_, ix) => parts[ix] || "")]);
		else if (["area", "book", "adventure"].includes(tag)) out.push([tag, ...parts.slice(1)]);
		else if (["dc", "dice", "chance", "hit", "atk"].includes(tag)) out.push([tag, parts[0]]);
	}
	return out.map(it => JSON.stringify(it)).sort();
};
assert.deepEqual(signature(localized.data), signature(canonical.data), "A reference target or dice formula changed");
assert.equal(signature(canonical.data).filter(it => it.startsWith('["card"')).length, 145);
assert.equal(signature(canonical.data).filter(it => it.startsWith('["area"')).length, 1038);
assert.ok(!/計程車兵|計程車氣|枯枝撞擊|藍水旅店|裡希滕/u.test(JSON.stringify(localized.data)), "Uncorrected source typo/term variant remains");

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
globalThis.VetoolsConfig = {get: () => "one"};
globalThis.DataLoader = {getAllFromCacheAll: () => []};
const originalIds = Renderer.adventureBook.getEntryIdLookup(canonical.data);
const displayIds = Renderer.adventureBook.getEntryIdLookup(view.dataDocument.data);
assert.deepEqual(Object.keys(displayIds), Object.keys(originalIds));
for (const id of Object.keys(originalIds)) {
	assert.equal(displayIds[id].chapter, originalIds[id].chapter, `Area chapter changed: ${id}`);
	assert.equal(displayIds[id].name, originalIds[id].name, `Area hash heading changed: ${id}`);
}

let titleCount = 0;
for (let ix = 0; ix < 26; ix++) {
	const render = data => {
		const renderer = new Renderer().setFirstSection(true).setEnumerateTitlesRel(true).setTrackTitles(true).resetHeaderIndex().setHeaderIndexTableCaptions(true);
		const stack = [];
		renderer.recursiveRender(data, stack);
		return {html: stack.join(""), titles: renderer.getTrackedTitles()};
	};
	const original = render(canonical.data[ix]);
	const translated = render(view.dataDocument.data[ix]);
	assert.deepEqual(translated.titles, original.titles, `Tracked heading/hash order changed in chapter ${ix}`);
	assert.match(translated.html, /\p{Script=Han}/u, `Chapter ${ix} did not render Chinese`);
	assert.doesNotMatch(translated.html, /undefined|\[object Object\]/u, `Broken render in chapter ${ix}`);
	titleCount += Object.keys(translated.titles).length;
}

// Run the actual book search against the complete translated adventure.
globalThis.veT = (parts, ...values) => ({vee: {txt: () => parts.reduce((out, part, ix) => `${out}${part}${values[ix] ?? ""}`, "").replace(/<[^>]*>/g, "")}});
globalThis.RenderMap = {};
globalThis.I18nZhTwAdventure = I18nZhTwAdventure;
const bookSource = fs.readFileSync(path.join(ROOT, "js/bookutils.js"), "utf8").replace(/^import .*;\n/gm, "");
const {BookUtil} = await import(`data:text/javascript;base64,${Buffer.from(bookSource).toString("base64")}`);
BookUtil.curRender.data = view.dataDocument.data;
BookUtil.referenceI18n = view.adapter;
for (const term of ["施特拉德", "藍水旅館", "琥珀神殿", "死亡之屋", "Strahd", "Blue Water Inn", "Amber Temple", "sturdy wooden door"]) {
	const results = BookUtil.Search.doSearch(term, false);
	assert.ok(results.length, `No result for ${term}`);
	for (const result of results) assert.doesNotMatch(result.header || "", /\p{Script=Han}/u, `Search returned translated hash for ${term}`);
}
assert.ok(BookUtil.Search.doSearch("186", true).length, "Page-number navigation failed");

// Exercise the actual data-loading hook, including a switch back to an
// untranslated adventure, so a passing sidecar alone cannot mask a load-order bug.
const originalFetch = globalThis.fetch;
const originalLoad = DataUtil.loadJSON;
let renderedChapter;
let populatedIndex;
let pageTitle;
let fetchCount = 0;
globalThis.fetch = async () => { fetchCount++; return {ok: true, json: async () => localized}; };
DataUtil.loadJSON = async () => canonical;
globalThis.veEs = () => ({vee: {txt: value => { pageTitle = value; }}});
BookUtil._doPopulateContents = ({book}) => { populatedIndex = book; };
BookUtil._showBookContent = (data, fromIndex) => { renderedChapter = {data, fromIndex}; };
BookUtil._addSearch = () => {};
BookUtil.contentType = "adventure";
BookUtil.referenceId = null;
BookUtil.referenceData = null;
BookUtil.baseDataUrl = "data/adventure/adventure-";
try {
	await BookUtil._pLoadChapter(index, "cos", ["6"], null, {});
	assert.match(renderedChapter.data[6].entries[0], /\p{Script=Han}/u);
	assert.match(populatedIndex.contents[6].name, /瓦拉吉/u);
	assert.match(pageTitle, /施特拉德的詛咒/u);
	assert.ok(BookUtil.referenceI18n);
	assert.equal(fetchCount, 1);
	await BookUtil._pLoadChapter({...index, id: "LMoP", name: "Lost Mine of Phandelver"}, "lmop", ["0"], null, {});
	assert.equal(BookUtil.referenceI18n, null);
	assert.strictEqual(renderedChapter.data, canonical.data);
	assert.equal(fetchCount, 1);
} finally {
	globalThis.fetch = originalFetch;
	DataUtil.loadJSON = originalLoad;
	I18nZhTwAdventure._loadPromise = null;
}

let calls = 0;
assert.equal(await I18nZhTwAdventure.pGetView({bookId: "LMoP", canonical, index, fnLoad: () => calls++}), null);
assert.equal(calls, 0, "Other adventures must not fetch the CoS translation");
const invalid = structuredClone(localized);
invalid.data[1].entries.pop();
assert.throws(() => I18nZhTwAdventure.createLocalizedView({canonical, localized: invalid, index}), /mismatch/u);
const oldWarn = console.warn;
console.warn = () => {};
try {
	assert.equal(await I18nZhTwAdventure.pGetView({bookId: "cos", canonical, index, fnLoad: () => { throw new Error("offline"); }}), null);
} finally { console.warn = oldWarn; }

console.log(JSON.stringify({chapters: 26, visibleStrings: strings, headings, readaloud, maps, trackedTitles: titleCount, areaTargets: Object.keys(originalIds).length, bilingualSearch: "passed", canonicalLinksAndDice: "passed", pageLoading: "passed", fallback: "passed"}));
