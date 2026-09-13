import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readText = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const readJson = file => JSON.parse(readText(file));

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/zh-tw/site-i18n-data.js");
await import("../../js/zh-tw/site-i18n.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
await import("../../js/zh-tw/content-i18n.js");

globalThis.VetoolsConfig = {get: () => "classic"};
globalThis.PrereleaseUtil = globalThis.BrewUtil2 = {
	hasSourceJson: () => false,
	pGetBrewProcessed: async () => ({}),
	getMergedData: data => data,
};
globalThis.ExcludeUtil = {isExcluded: () => false};
globalThis.ExtensionUtil = {ACTIVE: false};
globalThis.ScaleCreature = {isCrInScaleRange: () => false};
const requests = [];
const readRequest = url => {
	const file = new URL(url, "https://example.test/5eWT/").pathname.replace(/^\/5eWT\//u, "");
	requests.push(file);
	return readJson(file);
};

// Replace only network I/O: the real page constructor, ListPage loading method,
// DataUtil loaders, locale loader, and renderers must all run without manually
// applying translations to the data returned to the page.
DataUtil._pLoad = async ({url}) => readRequest(url);
globalThis.fetch = async url => ({ok: true, json: async () => readRequest(url)});

function loadPage (pageName) {
	const context = vm.createContext({
		DataUtil, Renderer, Parser, UrlUtil, UiUtil, VeLock, MiscUtil, VeCt, BaseComponent,
		BookModeViewBase: class {},
		VetoolsConfig,
		I18nZhTwContent,
		PageFilterVehicles: class {},
		PageFilterPsionics: class {},
		ListSyntaxVehicles: class {},
		ListSyntaxPsionics: class {},
		ListUiUtil: {ListSyntax: class {}},
		SublistPersistor: class {},
		SaveManager: class {},
		UtilsTableview: {},
		PrereleaseUtil,
		BrewUtil2,
		window: {addEventListener: () => {}},
		veT: (strings, ...values) => strings.reduce((out, part, ix) => out + part + (values[ix] ?? ""), ""),
	});
	for (const file of ["js/listpage.js", `js/render-${pageName}.js`, `js/${pageName}.js`]) {
		vm.runInContext(readText(file), context, {filename: file});
	}
	return {page: context.dbg_page, context};
}

test("the actual vehicles page loads and renders all 39 vehicles and 31 upgrades in Chinese", async () => {
	const {page} = loadPage("vehicles");
	const data = await page._pOnLoad_pGetData();
	assert.equal(data.vehicle.length, 39);
	assert.equal(data.vehicleUpgrade.length, 31);
	for (const entity of [...data.vehicle, ...data.vehicleUpgrade]) {
		assert.match(entity._displayName || "", /\p{Script=Han}/u, `${entity.name}: page received English-only data`);
		const html = Renderer.vehicle.getRenderedString(entity);
		assert.ok(html.includes(I18nZhTwContent.getBilingualName(entity)), `${entity.name}: missing bilingual rendered title`);
	}
	const rounds = data.vehicleUpgrade.find(it => it.name === "Concussive Rounds");
	const html = Renderer.vehicle.getRenderedString(rounds);
	assert.match(html, /困惑彈（Concussive Rounds）/u);
	assert.match(html, /防護魔法.*速度.*2d10/u);
	assert.doesNotMatch(html, /Enhanced by abjuration magic|that vehicle's speed decreases/u);
	assert.ok(requests.includes("data/zh-TW/craft-pages/vehicles.json"), "page never requested vehicle translations");
});

test("the actual psionics page loads all 52 translated entries and their 179 modes and submodes", async () => {
	const {page} = loadPage("psionics");
	const data = await page._pOnLoad_pGetData();
	assert.equal(data.psionic.length, 52);
	let modes = 0;
	for (const entity of data.psionic) {
		assert.match(entity._displayName || "", /\p{Script=Han}/u, `${entity.name}: page received English-only data`);
		const html = Renderer.psionic.getBodyHtml(entity);
		for (const mode of entity.modes || []) {
			for (const part of [mode, ...mode.submodes || []]) {
				modes++;
				assert.match(part._displayName || "", /\p{Script=Han}/u, `${entity.name}/${part.name}: untranslated mode`);
				assert.ok(html.includes(I18nZhTwContent.getBilingualName(part)), `${part.name}: missing rendered heading`);
			}
		}
	}
	assert.equal(modes, 179);
	const adaptiveBody = data.psionic.find(it => it.name === "Adaptive Body");
	const html = Renderer.psionic.getBodyHtml(adaptiveBody);
	assert.match(html, /環境適應（Environmental Adaptation）/u);
	assert.match(html, /專注於這項靈術/u);
	assert.doesNotMatch(html, /You can alter your body|While focused on this discipline/u);
	assert.ok(requests.includes("data/zh-TW/psionics/psionics.json"), "page never requested psionic translations");
});
