import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
import {I18nZhTwRules as Rules} from "../../js/zh-tw/rules-i18n.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readText = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const read = file => JSON.parse(readText(file));
const source = read("translation/zh-TW/homebrew/monsters-of-drakkenheim.source.json");
const locale = read("data/zh-TW/rules/homebrew/conditionsdiseases-modk.json");
const terms = read("translation/zh-TW/homebrew/monsters-of-drakkenheim.terms.json").terms;
const requests = [];
const fnLoad = async ({file}) => { requests.push(file); return read(`data/zh-TW/rules/${file}`); };
const localized = await Rules.pApplyToData(source, {filenames: ["conditionsdiseases.json"], fnLoad});
assert.equal(localized.condition.length, 21);
assert.ok(requests.includes("homebrew/conditionsdiseases-modk.json"));

const strings = value => typeof value === "string" ? [value]
	: Array.isArray(value) ? value.flatMap(strings)
		: value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
const refs = value => strings(value).flatMap(str => [...str.matchAll(/\{@(\w+) ([^{}]+)\}/gu)]
	.map(([, tag, body]) => [tag.toLowerCase(), body.split("|").slice(0, /^(dice|damage|chance)$/u.test(tag) ? 1 : 2).join("|")].join(" "))).sort();
for (const [ix, original] of source.condition.entries()) {
	const translated = localized.condition[ix];
	const sidecar = locale.condition[ix];
	assert.deepEqual(sidecar.ENG_entries, original.entries, `${original.name}: outdated source fixture`);
	assert.equal(translated.name, original.name);
	assert.equal(translated.source, original.source);
	assert.equal(translated.page, original.page);
	assert.equal(translated._displayName, terms[original.name]);
	assert.deepEqual(translated.entries, sidecar.entries);
	assert.deepEqual(Rules.getCanonicalEntity(translated), original);
	assert.deepEqual(refs(translated.entries), refs(original.entries), `${original.name}: altered reference or die`);
	assert.ok(Rules.getNameSearchText(translated).includes(original.name));
	assert.ok(Rules.getNameSearchText(translated).includes(terms[original.name]));
	const visit = (before, after) => {
		if (typeof before === "string") {
			if (!/[A-Za-z]/u.test(before) || ["entries", "list", "table", "list-decimal"].includes(before) || /^col-/u.test(before)) return;
			assert.match(after, /\p{Script=Han}/u, `${original.name}: English-only display leaf ${before}`);
			return;
		}
		if (Array.isArray(before)) { assert.equal(after.length, before.length); before.forEach((v, i) => visit(v, after[i])); return; }
		if (before && typeof before === "object") for (const key of Object.keys(before)) {
			if (["type", "style", "colStyles"].includes(key)) { assert.deepEqual(after[key], before[key]); continue; }
			visit(before[key], after[key]);
		}
	};
	visit(original.entries, translated.entries);
}
assert.deepEqual((await Rules.pApplyToData(localized, {fnLoad})).condition.map(e => e.entries), localized.condition.map(e => e.entries), "overlay must be idempotent");

// Updates to an independently maintained imported book must not silently receive
// stale rules. Unrelated sources and an absent source also retain their identity.
const drifted = structuredClone(source);
drifted.condition.find(e => e.name === "Dazed").entries[0] += " Changed rule.";
const guarded = await Rules.pApplyToData(drifted, {fnLoad});
assert.equal(guarded.condition.find(e => e.name === "Dazed")._displayName, undefined);
assert.deepEqual(guarded.condition.find(e => e.name === "Dazed").entries, drifted.condition.find(e => e.name === "Dazed").entries);
requests.length = 0;
const other = {condition: [{...source.condition.find(e => e.name === "Dazed"), source: "OtherBook"}]};
assert.deepEqual(await Rules.pApplyToData(other, {fnLoad}), other);
assert.ok(!requests.includes("homebrew/conditionsdiseases-modk.json"));

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/zh-tw/content-i18n.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
globalThis.VetoolsConfig = {get: () => "classic"};
const dataRequest = url => {
	const file = new URL(url, "https://example.test/").pathname.slice(1);
	requests.push(file);
	return read(file);
};
DataUtil._pLoad = async ({url}) => dataRequest(url);
globalThis.fetch = async url => ({ok: true, json: async () => dataRequest(url)});
Rules._resetForTests();

// Execute the real page, inherited ListPage merge, and BrewUtil merge method.
// Only transport and stored source retrieval are replaced.
const context = vm.createContext({
	Array, DataUtil, Renderer, Parser, UrlUtil, UiUtil, VeLock, MiscUtil, VeCt, BaseComponent, StorageUtil,
	BookModeViewBase: class {}, VetoolsConfig, I18nZhTwRules: Rules,
	PageFilterConditionsDiseases: class {}, ListUiUtil: {ListSyntax: class {}},
	SublistPersistor: class {}, SaveManager: class {}, window: {addEventListener: () => {}},
});
const script = file => readText(file).replace(/^import .*;\n/gmu, "").replace(/^export /gmu, "");
const realMerge = vm.runInThisContext(`${script("js/utils-brew/utils-brew-base.js")}\nBrewUtil2Base.prototype.getMergedData`);
let imported = {condition: structuredClone(source.condition)};
context.PrereleaseUtil = {pGetBrewProcessed: async () => ({}), getMergedData: realMerge};
context.BrewUtil2 = {pGetBrewProcessed: async () => imported, getMergedData: realMerge};
vm.runInContext(readText("js/listpage.js"), context);
vm.runInContext(script("js/conditionsdiseases.js"), context);
const page = context.dbg_page;
const merged = await page._pOnLoad_pGetData();
assert.equal(merged.condition.length + merged.disease.length + merged.status.length, 85);
assert.equal(merged.condition.filter(e => e.source === "MonstersOfDrakkenheim" && e._displayName).length, 21);
assert.equal(imported.condition[0]._displayName, undefined, "stored imported data was mutated");
imported = {};
const absent = await page._pOnLoad_pGetData();
assert.equal(absent.condition.length + absent.disease.length + absent.status.length, 64);
assert.ok(!absent.condition.some(e => e.source === "MonstersOfDrakkenheim"), "must not automatically import the book");

// Run the production hover loader including its inherited stored-brew path.
// The class block is extracted unchanged; unrelated loader registrations are
// excluded to avoid loading every data type in this condition-specific test.
const loaderSource = script("js/utils-dataloader/utils-dataloader-dataloader.js");
const commonLoaders = loaderSource.slice(loaderSource.indexOf("class DataTypeLoader {"), loaderSource.indexOf("class DataTypeLoaderBackground "));
const conditionLoader = loaderSource.slice(loaderSource.indexOf("class DataTypeLoaderConditionDisease "), loaderSource.indexOf("class DataTypeLoaderSkill "));
vm.runInContext(`${commonLoaders}\n${conditionLoader}`, context);
imported = {condition: structuredClone(source.condition)};
const prepopulated = [];
const originalPrePopulate = Renderer.spell.prePopulateHover;
const originalPrePopulateBrew = Renderer.spell.prePopulateHoverBrew;
Renderer.spell.prePopulateHover = data => prepopulated.push(data);
Renderer.spell.prePopulateHoverBrew = () => {};
const loader = vm.runInContext("new DataTypeLoaderConditionDisease({dependencies: []})", context);
const hoverData = await loader.pGetStoredBrewData();
assert.equal(prepopulated.length, 1);
assert.equal(hoverData.condition.filter(e => e._displayName).length, 21);
Renderer.spell.prePopulateHover = originalPrePopulate;
Renderer.spell.prePopulateHoverBrew = originalPrePopulateBrew;
for (const entity of hoverData.condition) {
	const html = Renderer.get().render({entries: entity.entries});
	assert.match(html, /\p{Script=Han}/u);
	assert.ok(Rules.getBilingualName(entity).includes(`（${entity.name}）`));
}

for (const [english, chinese] of Object.entries(terms)) {
	assert.equal(I18nZhTwContent.getCondition(`${english}|MonstersOfDrakkenheim`), chinese);
	assert.equal(I18nZhTwContent.getCondition(`${english}|OtherBook`), english);
}
assert.equal(I18nZhTwContent.getCondition("Dazed"), "Dazed");
assert.match(I18nZhTwContent.getFullConditionImmune({conditionImmune: ["Dazed|MonstersOfDrakkenheim"]}), /Dazed\|MonstersOfDrakkenheim\|恍惚/iu);
const entries = name => JSON.stringify(localized.condition.find(e => e.name === name).entries);
assert.match(entries("Dazed"), /移動或執行一個動作.*不能兩者都做.*附贈動作/u);
assert.doesNotMatch(entries("Dazed"), /反應|震懾|失能/u);
assert.match(entries("Defenseless"), /以你為目標.*優勢/u);
assert.doesNotMatch(entries("Defenseless"), /重擊/u);
assert.match(entries("Helpless"), /命中.*重擊/u);
assert.match(entries("Weakened"), /武器攻擊與法術.*減半/u);
assert.match(entries("Bleeding"), /失去.*生命值/u);
assert.doesNotMatch(entries("Bleeding"), /受到.*傷害/u);
assert.match(entries("Frozen"), /造成鈍擊傷害的武器.*無助.*執行該動作的生物.*DC 15.*20點鈍擊或火焰傷害/u);
assert.match(entries("Staggered"), /你的回合中.*最多只能進行一次武器攻擊/u);
console.log(JSON.stringify({importedConditions: 21, mergedEntries: 85, builtInOnlyEntries: 64, sourceGuard: "passed", pageMerge: "passed", hoverLoader: "passed", referencesAndSemantics: "passed"}));
