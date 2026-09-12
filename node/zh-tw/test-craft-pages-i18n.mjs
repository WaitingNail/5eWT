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
globalThis.PrereleaseUtil = {hasSourceJson: () => false, sourceJsonToStylePart: () => ""};
globalThis.BrewUtil2 = {hasSourceJson: () => false, sourceJsonToStylePart: () => ""};

const I18n = globalThis.I18nZhTwContent;
const FOLDER = "data/zh-TW/craft-pages";

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

const assertTranslatedNestedNamesBilingual = ({canonical, sidecar, localized, context}) => {
	if (Array.isArray(canonical)) {
		assert.equal(localized.length, canonical.length, `${context} runtime array shape changed`);
		assert.equal(sidecar.length, canonical.length, `${context} sidecar array shape changed`);
		canonical.forEach((child, ix) => assertTranslatedNestedNamesBilingual({
			canonical: child,
			sidecar: sidecar[ix],
			localized: localized[ix],
			context: `${context}/${ix}`,
		}));
		return;
	}
	if (!canonical || typeof canonical !== "object") return;
	if (!sidecar || typeof sidecar !== "object" || !localized || typeof localized !== "object") return;

	if (
		typeof canonical.name === "string"
		&& typeof sidecar.name === "string"
		&& canonical.name !== sidecar.name
	) {
		const bilingualName = I18n.getBilingualName(localized);
		const canonicalBase = getNameBase(canonical.name);
		assert.match(localized._displayName || "", /\p{Script=Han}/u, `${context} lacks a translated heading`);
		assert.ok(
			bilingualName.includes(`（${canonical.name}）`) || bilingualName.includes(`（${canonicalBase}`),
			`${context} heading is not bilingual: ${bilingualName}`,
		);
	}

	for (const [key, value] of Object.entries(canonical)) {
		if (key === "name" || !value || typeof value !== "object" || !(key in sidecar) || !(key in localized)) continue;
		assertTranslatedNestedNamesBilingual({canonical: value, sidecar: sidecar[key], localized: localized[key], context: `${context}/${key}`});
	}
};

test("all vehicle, recipe, and homecraft records load with bilingual entity names", async () => {
	const expected = {
		"vehicles.json": {vehicle: 39, vehicleUpgrade: 31},
		"fluff-vehicles.json": {vehicleFluff: 36},
		"recipes.json": {recipe: 241},
		"fluff-recipes.json": {recipeFluff: 241},
		"homecrafts.json": {crochetPattern: 20},
		"fluff-homecrafts.json": {crochetPatternFluff: 20},
	};

	for (const [file, props] of Object.entries(expected)) {
		const {canonical, sidecar, localized} = await pGetLocalizedData(file);
		for (const [prop, count] of Object.entries(props)) {
			assert.equal(localized[prop].length, count, `${file}/${prop} count changed`);
			for (let ix = 0; ix < count; ix++) {
				const original = canonical[prop][ix];
				const entity = localized[prop][ix];
				assert.equal(entity.name, original.name, `${file}/${prop}/${ix} canonical name changed`);
				assert.match(entity._displayName, /\p{Script=Han}/u, `${file}/${prop}/${ix} name was not translated`);
				assert.ok(I18n.getBilingualName(entity).includes(`（${original.name}）`), `${file}/${prop}/${ix} name is not bilingual`);
				assertTranslatedNestedNamesBilingual({
					canonical: original,
					sidecar: sidecar[prop][ix],
					localized: entity,
					context: `${file}/${prop}/${ix}`,
				});
			}
		}
	}
});

test("vehicle mechanics stay canonical while names, prose, and stat headings are localized", async () => {
	const {canonical, localized} = await pGetLocalizedData("vehicles.json");
	const original = canonical.vehicle.find(it => it.name === "Galley");
	const galley = localized.vehicle.find(it => it.name === "Galley");

	assert.equal(I18n.getBilingualName(galley), "槳帆船（Galley）");
	assert.deepEqual(galley.terrain, original.terrain, "terrain keys must remain canonical for filters");
	assert.equal(galley.vehicleType, "SHIP");
	assert.equal(galley.movement[0].speed[0].mode, "water");
	assert.equal(galley.movement[0].ac, 12);
	assert.equal(galley.movement[0].hp, 100);
	assert.equal(galley.movement[0]._displayName, "槳（Oars）");
	assert.match(galley.movement[0].hpNote, /每受到25點傷害/u);
	assert.equal(galley.weapon[0]._displayName, "弩炮（Ballistas）");
	assert.match(galley.weapon[0].entries[0], /16 \(\{@damage 3d10\}\) 點穿刺傷害/u);

	const meta = Renderer.vehicle.ship.getVehicleShipRenderableEntriesMeta(galley);
	assert.match(meta.entrySizeDimensions, /載具（Vehicle）/u);
	assert.match(meta.entryCreatureCapacity, /生物容量（Creature Capacity）/u);
	assert.match(meta.entryCargoCapacity, /載貨量（Cargo Capacity）/u);
	assert.match(Renderer.vehicle.ship.getWeaponSection_(Renderer.get(), galley.weapon[0]), /武器（Weapons）：弩炮（Ballistas）/u);
	assert.equal(I18n.getVehicleType("SHIP", {isBilingual: true}), "船艦（Ship）");
	assert.equal(I18n.getVehicleTerrain("space", {isBilingual: true}), "太空（Space）");

	const upgrade = localized.vehicleUpgrade.find(it => it.name === "Arcane Artillery");
	assert.equal(I18n.getBilingualName(upgrade), "奧術大炮（Arcane Artillery）");
	assert.match(Renderer.vehicleUpgrade.getVehicleUpgradeRenderableEntriesMeta(upgrade).entrySummary, /船艦升級：武器（Ship Upgrade, Weapon）/u);
});

test("recipes preserve amounts and temperatures while rendering bilingual names and headings", async () => {
	const {canonical, localized} = await pGetLocalizedData("recipes.json");
	const original = canonical.recipe.find(it => it.name === '"Orc" Bacon');
	const recipe = localized.recipe.find(it => it.name === '"Orc" Bacon');

	assert.equal(I18n.getBilingualName(recipe), '"獸人"培根（"Orc" Bacon）');
	assert.equal(recipe.type, original.type);
	assert.deepEqual(recipe.serves, {...original.serves, note: "作為零食"});
	assert.deepEqual(
		recipe.ingredients.map(it => it.amount1),
		original.ingredients.map(it => it.amount1),
		"ingredient amounts changed",
	);
	assert.match(recipe.instructions[0], /375°F/u);
	assert.match(recipe.instructions[0], /不沾烹飪噴霧/u);
	assert.deepEqual(recipe.dishTypes, original.dishTypes, "dish-type filter keys must remain canonical");
	assert.deepEqual(recipe._displayDishTypes, ["零食"]);
	assert.equal(I18n.getRecipeDishType("snack", {isBilingual: true}), "零食（Snack）");
	assert.equal(I18n.getRecipeType(recipe.type, {isBilingual: true}), "非凡料理（Uncommon Cuisine）");

	recipe._fullIngredients = recipe.ingredients;
	const meta = Renderer.recipe.getRecipeRenderableEntriesMeta(recipe);
	assert.match(meta.entryServes, /份量（Serves）/u);
	const rendered = Renderer.recipe.getCompactRenderedString(recipe);
	assert.match(rendered, /廚師註記（Cook's Notes）|份量（Serves）/u);

	const scaled = Renderer.recipe.getScaledRecipe(recipe, 2);
	assert.equal(scaled._displayName, '"獸人"培根（"Orc" Bacon）（×2）');
});

test("homecraft patterns retain crochet notation and show bilingual pattern headings", async () => {
	const {canonical, localized} = await pGetLocalizedData("homecrafts.json");
	const original = canonical.crochetPattern.find(it => it.name === "Bag of Holding");
	const pattern = localized.crochetPattern.find(it => it.name === "Bag of Holding");

	assert.equal(I18n.getBilingualName(pattern), "次元袋（Bag of Holding）");
	assert.equal(pattern.patternType, original.patternType);
	assert.equal(pattern.level, "A");
	assert.deepEqual(pattern.hooks, original.hooks);
	assert.equal(pattern.size[0].width.mm, original.size[0].width.mm);
	assert.equal(pattern.size[0].height.mm, original.size[0].height.mm);
	assert.equal(pattern.instructions[0]._displayName, "前蓋板（Front Flap Panel）");
	assert.equal(pattern.instructions[0].entries[0].items[0]._displayName, "第1行（Row 1）：");
	assert.match(pattern.instructions[0].entries[0].items[0].entries[0], /ch46.*45(?:sc|短針) \(45\)/u);

	const meta = Renderer.crochetPattern.getCrochetPatternRenderableEntriesMeta(pattern);
	assert.equal(meta.entrySkillLevel, "進階（Advanced）");
	assert.match(meta.entriesMeasurements.join("\n"), /寬度（Width）/u);
	assert.match(meta.entriesHooks.join("\n"), /公釐鉤針（mm Crochet Hook）/u);
	const rendered = Renderer.crochetPattern.getCompactRenderedString(pattern);
	for (const heading of [
		"完成尺寸（Finished Measurements）",
		"紗線（Yarn）",
		"鉤針（Hooks）",
		"配件（Notions）",
		"針目密度（Gauge）",
		"註記（Notes）",
	]) assert.match(rendered, new RegExp(heading.replace(/[()]/g, "\\$&"), "u"));
	assert.equal(I18n.getHomecraftPatternType("wearable", {isBilingual: true}), "穿戴用品（Wearable）");
});

test("guarded import report proves complete alignment and preserved mechanics", () => {
	const index = readJson(`${FOLDER}/index.json`);
	assert.deepEqual(index.entityCounts, {
		vehicle: 39,
		vehicleUpgrade: 31,
		vehicleFluff: 36,
		recipe: 241,
		recipeFluff: 241,
		crochetPattern: 20,
		crochetPatternFluff: 20,
	});

	const report = readJson("translation/zh-TW/craft-pages/generated/craft-pages-import-report.json");
	assert.equal(report.status, "pass");
	assert.equal(report.source.commit, "46b15d04f548c23c526084deae078e3568500349");
	assert.deepEqual(report.canonicalFailures, []);
	for (const key of [
		"unmatchedEnglishEntities",
		"unmatchedTranslatedEntities",
		"arrayShapeMismatches",
		"typeShapeMismatches",
		"unmatchedTranslatedTags",
		"tagCanonicalDifferences",
		"diceDifferences",
		"numericUnresolved",
		"untranslatedVisibleStrings",
	]) assert.deepEqual(report.qa[key], [], `${key} is not empty`);
	assert.equal(report.qa.numericDifferencesRawCount, report.qa.numericEquivalentDifferences.length);
	assert.ok(report.qa.numericEquivalentDifferences.length > 0);
});

test("page shells, lists, filters, and renderers use the zh-TW runtime", () => {
	for (const [file, title] of Object.entries({
		"vehicles.html": "載具 - 5etools",
		"recipes.html": "配方 - 5etools",
		"homecrafts.html": "居家工藝 - 5etools",
	})) {
		const html = readText(file);
		assert.match(html, new RegExp(`<title>${title}</title>`, "u"));
		assert.match(html, /js\/zh-tw\/content-i18n\.js/u);
	}

	const vehiclesPage = readText("js/vehicles.js");
	assert.match(vehiclesPage, /getBilingualName\(it\)/u);
	assert.match(vehiclesPage, /getVehicleUpgradeType/u);
	const recipesPage = readText("js/recipes.js");
	assert.match(recipesPage, /getBilingualName\(ent\)/u);
	assert.match(recipesPage, /縮放配方/u);
	const homecraftsPage = readText("js/homecrafts.js");
	assert.match(homecraftsPage, /getHomecraftPatternType/u);
	assert.match(homecraftsPage, /getBilingualName\(ent\)/u);

	const vehicleFilter = readText("js/filter-vehicles.js");
	assert.match(vehicleFilter, /header: "載具類型"/u);
	assert.match(vehicleFilter, /getVehicleTerrain/u);
	const recipeFilter = readText("js/filter-recipes.js");
	assert.match(recipeFilter, /header: "過敏原"/u);
	assert.match(recipeFilter, /getRecipeAllergen/u);
	const homecraftFilter = readText("js/filter-homecrafts.js");
	assert.match(homecraftFilter, /header: "難度"/u);
	assert.match(homecraftFilter, /getHomecraftSkillLevel/u);

	const renderer = readText("js/render.js");
	assert.match(renderer, /傷害閾值（Damage Threshold）/u);
	assert.match(renderer, /完成尺寸（Finished Measurements）/u);
	assert.match(renderer, /器具（Equipment）/u);
});
