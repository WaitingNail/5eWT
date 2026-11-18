import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
assert.match(read("js/utils.js"), /VERSION_NUMBER[^\n]+"2\.41\.1"/);
assert.match(read("js/spells.js"), /sortByInitial: "level",\s*sortDirInitial: "asc"/);
assert.match(read("js/spells.js"), /getSpellLevel\(i, \{isIncludeWord: true\}\)/);
assert.match(read("js/listpage.js"), /await this\._pGetVisibleAsMarkdown\(\)/);
assert.match(read("js/bookutils.js"), /id: bookId\.qq\(\)/);
await import("../../js/zh-tw/content-i18n.js");
assert.equal(globalThis.I18nZhTwContent.getSpellMiscTag("WLT"), "以自願生物為目標");
assert.equal(globalThis.I18nZhTwContent.getSpellMiscTag("ALT"), "以盟友為目標");
const canonical = JSON.parse(read("data/spells/spells-xphb.json"));
const localized = JSON.parse(read("data/zh-TW/spells/spells-xphb.json"));
const name = "Tasha's Bubbling Cauldron";
const getPotionLink = entity => entity.entries.join(" ").match(/\{@filter [^|]+\|([^}]+)\}/)?.[1];
const officialLink = getPotionLink(canonical.spell.find(it => it.name === name));
assert.ok(officialLink);
assert.equal(getPotionLink(localized.spell.find(it => it.ENG_name === name)), officialLink);
console.log("v2.41.1 spell sorting, Markdown controls, filters and updated potion link verified.");

const {adventureErrata} = await import("../../js/zh-tw/adventure-errata.js");
const {I18nZhTwAdventure} = await import("../../js/zh-tw/adventure-i18n.js");
for (const [bookId, changes] of Object.entries(adventureErrata)) {
	const canonical = JSON.parse(read(`data/adventure/adventure-${bookId}.json`)).adventureData[0];
	const view = await I18nZhTwAdventure.pGetView({canonical, bookId, index: {id: bookId}});
	for (const change of changes) {
		const select = document => change.path.reduce((node, key) => node[key], document.data);
		assert.equal(select(canonical), change.english);
		assert.equal(select(view.dataDocument), change.text);
	}
}
