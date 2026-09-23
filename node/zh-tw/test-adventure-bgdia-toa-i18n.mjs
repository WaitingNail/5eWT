import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {I18nZhTwAdventure} from "../../js/zh-tw/adventure-i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const indexes = read("data/adventures.json").adventure;
const books = Object.fromEntries(["bgdia", "toa"].map(id => [id, {
	canonical: read(`data/adventure/adventure-${id}.json`),
	localized: read(`data/zh-TW/adventures/adventure-${id}.json`),
	index: indexes.find(it => it.id.toLowerCase() === id),
}]));

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
globalThis.VetoolsConfig = {get: () => "one"};
globalThis.DataLoader = {getAllFromCacheAll: () => []};
globalThis.veT = (parts, ...values) => ({vee: {txt: () => parts.reduce((out, part, ix) => `${out}${part}${values[ix] ?? ""}`, "").replace(/<[^>]*>/g, "")}});
globalThis.RenderMap = {};
globalThis.I18nZhTwAdventure = I18nZhTwAdventure;
const bookSource = fs.readFileSync(path.join(ROOT, "js/bookutils.js"), "utf8").replace(/^import .*;\n/gm, "");
const {BookUtil} = await import(`data:text/javascript;base64,${Buffer.from(bookSource).toString("base64")}`);

const tagPattern = /\{@(\w+) ([^{}]*)\}/gu;
const refs = new Set(["creature", "spell", "item", "skill", "condition", "sense", "recipe", "deck", "hazard", "status", "table", "reward", "variantrule", "race", "background", "vehicle", "vehupgrade", "action", "feat", "disease", "language"]);
const signature = text => [...text.matchAll(tagPattern)].flatMap(([, tag, body]) => {
	const parts = body.split("|");
	if (tag === "class") return [JSON.stringify([tag, parts[0], parts[1] || "", ...parts.slice(3)])];
	if (["card", "deity"].includes(tag)) return [JSON.stringify([tag, ...Array.from({length: 3}, (_, ix) => parts[ix] || "")])];
	if (tag === "skillCheck") return [JSON.stringify([tag, parts[0]])];
	if (refs.has(tag)) return [JSON.stringify([tag, parts[0], parts[1] || ""])];
	if (tag === "quickref") return [JSON.stringify([tag, ...Array.from({length: 4}, (_, ix) => parts[ix] || "")])];
	if (["area", "book", "adventure", "filter", "link"].includes(tag)) return [JSON.stringify([tag, ...parts.slice(1)])];
	if (["dc", "dice", "damage", "chance", "hit", "atk", "recharge"].includes(tag)) return [JSON.stringify([tag, parts[0]])];
	return [];
}).sort();

const summaries = [];
const literals = read("translation/zh-TW/adventures/bgdia-toa/preserved-literals.json");
const walk = (en, zh, context, count) => {
	if (typeof en === "string") {
		assert.equal(typeof zh, "string", context);
		assert.deepEqual(signature(zh), signature(en), `Reference or mechanic changed: ${context}`);
		assert.doesNotMatch(zh, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|undefined|\[object Object\]/u, context);
		const book = context.split("/")[0];
		const sourceContext = context.replace(/^[^/]+/u, "data");
		const isPronunciation = book === "toa" && /^data\/0\/entries\/1\/entries\/1\/rows\/\d+\/1$/u.test(sourceContext);
		if (isPronunciation) assert.equal(zh, en, `Pronunciation changed: ${context}`);
		if (!sourceContext.startsWith(book === "bgdia" ? "data/17/" : "data/12/") && !isPronunciation) {
			let visible = Renderer.stripTags(zh).replace(/\b(?:NPC|DM|DC|AC|HP|XP|GP|SP|CP|PP|EP|PDF|percent)\b/giu, "");
			if (literals[book][sourceContext]) {
				const entry = literals[book][sourceContext];
				assert.equal(entry.english, en, `Stale literal source: ${context}`);
				for (const token of entry.tokens) {
					assert.ok(zh.includes(token), `Literal lost: ${context}/${token}`);
					visible = visible.replaceAll(token, "");
				}
			}
			assert.doesNotMatch(visible, /[A-Za-z]{3,}/u, `Unreviewed English display: ${context}`);
		}
		count.strings++;
		return;
	}
	if (Array.isArray(en)) {
		assert.equal(zh.length, en.length, context);
		en.forEach((value, ix) => walk(value, zh[ix], `${context}/${ix}`, count));
		return;
	}
	if (!en || typeof en !== "object") return assert.deepEqual(zh, en, context);
	if (en.type === "insetReadaloud") count.readaloud++;
	if (en.imageType === "map" || en.imageType === "mapPlayer") count.maps++;
	for (const [key, value] of Object.entries(en)) {
		if (!I18nZhTwAdventure._visibleKeys.has(key)) {
			assert.deepEqual(zh[key], value, `Metadata/structure changed: ${context}/${key}`);
			continue;
		}
		if (key === "name") {
			assert.equal(zh.ENG_name, value, `Heading identity: ${context}`);
			if (/[A-Za-z]{2}/u.test(value) && !["Kobold Press", "D&D Beyond"].includes(value)) assert.match(zh.name, /\p{Script=Han}/u, `Untranslated heading ${context}`);
			const room = value.match(/^((?:[A-Z]{1,3})?\d+[a-z]?)[.:]\s/u)?.[1];
			if (room) assert.ok(zh.name.startsWith(room), `Room number lost: ${context}`);
			count.headings++;
		}
		walk(value, zh[key], `${context}/${key}`, count);
	}
};
const render = data => {
	const renderer = new Renderer().setFirstSection(true).setEnumerateTitlesRel(true).setTrackTitles(true).resetHeaderIndex().setHeaderIndexTableCaptions(true);
	const stack = [];
	renderer.recursiveRender(data, stack);
	return {html: stack.join(""), titles: renderer.getTrackedTitles()};
};
for (const [id, book] of Object.entries(books)) {
	const {canonical, localized, index} = book;
	const snapshots = [JSON.stringify(canonical), JSON.stringify(localized)];
	const view = I18nZhTwAdventure.createLocalizedView(book);
	book.view = view;
	assert.deepEqual([JSON.stringify(canonical), JSON.stringify(localized)], snapshots, "Source was mutated");
	assert.equal(view.dataDocument.data.length, id === "bgdia" ? 18 : 14);
	assert.equal(view.index.contents.length, canonical.data.length);
	const count = {book: id, chapters: canonical.data.length, strings: 0, headings: 0, readaloud: 0, maps: 0, trackedTitles: 0};
	walk(canonical.data, localized.data, id, count);
	const originalIds = Renderer.adventureBook.getEntryIdLookup(canonical.data);
	const viewIds = Renderer.adventureBook.getEntryIdLookup(view.dataDocument.data);
	assert.deepEqual(Object.keys(viewIds), Object.keys(originalIds));
	for (const key of Object.keys(originalIds)) {
		assert.equal(viewIds[key].chapter, originalIds[key].chapter, `Area chapter ${id}/${key}`);
		assert.equal(viewIds[key].name, originalIds[key].name, `Area anchor ${id}/${key}`);
	}
	count.areaTargets = Object.keys(originalIds).length;
	for (let ix = 0; ix < canonical.data.length; ix++) {
		const original = render(canonical.data[ix]);
		const translated = render(view.dataDocument.data[ix]);
		assert.deepEqual(translated.titles, original.titles, `Heading/hash order ${id}/${ix}`);
		assert.match(translated.html, /\p{Script=Han}/u, `Chapter did not render Chinese: ${id}/${ix}`);
		assert.doesNotMatch(translated.html, /undefined|\[object Object\]/u, `Broken HTML ${id}/${ix}`);
		count.trackedTitles += Object.keys(translated.titles).length;
	}
	BookUtil.curRender.data = view.dataDocument.data;
	BookUtil.referenceI18n = view.adapter;
	const terms = id === "bgdia" ? ["艾爾托瑞爾", "Elturel", "Zariel"] : ["楚爾特", "Chult", "Acererak"];
	for (const term of terms) {
		const results = BookUtil.Search.doSearch(term, false);
		assert.ok(results.length, `No result for ${id}/${term}`);
		for (const result of results) assert.doesNotMatch(result.header || "", /\p{Script=Han}/u, `Translated search anchor: ${id}/${term}`);
	}
	assert.ok(BookUtil.Search.doSearch(`${canonical.data[0].page}`, true).length, `Page search failed: ${id}`);
	const report = read(`translation/zh-TW/adventures/bgdia-toa/${id}-import-review.json`);
	for (const field of ["tagCanonicalDifferences", "unmatchedTranslatedTags", "diceDifferences", "numericReview", "termConflicts"]) assert.equal(report[field].length, 0, `Unresolved QA: ${id}/${field}`);
	for (const item of report.untranslatedVisibleStrings) assert.ok(item.context.startsWith(id === "bgdia" ? "data/17/" : "data/12/") || item.english === "NPC" || !/[A-Za-z]{3,}/u.test(Renderer.stripTags(item.english)), `Untranslated prose: ${id}/${item.context}`);
	summaries.push(count);
}

// Source-derived mechanics and semantic regressions, including positive controls.
const at = (book, context) => context.split("/").reduce((node, key) => node[key], books[book].localized);
assert.match(at("bgdia", "data/10/entries/6/entries/3/entries/0"), /\{@class Warlock\|\|邪魔\|Fiend\}/u);
assert.match(at("bgdia", "data/1/entries/8/entries/5/entries/2/entries/3/entries/0"), /六.*Skeleton.*或.*四.*Zombie/u);
assert.match(at("bgdia", "data/10/entries/3"), /最下級魔鬼.*無法.*下級.*上級.*唯有魔鬼大公/u);
assert.match(at("bgdia", "data/10/entries/8/entries/4/entries/6/entries/0"), /直到契約履行完畢才會消失/u);
assert.match(at("bgdia", "data/1/entries/10/entries/4/entries/2/entries/1/items/1"), /52.*園丁兼馬廄主管/u);
assert.match(at("toa", "data/5/entries/4/entries/1/rows/7/5"), /體質.*23/u);
assert.match(at("toa", "data/5/entries/4/entries/1/rows/4/5"), /所有.*同調.*解除/u);
assert.match(at("toa", "data/2/entries/4/entries/40/entries/2/entries/0"), /120/u);
assert.match(at("toa", "data/5/entries/9/entries/15/entries/5/entries/0/rows/7/1"), /智力.*\{@dice 1d4 \+ 1\}.*22/u);
assert.match(at("toa", "data/5/entries/6/entries/2/entries/1"), /塑能.*幻術/u);
assert.match(at("toa", "data/4/entries/4/entries/20/entries/2"), /代主人發問/u);
assert.match(at("toa", "data/0/entries/0/entries/0/entries/1"), /敘事大師/u);
assert.match(at("toa", "data/3/entries/4/entries/17/entries/4/entries/2/entries/4"), /投下.*身影.*Always joined to its caster/u);
for (const book of Object.keys(books)) {
	const text = JSON.stringify(books[book].localized.data);
	assert.doesNotMatch(text, /Kupalu&eacute;|索申斯塔河河|象鼻蟲是第一個|正統惡魔|球形area/u);
}

// Exercise real loading, independent caches, and safe fallbacks across campaigns.
const cos = {canonical: read("data/adventure/adventure-cos.json"), localized: read("data/zh-TW/adventures/adventure-cos.json"), index: indexes.find(it => it.id === "CoS")};
const allBooks = {...books, cos, ...Object.fromEntries(["wdh", "hotdq", "rot", "vnotee", "veor", "oota"].map(id => [id, {canonical: read(`data/adventure/adventure-${id}.json`), localized: read(`data/zh-TW/adventures/adventure-${id}.json`), index: indexes.find(it => it.id.toLowerCase() === id)}]))};
const originalFetch = globalThis.fetch;
const originalLoad = DataUtil.loadJSON;
const fetches = [];
let rendered, pageTitle;
globalThis.fetch = async url => {
	const id = url.match(/adventure-([^.]+)\.json$/)?.[1];
	assert.ok(allBooks[id], `Wrong translation URL ${url}`);
	fetches.push(id);
	return {ok: true, json: async () => allBooks[id].localized};
};
DataUtil.loadJSON = async url => allBooks[url.match(/adventure-([^.]+)\.json$/)?.[1]]?.canonical || books.bgdia.canonical;
globalThis.veEs = () => ({vee: {txt: value => { pageTitle = value; }}});
BookUtil._doPopulateContents = () => {};
BookUtil._showBookContent = (data, index) => { rendered = {data, index}; };
BookUtil._addSearch = () => {};
BookUtil.contentType = "adventure";
BookUtil.referenceId = null;
BookUtil.referenceData = null;
BookUtil.baseDataUrl = "data/adventure/adventure-";
I18nZhTwAdventure._loadPromises.clear();
try {
	for (const id of ["bgdia", "toa", "oota", "vnotee", "veor", "wdh", "cos", "hotdq", "rot", "bgdia", "toa"]) {
		const chapter = allBooks[id].canonical.data.length > 1 ? 1 : 0;
		await BookUtil._pLoadChapter(allBooks[id].index, id, [`${chapter}`], null, {});
		assert.match(pageTitle, new RegExp(allBooks[id].localized.adventure.name, "u"));
		assert.equal(rendered.data[chapter]._displayName, `${allBooks[id].localized.data[chapter].name}（${allBooks[id].canonical.data[chapter].name}）`);
		assert.ok(BookUtil.referenceI18n);
	}
	assert.deepEqual(fetches, ["bgdia", "toa", "oota", "vnotee", "veor", "wdh", "cos", "hotdq", "rot"], "Per-book cache failed");
	await BookUtil._pLoadChapter({...books.bgdia.index, id: "LMoP", name: "Lost Mine of Phandelver"}, "lmop", ["0"], null, {});
	assert.equal(BookUtil.referenceI18n, null);
	assert.equal(fetches.length, 9);
	assert.strictEqual(rendered.data, books.bgdia.canonical.data);
} finally {
	globalThis.fetch = originalFetch;
	DataUtil.loadJSON = originalLoad;
	I18nZhTwAdventure._loadPromises.clear();
}
const oldWarn = console.warn;
console.warn = () => {};
try {
	for (const id of Object.keys(books)) {
		assert.equal(await I18nZhTwAdventure.pGetView({...books[id], bookId: id, fnLoad: () => { throw new Error("offline"); }}), null);
		assert.equal(await I18nZhTwAdventure.pGetView({...books[id], bookId: id, fnLoad: () => cos.localized}), null);
		const invalid = structuredClone(books[id].localized);
		invalid.data[0].entries.pop();
		assert.throws(() => I18nZhTwAdventure.createLocalizedView({...books[id], localized: invalid}), /mismatch/u);
	}
} finally { console.warn = oldWarn; }
console.log(JSON.stringify({books: summaries, bilingualSearch: "passed", canonicalLinksAndMechanics: "passed", allChaptersRendered: "passed", crossBookCache: "passed", pageLoadingAndFallback: "passed"}));
