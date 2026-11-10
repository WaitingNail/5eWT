import assert from "node:assert/strict";
import fs from "node:fs";
import {I18nZhTwAdventure} from "../../js/zh-tw/adventure-i18n.js";

const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const nav = read("data/zh-TW/book-catalog/navigation.json");

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/hist.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
globalThis.VetoolsConfig = {get: () => "one"};
globalThis.DataLoader = {getAllFromCacheAll: () => []};

for (const [kind, id, title] of [["book", "PL", "拉莫迪亞計畫"], ["adventure", "SoS", "西堤庫斯之影"], ["book", "WoW", "D&D：魔獸世界"], ["adventure", "ICC", "魔獸世界：冰冠城塞"], ["adventure", "DDE", "魔獸世界：死亡礦坑"]]) {
	const index = read(`data/${kind}s.json`)[kind];
	const catalog = read(`data/zh-TW/book-catalog/${kind}s.json`)[kind];
	assert.equal(Object.keys(catalog).length, index.length);
	for (const entry of index) {
		const row = catalog[entry.id];
		assert.ok(row.name, entry.id);
		assert.equal(row.contents.length, entry.contents.length, entry.id);
		entry.contents.forEach((chapter, ix) => {
			assert.ok(row.contents[ix][0], entry.id);
			assert.equal(row.contents[ix][1].length, chapter.headers?.length || 0, entry.id);
		});
		assert.equal(nav[kind].find(it => it.id === entry.id)?.displayName, row.name, entry.id);
	}

	const file = `${kind}-${id.toLowerCase()}.json`;
	const source = read(`data/${kind}/${file}`)[`${kind}Data`][0];
	const view = await I18nZhTwAdventure.pGetView({
		bookId: id,
		canonical: source,
		index: index.find(it => it.id === id),
		fnLoad: ({url}) => {
			assert.ok(url.startsWith(`data/zh-TW/book-catalog/${file.slice(0, -5)}`));
			return read(url);
		},
	});
	assert.ok(view.index.name.startsWith(title));
	assert.equal(view.dataDocument.data.length, source.data.length);

	const render = chapter => {
		const renderer = new Renderer().setFirstSection(true).setEnumerateTitlesRel(true).setTrackTitles(true).resetHeaderIndex().setHeaderIndexTableCaptions(true);
		const stack = [];
		renderer.recursiveRender(chapter, stack);
		return {html: stack.join(""), titles: renderer.getTrackedTitles()};
	};
	source.data.forEach((chapter, ix) => {
		const translated = render(view.dataDocument.data[ix]);
		assert.match(translated.html, /\p{Script=Han}/u);
		assert.doesNotMatch(translated.html, /\[object Object\]/u);
		assert.deepEqual(translated.titles, render(chapter).titles, `${id} chapter ${ix}`);
	});
	const getAreas = data => Object.entries(Renderer.adventureBook.getEntryIdLookup(data))
		.map(([key, area]) => [key, area.chapter, area.name]);
	assert.deepEqual(getAreas(view.dataDocument.data), getAreas(source.data));
}

console.log("Both localized catalogs and all 39 translated chapters preserve canonical chapter links and area IDs.");
