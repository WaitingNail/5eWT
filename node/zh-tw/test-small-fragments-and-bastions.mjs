import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const PUBLIC_DIR = new URL("../../", import.meta.url);
const readJson = async relativePath => JSON.parse(await readFile(new URL(relativePath, PUBLIC_DIR), "utf8"));

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/zh-tw/site-i18n-data.js");
await import("../../js/zh-tw/site-i18n.js");
await import("../../js/render.js");
await import("../../js/zh-tw/content-i18n.js");

globalThis.VetoolsConfig = {get: () => "one"};
globalThis.DataLoader = {getAllFromCacheAll: () => []};

test("generated ability and speed fragments are fully localized", () => {
	const I18n = globalThis.I18nZhTwContent;

	assert.equal(I18n.localizeAbilityText("Choose three different +1"), "選擇三個不同屬性，各 +1");
	assert.equal(
		I18n.localizeAbilityText("Choose any +2; choose any other +1"),
		"選擇任一屬性 +2；再選任一其他屬性 +1",
	);
	assert.equal(I18n.localizeAbilityText("Any combination +2/+1"), "任意組合 +2/+1");
	assert.equal(
		I18n.localizeAbilityText("Charisma +2; Choose any other two unique +1"),
		"魅力 +2；再選二個其他不同屬性，各 +1",
	);

	const generatedAbility = globalThis.Renderer.getAbilityData([{
		choose: {
			weighted: {
				from: globalThis.Parser.ABIL_ABVS,
				weights: [1, 1, 1],
			},
		},
	}]);
	assert.equal(generatedAbility.asText, "選擇三個不同屬性，各 +1");
	assert.equal(generatedAbility.asTextShort, "任意組合 +1/+1/+1");
	assert.doesNotMatch(JSON.stringify(generatedAbility), /choose three different/iu);

	assert.equal(
		I18n.localizeSpeedText("Fly equal to your walking speed"),
		"飛行速度等同於你的步行速度",
	);
	assert.equal(
		I18n.localizeSpeedText("Climb equal your walking speed"),
		"攀爬速度等同於你的步行速度",
	);
});

test("every generated race attribute block is free of the audited English fragments", async () => {
	const canonical = await readJson("data/races.json");
	const sidecar = await readJson("data/zh-TW/character-options/races.json");
	const data = await globalThis.I18nZhTwContent.pApplyDataFile({
		file: "races.json",
		data: canonical,
		fnLoad: async () => sidecar,
	});
	const entities = [...data.race || [], ...data.subrace || []];
	assert.ok(entities.length > 200);
	for (const ent of entities) {
		const visibleStrings = [];
		const collectVisible = (value, key = null) => {
			if (typeof value === "string") {
				if (key !== "ENG_name") visibleStrings.push(value);
				return;
			}
			if (Array.isArray(value)) return value.forEach(it => collectVisible(it));
			if (value && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => collectVisible(child, childKey));
		};
		collectVisible(globalThis.Renderer.race.getRaceRenderableEntriesMeta(ent).entryAttributes || "");
		const attributes = visibleStrings.join("\n");
		assert.doesNotMatch(
			attributes,
			/\b(?:Ability Scores?|Creature Type|Choose|different|unique|walking speed|Fly|Climb|Swim|Burrow|Speed|Size)\b/iu,
			`${ent.name}|${ent.source}`,
		);
	}
});

test("page-level interface aliases and direct render fragments are localized", async () => {
	const site = globalThis.SITE_I18N_ZH_TW_DATA;
	const required = [
		"Items Book View", "Select Currency Conversion Table", "Select Display Mode", "Exact Coinage", "Lowest Common Currency",
		"Mundane", "Magic", "Attunement", "Properties", "Mastery", "Challenge Rating", "Speed Type", "Armor Class",
		"Average Hit Points", "Damage Inflicted by Traits/Actions", "Conditions Inflicted by Spells", "Saving Throw Required",
		"Spellcasting Type", "Primary Ability", "Other/Text Options", "Feature Level", "Property", "Weapon Damage Type",
		"Poison Type", "Attached Spells", "Found On", "Recharge Type", "Base Item", "Ability Score Adjustment",
		"Province", "Trigger:", "Active Elements", "Goals:", "Legendary Actions", "Standard Languages",
	];
	for (const english of required) {
		const key = site.english[english];
		assert.ok(key, `missing English alias: ${english}`);
		assert.match(site.messages[key], /[^\x00-\x7F]/u, `alias remained ASCII: ${english}`);
	}
	assert.equal(site._meta.messageCount, Object.keys(site.messages).length);
	assert.equal(site._meta.englishAliasCount, Object.keys(site.english).length);
	assert.equal(globalThis.I18nZhTwSite.tEnglish("Mundane"), "普通物品");
	assert.equal(globalThis.Renderer.get().render("Goals:"), "目標：");

	const [itemsSource, bestiaryFilterSource, renderSource] = await Promise.all([
		readFile(new URL("js/items.js", PUBLIC_DIR), "utf8"),
		readFile(new URL("js/filter-bestiary.js", PUBLIC_DIR), "utf8"),
		readFile(new URL("js/render.js", PUBLIC_DIR), "utf8"),
	]);
	assert.match(itemsSource, /txt\(UiUtil\.getTranslatedText\("Mundane"\)\)/u);
	assert.match(itemsSource, /_tabTitleStats = UiUtil\.getTranslatedText\("Item"\)/u);
	assert.match(bestiaryFilterSource, /getCreatureType/u);
	assert.match(bestiaryFilterSource, /getCondition/u);
	assert.match(bestiaryFilterSource, /getAbility\(abl\).*豁免/u);
	assert.match(renderSource, /i18n\.hasEnglish\(text\)/u);
});

test("all canonical Bastion facilities receive Traditional Chinese names and content", async () => {
	const I18n = globalThis.I18nZhTwContent;
	const canonical = await readJson("data/bastions.json");
	const sidecar = await readJson("data/zh-TW/bastions/bastions.json");
	const data = await I18n.pApplyDataFile({
		file: "bastions.json",
		data: canonical,
		fnLoad: async () => sidecar,
	});

	assert.equal(sidecar.facility.length, canonical.facility.length);
	assert.equal(data.facility.length, 61);
	assert.ok(data.facility.every(ent => /[\p{Script=Han}]/u.test(I18n.getDisplayName(ent))));

	const archive = data.facility.find(ent => ent.name === "Archive" && ent.source === "XDMG");
	assert.equal(archive.name, "Archive", "canonical identity must remain stable");
	assert.equal(archive._displayName, "檔案館");
	assert.equal(I18n.getBilingualName(archive), "檔案館（Archive）");
	assert.match(JSON.stringify(archive.entries), /研究：有益學識/u);
	assert.match(JSON.stringify(archive.entries), /\{@spell Legend Lore\|XPHB\|通曉傳奇\}/u);

	const rookery = data.facility.find(ent => ent.name === "Rookery" && ent.source === "RHW");
	assert.equal(rookery._displayName, "渡鴉巢舍");
	assert.doesNotMatch(JSON.stringify(rookery.entries), /誘陷者|制造|委托|聯系/u);
});

test("Bastion fluff image captions and generated facility metadata are localized", async () => {
	const I18n = globalThis.I18nZhTwContent;
	const canonicalFluff = await readJson("data/fluff-bastions.json");
	const sidecarFluff = await readJson("data/zh-TW/bastions/fluff-bastions.json");
	const fluff = await I18n.pApplyDataFile({
		file: "fluff-bastions.json",
		data: canonicalFluff,
		fnLoad: async () => sidecarFluff,
	});

	const laboratory = fluff.facilityFluff.find(ent => ent.name === "Laboratory" && ent.source === "XDMG");
	assert.equal(laboratory._displayName, "實驗室");
	assert.match(laboratory.images[0].title, /坩堝/u);
	assert.equal(laboratory.images[0].href.path, "bastions/XDMG/Laboratory.webp");

	const canonical = await readJson("data/bastions.json");
	const sidecar = await readJson("data/zh-TW/bastions/bastions.json");
	const data = await I18n.pApplyDataFile({file: "bastions.json", data: canonical, fnLoad: async () => sidecar});
	const archive = data.facility.find(ent => ent.name === "Archive" && ent.source === "XDMG");
	const metadata = globalThis.Renderer.facility.getFacilityRenderableEntriesMeta(archive);
	const metadataText = JSON.stringify([
		metadata.entryLevel,
		metadata.entriesDescription[0],
		metadata.entrySpace,
		metadata.entryHirelings,
		metadata.entryOrders,
	]);
	assert.match(metadataText, /先決條件|空間|僱工|指令/u);
	assert.doesNotMatch(metadataText, /Prerequisite|Hirelings|Orders?|Bastion Facility|see below|squares|days/u);
	assert.match(globalThis.Renderer.facility._getSpaceEntry("roomy", {isIncludeCostTime: true}), /寬敞/u);
});

test("Bastion list, filter, and direct data-loader paths use the localized display layer", async () => {
	const [pageSource, filterSource, renderSource, dataLoaderSource] = await Promise.all([
		readFile(new URL("js/bastions.js", PUBLIC_DIR), "utf8"),
		readFile(new URL("js/filter-bastions.js", PUBLIC_DIR), "utf8"),
		readFile(new URL("js/render-bastions.js", PUBLIC_DIR), "utf8"),
		readFile(new URL("js/utils-dataloader/utils-dataloader-dataloader.js", PUBLIC_DIR), "utf8"),
	]);

	assert.match(pageSource, /I18nZhTwContent\.getBilingualName\(ent\)/u);
	assert.match(pageSource, /englishName: I18nZhTwContent\.getCanonicalName\(ent\)/u);
	assert.match(pageSource, /pageTitle: "堡壘設施列印檢視"/u);
	assert.match(filterSource, /I18nZhTwContent\.getFacilityType/u);
	assert.match(filterSource, /_typeFilter\.addItem\(ent\.facilityType\)/u);
	assert.doesNotMatch(renderSource, /Level \$\{ent\.level\} Bastion Facility/u);
	assert.ok(dataLoaderSource.includes("I18nZhTwContent.pApplyDataFile({file: this._filename, data})"));
});
