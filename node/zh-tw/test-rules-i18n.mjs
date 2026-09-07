import assert from "node:assert/strict";
import fs from "node:fs";

import {I18nZhTwRules} from "../../js/zh-tw/rules-i18n.js";

I18nZhTwRules._resetForTests();

const canonical = {
	action: [
		{
			name: "Attack",
			source: "PHB",
			page: 192,
			uid: "Attack|PHB",
			hash: "attack_phb",
			entries: [
				"Make one attack.",
				{
					type: "entries",
					name: "Special Attack",
					entries: ["Resolve the attack normally."],
				},
			],
		},
	],
	condition: [
		{
			name: "Blinded",
			source: "PHB",
			page: 290,
			type: "Physical Condition",
			entries: [{type: "list", items: ["A blinded creature can't see."]}],
		},
		{
			name: "Blinded",
			source: "XPHB",
			page: 361,
			entries: ["While Blinded, you can't see."],
		},
	],
	skill: [
		{
			name: "Acrobatics",
			source: "PHB",
			page: 176,
			ability: "dex",
			entries: ["Stay on your feet."],
		},
	],
	sense: [
		{
			name: "Blindsight",
			source: "PHB",
			page: 183,
			entries: ["Perceive without sight."],
		},
	],
	variantrule: [
		{
			name: "Ability Check",
			source: "XPHB",
			page: 360,
			ruleType: "C",
			entries: [
				{
					type: "table",
					caption: "Ability Checks",
					colLabels: ["Roll", "Result"],
					rows: [[1, {entry: "Failure", uid: "Failure|XPHB"}]],
					href: {type: "internal", path: "rules/checks.webp"},
				},
			],
		},
	],
};

const localizedByFile = {
	"actions.json": {
		action: [
			{
				...canonical.action[0],
				name: "攻擊",
				ENG_name: "Attack",
				entries: [
					"進行一次攻擊。",
					{type: "entries-translated-by-mistake", name: "特殊攻擊", entries: ["照常結算該次攻擊。"]},
				],
			},
		],
	},
	"conditionsdiseases.json": {
		condition: [
			{
				...canonical.condition[0],
				name: "目盲",
				ENG_name: "Blinded",
				type: "生理狀態",
				entries: [{type: "translated-list", items: ["目盲生物無法看見。"]}],
			},
			{
				...canonical.condition[1],
				name: "目盲（2024）",
				ENG_name: "Blinded",
				entries: ["處於目盲狀態時，你無法看見。"],
			},
		],
	},
	"skills.json": {
		skill: [{...canonical.skill[0], name: "特技動作", ENG_name: "Acrobatics", entries: ["維持平衡。"]}],
	},
	"senses.json": {
		sense: [{...canonical.sense[0], name: "盲視", ENG_name: "Blindsight", entries: ["不依賴視覺感知。"]}],
	},
	"variantrules.json": {
		variantrule: [
			{
				...canonical.variantrule[0],
				name: "屬性檢定",
				ENG_name: "Ability Check",
				entries: [
					{
						type: "translated-table",
						caption: "屬性檢定",
						colLabels: ["擲骰", "結果"],
						rows: [[1, {entry: "失敗", uid: "Translated|XPHB"}]],
						href: {type: "external", path: "translated.webp"},
					},
				],
			},
		],
	},
	"generated/gendata-variantrules.json": {variantrule: []},
};

const loadedFiles = [];
const localized = await I18nZhTwRules.pApplyToData(canonical, {
	fnLoad: ({file}) => {
		loadedFiles.push(file);
		return localizedByFile[file] || null;
	},
});

assert.notStrictEqual(localized, canonical, "the root data object should be cloned");
assert.deepEqual(canonical.action[0].entries[0], "Make one attack.", "canonical input must not be mutated");
assert.deepEqual(
	new Set(loadedFiles),
	new Set(["actions.json", "conditionsdiseases.json", "skills.json", "senses.json", "variantrules.json", "generated/gendata-variantrules.json"]),
);

const action = localized.action[0];
assert.equal(action.name, "Attack", "canonical main name must remain unchanged");
assert.equal(action._displayName, "攻擊");
assert.equal(action.source, "PHB");
assert.equal(action.page, 192);
assert.equal(action.uid, "Attack|PHB");
assert.equal(action.hash, "attack_phb");
assert.equal(action.entries[0], "進行一次攻擊。");
assert.equal(action.entries[1].name, "特殊攻擊", "nested display names should be localized");
assert.equal(action.entries[1].type, "entries", "nested structural types must remain canonical");
assert.strictEqual(I18nZhTwRules.getCanonicalEntity(action), canonical.action[0]);
assert.equal(Object.keys(action).includes("_i18nCanonical"), false, "canonical backup must not leak into serialization");
assert.equal(I18nZhTwRules.getNameSearchText(action), "攻擊 Attack");
assert.equal(I18nZhTwRules.getBilingualName(action), "攻擊（Attack）");
assert.equal(I18nZhTwRules.getBilingualName(canonical.action[0]), "Attack");

const condition2014 = localized.condition[0];
const condition2024 = localized.condition[1];
assert.equal(condition2014.name, "Blinded");
assert.equal(condition2014._displayName, "目盲");
assert.equal(condition2014.type, "Physical Condition", "filter type must remain canonical");
assert.equal(condition2014._displayType, "生理狀態");
assert.equal(condition2014.entries[0].type, "list");
assert.equal(condition2014.entries[0].items[0], "目盲生物無法看見。");
assert.equal(condition2024._displayName, "目盲（2024）", "same-name entries must be separated by source");
assert.equal(I18nZhTwRules.getDisplayType("Physical Condition"), "生理狀態");
assert.equal(I18nZhTwRules.getDisplayType("Magical Contagion"), "魔法傳染病");

assert.equal(localized.skill[0].name, "Acrobatics");
assert.equal(localized.skill[0]._displayName, "特技動作");
assert.equal(localized.skill[0].ability, "dex");
assert.equal(localized.skill[0].entries[0], "維持平衡。");
assert.equal(localized.sense[0].name, "Blindsight");
assert.equal(localized.sense[0]._displayName, "盲視");
assert.equal(localized.sense[0].entries[0], "不依賴視覺感知。");

const rule = localized.variantrule[0];
assert.equal(rule.name, "Ability Check");
assert.equal(rule._displayName, "屬性檢定");
assert.equal(rule.ruleType, "C");
assert.equal(rule.entries[0].type, "table");
assert.equal(rule.entries[0].caption, "屬性檢定");
assert.deepEqual(rule.entries[0].colLabels, ["擲骰", "結果"]);
assert.equal(rule.entries[0].rows[0][1].entry, "失敗");
assert.equal(rule.entries[0].rows[0][1].uid, "Failure|XPHB", "nested UIDs must remain canonical");
assert.deepEqual(rule.entries[0].href, {type: "internal", path: "rules/checks.webp"}, "asset/ref fields must remain canonical");

assert.equal(I18nZhTwRules.getRuleTypeDisplay("C"), "核心");
assert.equal(I18nZhTwRules.getActionTimeDisplay({number: 1, unit: "action"}), "1 動作");
assert.equal(I18nZhTwRules.getActionTimeUnitDisplay("Free"), "自由");
assert.equal(I18nZhTwRules.getActionTimeUnitDisplay("Varies"), "不定");
assert.equal(I18nZhTwRules.getAbilityDisplay("dex"), "敏捷");
assert.equal(
	I18nZhTwRules.localizeSourceHtml("<b>Source:</b> PHB, page 192. Available in the Basic Rules"),
	"<b>來源：</b> PHB，第 192 頁. 收錄於 《基礎規則》",
);

const localizedTwice = await I18nZhTwRules.pApplyToData(localized, {
	fnLoad: ({file}) => localizedByFile[file] || null,
});
assert.equal(localizedTwice.action[0]._displayName, "攻擊", "repeated overlay should be idempotent");
assert.equal(localizedTwice.action[0].entries[0], "進行一次攻擊。");
assert.strictEqual(
	I18nZhTwRules.getCanonicalEntity(localizedTwice.action[0]),
	canonical.action[0],
	"repeated overlay must retain the original English canonical backup",
);
assert.equal(I18nZhTwRules.getCanonicalEntity(localizedTwice.action[0]).entries[0], "Make one attack.");

const malformedCanonical = {
	action: [{...canonical.action[0], entries: ["First.", "Second."]}],
};
const malformedLocalized = {
	action: [{...malformedCanonical.action[0], ENG_name: "Attack", name: "攻擊", entries: ["第一項。"]}],
};
const malformedOverlay = await I18nZhTwRules.pApplyToData(malformedCanonical, {
	filenames: ["actions.json"],
	fnLoad: () => malformedLocalized,
});
assert.notStrictEqual(malformedOverlay.action[0].entries, malformedCanonical.action[0].entries, "shape-mismatch fallback must clone canonical arrays");
malformedOverlay.action[0].entries.push("Third.");
assert.deepEqual(malformedCanonical.action[0].entries, ["First.", "Second."], "shape-mismatch fallback must not mutate canonical input");

const realFetch = globalThis.fetch;
const realWarn = console.warn;
I18nZhTwRules._resetForTests();
globalThis.fetch = async () => ({
	ok: true,
	json: async () => { throw new Error("invalid JSON"); },
});
console.warn = () => {};
try {
	const parseFailureInput = {action: [canonical.action[0]]};
	const parseFailureFallback = await I18nZhTwRules.pApplyToData(parseFailureInput, {filenames: ["actions.json"]});
	assert.deepEqual(parseFailureFallback, parseFailureInput, "sidecar JSON failure must fall back to canonical English data");
	assert.notStrictEqual(parseFailureFallback, parseFailureInput, "sidecar JSON failure must return a safe clone");
} finally {
	globalThis.fetch = realFetch;
	console.warn = realWarn;
	I18nZhTwRules._resetForTests();
}

const sourceDataloader = fs.readFileSync(new URL("../../js/utils-dataloader/utils-dataloader-dataloader.js", import.meta.url), "utf8");
assert.match(sourceDataloader, /I18nZhTwRules\.pApplyToData\(data, \{filenames: \[this\._filename\]\}\)/u, "single-source DataLoader hook is missing");
assert.match(sourceDataloader, /"generated\/gendata-variantrules\.json"/u, "generated variant-rule DataLoader hook is missing");

for (const pageFile of ["actions.js", "conditionsdiseases.js", "variantrules.js"]) {
	const sourcePage = fs.readFileSync(new URL(`../../js/${pageFile}`, import.meta.url), "utf8");
	assert.match(sourcePage, /getBilingualName\(/u, `${pageFile} does not render the bilingual entity name`);
	assert.match(sourcePage, /englishName:/u, `${pageFile} does not index the canonical English name for search`);
}
assert.ok(fs.readFileSync(new URL("../../js/actions.js", import.meta.url), "utf8").includes("englishTime"), "Actions English time is not indexed for search");
assert.ok(fs.readFileSync(new URL("../../js/conditionsdiseases.js", import.meta.url), "utf8").includes("displayType"), "Conditions Chinese type is not indexed for search");
assert.ok(fs.readFileSync(new URL("../../js/variantrules.js", import.meta.url), "utf8").includes("ruleTypeEnglish"), "Variant Rules English rule type is not indexed for search");
assert.ok(
	fs.readFileSync(new URL("../../js/render-conditionsdiseases.js", import.meta.url), "utf8").includes("I18nZhTwRules.getDisplayType(ent.type)"),
	"Conditions detail renderer does not localize canonical disease types",
);
assert.match(
	fs.readFileSync(new URL("../../js/variantrules.js", import.meta.url), "utf8"),
	/getCanonicalEntity\(rule\)/u,
	"Variant Rules full-text search does not include canonical English nested headings",
);

const lockedKeys = new Set([
	"source",
	"page",
	"id",
	"uid",
	"hash",
	"href",
	"path",
	"url",
	"link",
	"tag",
	"type",
	"style",
	"colStyles",
	"roll",
	"exact",
	"min",
	"max",
	"number",
	"ability",
	"time",
	"unit",
	"ruleType",
	"reprintedAs",
	"seeAlsoAction",
	"fromVariant",
	"otherSources",
	"additionalSources",
]);

const referenceTags = new Set([
	"action", "background", "boon", "charoption", "class", "condition", "creature", "creatureFluff",
	"cult", "deck", "deity", "disease", "facility", "feat", "hazard", "item", "itemMastery",
	"itemProperty", "language", "legroup", "object", "optfeature", "optionalfeature", "psionic", "race",
	"raceFluff", "recipe", "reward", "sense", "skill", "spell", "status", "table", "trap", "variantrule",
	"vehicle", "vehupgrade",
]);
const advancedReferenceTags = new Set(["subclass", "classFeature", "subclassFeature", "quickref"]);
const displayFirstTags = new Set(["filter", "5etools", "book", "adventure"]);
const mechanicalTags = new Set(["dc", "dice", "damage", "scaledice", "scaledamage", "hit", "chance", "d20", "recharge"]);
const specialDisplayIndexes = {deity: 3, subclass: 4, classFeature: 5, subclassFeature: 7, quickref: 4};

function getCanonicalTagSignatures (value) {
	const out = [];
	for (const match of value.matchAll(/\{@([A-Za-z0-9]+) ([^{}]*)\}/gu)) {
		const [, tag, body] = match;
		const parts = body.split("|");
		if (referenceTags.has(tag) || advancedReferenceTags.has(tag)) {
			const displayIndex = specialDisplayIndexes[tag] ?? 2;
			out.push(JSON.stringify([tag, ...Array.from({length: displayIndex}, (_, i) => parts[i] || "")]));
			continue;
		}
		if (displayFirstTags.has(tag)) {
			out.push(JSON.stringify([tag, ...parts.slice(1)]));
			continue;
		}
		if (mechanicalTags.has(tag)) out.push(JSON.stringify([tag, parts[0] || ""]));
	}
	return out.sort();
}

function assertCanonicalStructure ({canonical, localized, path = "$", isRoot = false}) {
	if (canonical == null || typeof canonical !== "object") {
		if (typeof canonical !== "string") {
			assert.equal(localized, canonical, `${path} non-text value changed`);
		} else {
			assert.deepEqual(
				getCanonicalTagSignatures(localized),
				getCanonicalTagSignatures(canonical),
				`${path} inline tag target/formula changed`,
			);
		}
		return;
	}

	if (Array.isArray(canonical)) {
		assert.ok(Array.isArray(localized), `${path} changed from an array`);
		assert.equal(localized.length, canonical.length, `${path} array length changed`);
		canonical.forEach((it, i) => assertCanonicalStructure({canonical: it, localized: localized[i], path: `${path}/${i}`}));
		return;
	}

	if (isRoot) assert.equal(localized.name, canonical.name, `${path}/name canonical identity changed`);
	for (const [key, value] of Object.entries(canonical)) {
		if (lockedKeys.has(key)) {
			assert.deepEqual(localized[key], value, `${path}/${key} canonical field changed`);
			continue;
		}
		assertCanonicalStructure({canonical: value, localized: localized[key], path: `${path}/${key}`});
	}
}

const fullDataSpecs = [
	{file: "actions.json", canonicalPath: "../../data/actions.json"},
	{file: "conditionsdiseases.json", canonicalPath: "../../data/conditionsdiseases.json"},
	{file: "fluff-conditionsdiseases.json", canonicalPath: "../../data/fluff-conditionsdiseases.json"},
	{file: "skills.json", canonicalPath: "../../data/skills.json"},
	{file: "senses.json", canonicalPath: "../../data/senses.json"},
	{file: "variantrules.json", canonicalPath: "../../data/variantrules.json"},
	{file: "generated/gendata-variantrules.json", canonicalPath: "../../data/generated/gendata-variantrules.json"},
];

const fullCounts = {
	action: 0,
	conditionDiseaseStatus: 0,
	conditionFluff: 0,
	skill: 0,
	sense: 0,
	variantrule: 0,
};

for (const {file, canonicalPath} of fullDataSpecs) {
	const fullCanonical = JSON.parse(fs.readFileSync(new URL(canonicalPath, import.meta.url), "utf8"));
	const fullSidecar = JSON.parse(fs.readFileSync(new URL(`../../data/zh-TW/rules/${file}`, import.meta.url), "utf8"));
	const fullLocalized = await I18nZhTwRules.pApplyToData(fullCanonical, {
		filenames: [file],
		fnLoad: () => fullSidecar,
	});

	for (const [prop, entities] of Object.entries(fullCanonical)) {
		if (!Array.isArray(entities)) continue;
		if (prop === "action") fullCounts.action += entities.length;
		if (["condition", "disease", "status"].includes(prop)) fullCounts.conditionDiseaseStatus += entities.length;
		if (prop === "conditionFluff") fullCounts.conditionFluff += entities.length;
		if (prop === "skill") fullCounts.skill += entities.length;
		if (prop === "sense") fullCounts.sense += entities.length;
		if (prop === "variantrule") fullCounts.variantrule += entities.length;
		assert.equal(
			fullLocalized[prop].filter(it => it._displayName).length,
			entities.length,
			`${file}/${prop} did not localize every main display name`,
		);
		entities.forEach((entity, i) => assertCanonicalStructure({
			canonical: entity,
			localized: fullLocalized[prop][i],
			path: `${file}/${prop}/${i}`,
			isRoot: true,
		}));
	}
}

assert.deepEqual(fullCounts, {
	action: 48,
	conditionDiseaseStatus: 64,
	conditionFluff: 13,
	skill: 36,
	sense: 8,
	variantrule: 243,
});

console.log("Core rules runtime localization tests passed.");
