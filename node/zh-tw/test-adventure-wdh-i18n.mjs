import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {I18nZhTwAdventure} from "../../js/zh-tw/adventure-i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const indexes = read("data/adventures.json").adventure;
const books = Object.fromEntries(["wdh"].map(id => [id, {
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
const refs = new Set(["creature", "spell", "item", "skill", "condition", "sense", "recipe", "deck", "hazard", "status", "table", "reward", "variantrule", "race", "background"]);
const signature = text => [...text.matchAll(tagPattern)].flatMap(([, tag, body]) => {
	const parts = body.split("|");
	if (refs.has(tag)) return [JSON.stringify([tag, parts[0], parts[1] || ""])];
	if (tag === "quickref") return [JSON.stringify([tag, ...Array.from({length: 4}, (_, ix) => parts[ix] || "")])];
	if (["area", "book", "adventure", "filter", "link"].includes(tag)) return [JSON.stringify([tag, ...parts.slice(1)])];
	if (["dc", "dice", "damage", "chance", "hit", "atk", "recharge"].includes(tag)) return [JSON.stringify([tag, parts[0]])];
	return [];
}).sort();

const summaries = [];
const walk = (en, zh, context, count) => {
	if (typeof en === "string") {
		assert.equal(typeof zh, "string", context);
		assert.deepEqual(signature(zh), signature(en), `Reference or mechanic changed: ${context}`);
		assert.doesNotMatch(zh, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|undefined|\[object Object\]/u, context);
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
			if (/[A-Za-z]{2}/u.test(value) && value !== "Kobold Press") assert.match(zh.name, /\p{Script=Han}/u, `Untranslated heading ${context}`);
			const room = value.match(/^([A-Z]{0,2}\d+[A-Za-z]?\.)\s/u)?.[1];
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
	assert.equal(view.dataDocument.data.length, 16);
	assert.equal(view.index.contents.length, 16);
	const count = {book: id, chapters: 16, strings: 0, headings: 0, readaloud: 0, maps: 0, trackedTitles: 0};
	walk(canonical.data, localized.data, id, count);
	const originalIds = Renderer.adventureBook.getEntryIdLookup(canonical.data);
	const viewIds = Renderer.adventureBook.getEntryIdLookup(view.dataDocument.data);
	assert.deepEqual(Object.keys(viewIds), Object.keys(originalIds));
	for (const key of Object.keys(originalIds)) {
		assert.equal(viewIds[key].chapter, originalIds[key].chapter, `Area chapter ${id}/${key}`);
		assert.equal(viewIds[key].name, originalIds[key].name, `Area anchor ${id}/${key}`);
	}
	count.areaTargets = Object.keys(originalIds).length;
	for (let ix = 0; ix < 16; ix++) {
		const original = render(canonical.data[ix]);
		const translated = render(view.dataDocument.data[ix]);
		assert.deepEqual(translated.titles, original.titles, `Heading/hash order ${id}/${ix}`);
		assert.match(translated.html, /\p{Script=Han}/u, `Chapter did not render Chinese: ${id}/${ix}`);
		assert.doesNotMatch(translated.html, /undefined|\[object Object\]/u, `Broken HTML ${id}/${ix}`);
		count.trackedTitles += Object.keys(translated.titles).length;
	}
	BookUtil.curRender.data = view.dataDocument.data;
	BookUtil.referenceI18n = view.adapter;
	const terms = ["巨魔顱骨巷", "格勞洪德", "姍娜薩", "Trollskull Alley", "Gralhund", "Xanathar"];
	for (const term of terms) {
		const results = BookUtil.Search.doSearch(term, false);
		assert.ok(results.length, `No result for ${id}/${term}`);
		for (const result of results) assert.doesNotMatch(result.header || "", /\p{Script=Han}/u, `Translated search anchor: ${id}/${term}`);
	}
	assert.ok(BookUtil.Search.doSearch(`${canonical.data[1].page}`, true).length, `Page search failed: ${id}`);
	const report = read(`translation/zh-TW/adventures/wdh/${id}-import-review.json`);
	for (const field of ["tagCanonicalDifferences", "unmatchedTranslatedTags", "diceDifferences", "numericReview", "termConflicts"]) assert.equal(report[field].length, 0, `Unresolved QA: ${id}/${field}`);
	for (const item of report.untranslatedVisibleStrings) assert.ok(item.context.startsWith("data/15/") || item.english === "AI-gorn foo-OH-koh" || /^\{@dice /.test(item.english), `Untranslated prose: ${id}/${item.context}`);
	summaries.push(count);
}

// Assert semantic identity, not just the multiset of tags: Chinese prose can
// legitimately reorder several creature references in the same sentence.
const wdh = books.wdh.localized.data;
const targetNames = text => [...text.matchAll(/\{@creature ([^|}]+)/gu)].map(match => match[1]);
assert.deepEqual(targetNames(wdh[9].entries[2].entries[3].entries[2].entries[0]).slice(0, 3), ["Laeral Silverhand", "Mirt", "Manshoon"]);
assert.deepEqual(targetNames(wdh[8].entries[4].entries[5].entries[6].entries[0]), ["Fel'rekt Lafeen", "drow gunslinger"]);
const pronunciationRows = books.wdh.canonical.data[0].entries[5].entries[0].rows;
assert.equal(pronunciationRows.length, 92);
assert.deepEqual(wdh[0].entries[5].entries[0].rows.map(row => row[1]), pronunciationRows.map(row => row[1]));
assert.match(wdh[2].entries[3].entries[1].entries[2], /姍娜薩公會/u);
assert.match(wdh[2].entries[3].entries[1].entries[4].entries[0], /姍娜薩公會/u);
assert.match(wdh[2].entries[6].entries[0], /姍娜薩公會/u);
assert.match(wdh[5].entries[4].entries[6].entries[1], /姍娜薩公會/u);
assert.match(wdh[9].entries[3].entries[5].entries[4].entries[2].entries[0], /10（\{@dice 3d6/u);
assert.match(wdh[9].entries[3].entries[5].entries[15].entries[3].entries[0], /4枚塔奧爾幣/u);
assert.doesNotMatch(wdh[9].entries[3].entries[5].entries[15].entries[3].entries[0], /白金/u);
assert.match(wdh[10].entries[6].entries[5].entries[20].entries[0], /蕾拉/u);
assert.doesNotMatch(wdh[10].entries[6].entries[5].entries[20].entries[0], /萊拉/u);
assert.equal(wdh[13].entries[3].entries[1].items[2], "3. 瓦婕拉·莎法爾");
assert.equal(wdh[13].entries[3].entries[1].items[54], "55. 杜爾南（店主）");
const repairedNames = {Nat: "納特", "Kaevja Cynavern": "凱夫賈·西納文", "Rishaal the Page-Turner": "翻頁者瑞莎爾"};
for (const file of ["bestiary-wdh.json", "fluff-bestiary-wdh.json"]) {
 const document = read(`data/zh-TW/bestiary/${file}`);
 const entities = document.monster || document.monsterFluff;
 for (const entity of entities) if (repairedNames[entity.ENG_name]) assert.equal(entity.name, repairedNames[entity.ENG_name]);
}

// Exercise the real loader while moving between WDH, HotDQ, RoT, CoS, and an
// untranslated adventure. A singleton cache would incorrectly reuse one book.
const cos = {canonical: read("data/adventure/adventure-cos.json"), localized: read("data/zh-TW/adventures/adventure-cos.json"), index: indexes.find(it => it.id === "CoS")};
const allBooks = {...books, cos, ...Object.fromEntries(["hotdq", "rot"].map(id => [id, {canonical: read(`data/adventure/adventure-${id}.json`), localized: read(`data/zh-TW/adventures/adventure-${id}.json`), index: indexes.find(it => it.id.toLowerCase() === id)}]))};
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
DataUtil.loadJSON = async url => allBooks[url.match(/adventure-([^.]+)\.json$/)?.[1]]?.canonical || books.wdh.canonical;
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
	for (const id of ["wdh", "hotdq", "rot", "cos", "wdh"]) {
		await BookUtil._pLoadChapter(allBooks[id].index, id, ["1"], null, {});
		assert.match(pageTitle, new RegExp(allBooks[id].localized.adventure.name, "u"));
		assert.equal(rendered.data[1]._displayName, `${allBooks[id].localized.data[1].name}（${allBooks[id].canonical.data[1].name}）`);
		assert.ok(BookUtil.referenceI18n);
	}
	assert.deepEqual(fetches, ["wdh", "hotdq", "rot", "cos"], "Per-book cache failed");
	await BookUtil._pLoadChapter({...books.wdh.index, id: "LMoP", name: "Lost Mine of Phandelver"}, "lmop", ["0"], null, {});
	assert.equal(BookUtil.referenceI18n, null);
	assert.equal(fetches.length, 4);
	assert.strictEqual(rendered.data, books.wdh.canonical.data);
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
		invalid.data[1].entries.pop();
		assert.throws(() => I18nZhTwAdventure.createLocalizedView({...books[id], localized: invalid}), /mismatch/u);
	}
} finally { console.warn = oldWarn; }
console.log(JSON.stringify({books: summaries, bilingualSearch: "passed", canonicalLinksAndMechanics: "passed", allChaptersRendered: "passed", crossBookCache: "passed", pageLoadingAndFallback: "passed"}));
