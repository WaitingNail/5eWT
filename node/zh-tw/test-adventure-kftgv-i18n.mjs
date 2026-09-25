import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {I18nZhTwAdventure} from "../../js/zh-tw/adventure-i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const indexes = read("data/adventures.json").adventure;
const books = Object.fromEntries(["kftgv"].map(id => [id, {
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
const literals = read("translation/zh-TW/adventures/kftgv/preserved-literals.json");
const walk = (en, zh, context, count) => {
	if (typeof en === "string") {
		assert.equal(typeof zh, "string", context);
		assert.deepEqual(signature(zh), signature(en), `Reference or mechanic changed: ${context}`);
		assert.doesNotMatch(zh, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|undefined|\[object Object\]/u, context);
		const book = context.split("/")[0];
		const sourceContext = context.replace(/^[^/]+/u, "data");
		if (!sourceContext.startsWith("data/14/")) {
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
			if (/[A-Za-z]{2}/u.test(value) && !/^(?:DC|AC|HP|NPC)$/u.test(value) && !context.startsWith("kftgv/14/")) assert.match(zh.name, /\p{Script=Han}/u, `Untranslated heading ${context}`);
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
	assert.equal(view.dataDocument.data.length, 15);
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
	const terms = ["金庫", "Golden Vault", "Zorhanna", "佐哈娜"];
	for (const term of terms) {
		const results = BookUtil.Search.doSearch(term, false);
		assert.ok(results.length, `No result for ${id}/${term}`);
		for (const result of results) assert.doesNotMatch(result.header || "", /\p{Script=Han}/u, `Translated search anchor: ${id}/${term}`);
	}
	assert.ok(BookUtil.Search.doSearch(`${canonical.data[0].page}`, true).length, `Page search failed: ${id}`);
	const report = read(`translation/zh-TW/adventures/kftgv/${id}-import-review.json`);
	for (const field of ["tagCanonicalDifferences", "unmatchedTranslatedTags", "diceDifferences", "numericReview", "termConflicts"]) assert.equal(report[field].length, 0, `Unresolved QA: ${id}/${field}`);
	for (const item of report.untranslatedVisibleStrings) assert.ok(item.context.startsWith("data/14/") || literals[id][item.context] || !/[A-Za-z]{3,}/u.test(Renderer.stripTags(item.english)), `Untranslated prose: ${id}/${item.context}`);

	summaries.push(count);
}

// Source-derived regressions cover changes with mechanical or puzzle consequences.
const at = context => context.split("/").reduce((node, key) => node[key], books.kftgv.localized);
assert.match(at("data/2/entries/7/entries/4/entries/1/entries/0"), /使用 d12/u);
assert.doesNotMatch(at("data/2/entries/7/entries/4/entries/1/entries/0"), /兩.*骰/u);
assert.match(at("data/3/entries/9/entries/3/entries/28/entries/2"), /farrl'v hrak.*深潛語/u);
assert.match(at("data/5/entries/10/entries/6/entries/5/entries/2/entries/0"), /礦工公會的會長/u);
assert.match(at("data/5/entries/9/entries/2/entries/2"), /主人/u);
assert.match(at("data/3/entries/9/entries/3/entries/19/entries/3/entries/0"), /主浴室/u);
assert.match(at("data/9/entries/10/entries/3/entries/23/entries/4/entries/1"), /自願放棄.*抵抗附身.*豁免/u);
assert.match(at("data/11/entries/3/entries/3"), /天界軍團/u);
assert.match(at("data/11/entries/7/entries/7/entries/3/rows/0/1"), /魔鬼軍團與惡魔大軍/u);
assert.match(at("data/12/entries/9/entries/5/entries/11/entries/1/entries/0"), /奧克（Oak/u);
assert.match(at("data/12/entries/9/entries/5/entries/13/entries/4/entries/0"), /A到Z.*OAK/u);
assert.match(at("data/13/entries/5/entries/3/entries/1"), /教團/u);
assert.match(at("data/13/entries/8/entries/5/entries/28/entries/2/entries/0"), /比 DC 高出10或更多/u);
assert.match(at("data/13/entries/8/entries/5/entries/30/entries/3"), /6環.*atka ignari/u);
assert.match(at("data/12/entries/9/entries/5/entries/15/entries/3/entries/0/entries/3"), /每種每天 1 次/u);
const originalTable = books.kftgv.canonical.data[11].entries[9].entries[3].entries[3];
const translatedTable = at("data/11/entries/9/entries/3/entries/3");
originalTable.rows.forEach((row, ix) => {
 const quotedName = row[1].match(/^"([^"]+)"/u)?.[1];
 if (quotedName) assert.ok(translatedTable.rows[ix][1].includes(quotedName), `True name changed: ${ix}`);
});
const report = read("translation/zh-TW/adventures/kftgv/kftgv-import-review.json");
const numeric = read("translation/zh-TW/adventures/kftgv/numeric-equivalence-review.json");
const {createHash} = await import("node:crypto");
const hash = text => createHash("sha256").update(text).digest("hex");
for (const item of report.numericDifferences) {
 const accepted = numeric[item.context];
 assert.ok(accepted?.reason, `Unreviewed number: ${item.context}`);
 assert.equal(accepted.englishSha256, hash(item.english));
 assert.equal(accepted.localizedSha256, hash(item.localized));
}
assert.doesNotMatch(JSON.stringify(books.kftgv.localized.data), /L3\. L3|G19\. G19|溫室|天界主人|總惡魔|獨奏曲碎片/u);

// Exercise real loading, independent caches, and safe fallbacks across campaigns.
const cos = {canonical: read("data/adventure/adventure-cos.json"), localized: read("data/zh-TW/adventures/adventure-cos.json"), index: indexes.find(it => it.id === "CoS")};
const allBooks = {...books, cos, ...Object.fromEntries(["bgdia", "toa"].map(id => [id, {canonical: read(`data/adventure/adventure-${id}.json`), localized: read(`data/zh-TW/adventures/adventure-${id}.json`), index: indexes.find(it => it.id.toLowerCase() === id)}]))};
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
DataUtil.loadJSON = async url => allBooks[url.match(/adventure-([^.]+)\.json$/)?.[1]]?.canonical || books.kftgv.canonical;
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
	for (const id of ["kftgv", "bgdia", "toa", "cos", "kftgv"]) {
		const chapter = allBooks[id].canonical.data.length > 1 ? 1 : 0;
		await BookUtil._pLoadChapter(allBooks[id].index, id, [`${chapter}`], null, {});
		assert.match(pageTitle, new RegExp(allBooks[id].localized.adventure.name, "u"));
		assert.equal(rendered.data[chapter]._displayName, `${allBooks[id].localized.data[chapter].name}（${allBooks[id].canonical.data[chapter].name}）`);
		assert.ok(BookUtil.referenceI18n);
	}
	assert.deepEqual(fetches, ["kftgv", "bgdia", "toa", "cos"], "Per-book cache failed");
	await BookUtil._pLoadChapter({...books.kftgv.index, id: "LMoP", name: "Lost Mine of Phandelver"}, "lmop", ["0"], null, {});
	assert.equal(BookUtil.referenceI18n, null);
	assert.equal(fetches.length, 4);
	assert.strictEqual(rendered.data, books.kftgv.canonical.data);
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
