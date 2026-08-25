import assert from "node:assert/strict";

import {I18nZhTwClassBody} from "../../js/zh-tw/class-body-i18n.js";

const fighter = {
	name: "戰士",
	ENG_name: "Fighter",
	source: "PHB",
	hd: {number: 1, faces: 10},
	subclassTitle: "Martial Archetype",
	startingEquipment: {
		default: ["(a) chain mail or (b) leather armor"],
		defaultData: [{a: ["chain mail|phb"], b: ["leather armor|phb"]}],
		goldAlternative: "{@dice 5d4 × 10|5d4 × 10|Starting Gold}",
	},
	classTableGroups: [{colLabels: ["Second Wind", "Weapon Mastery"], rows: [[2, 3]]}],
	optionalfeatureProgression: [{name: "Fighting Style", featureType: ["FS:F"], progression: {1: 1}}],
	classFeatures: [],
};

const fightingStyle = {
	name: "戰鬥風格",
	ENG_name: "Fighting Style",
	source: "PHB",
	className: "Fighter",
	classSource: "PHB",
	level: 1,
	entries: [
		"You adopt a particular style of fighting as your specialty.",
		{type: "options", count: 1, entries: [{type: "refOptionalfeature", optionalfeature: "Archery"}]},
	],
};
fighter.classFeatures.push(fightingStyle);

const champion = {
	name: "勇士",
	ENG_name: "Champion",
	shortName: "勇士",
	ENG_shortName: "Champion",
	source: "PHB",
	className: "Fighter",
	classSource: "PHB",
	subclassFeatures: [],
	subclassTableGroups: [{title: "Critical Hits", colLabels: ["Critical Range"], rows: [[20]]}],
	fluff: {
		_subclassFluff: {
			name: "Champion",
			shortName: "Champion",
			source: "PHB",
			className: "Fighter",
			classSource: "PHB",
		},
	},
};

const improvedCritical = {
	name: "精通重擊",
	ENG_name: "Improved Critical",
	source: "PHB",
	className: "Fighter",
	classSource: "PHB",
	subclassShortName: "Champion",
	subclassSource: "PHB",
	level: 3,
	entries: ["Your weapon attacks score a critical hit on a roll of 19 or 20."],
};
champion.subclassFeatures.push(improvedCritical);

const data = {
	class: [fighter],
	subclass: [champion],
};

const sidecar = {
	entities: {
		class: {
			"Fighter|PHB": {
				fields: {
					name: "不應覆蓋的名稱",
					source: "BAD",
					subclassTitle: "武術範型",
					startingEquipment: {
						default: ["（a）鏈甲，或（b）皮甲"],
						goldAlternative: "{@dice 5d4 × 10|5d4 × 10|起始金幣}",
						defaultData: [{a: ["壞資料"]}],
					},
					classTableGroups: {
						0: {
							colLabels: ["回氣", "武器精通"],
							rows: [[999, 999]],
						},
					},
					optionalfeatureProgression: [{name: "戰鬥風格", progression: {1: 999}}],
				},
			},
		},
		classFeature: [
			{
				uid: "Fighting Style|Fighter||1|PHB",
				entries: [
					"你採用一種特定戰鬥風格作為自己的專長。",
					{type: "options", count: 1, entries: [{type: "refOptionalfeature", optionalfeature: "Archery"}]},
				],
				level: 99,
			},
		],
		subclass: {
			"Champion|Fighter||PHB": {
				subclassTableGroups: [{title: "重擊", colLabels: ["重擊範圍"]}],
			},
		},
		subclassFeature: {
			"Improved Critical|Fighter||Champion||3|PHB": {
				entries: ["你的武器攻擊在擲出 19 或 20 時造成重擊。"],
			},
			"Missing Feature|Fighter||Champion||99": {
				entries: ["不會套用。"],
			},
		},
	},
};

const report = I18nZhTwClassBody.applyToData(data, {sidecar});

assert.equal(fighter.name, "戰士", "Class display/canonical name must not be overwritten by body sidecar");
assert.equal(fighter.source, "PHB", "Class source must remain canonical");
assert.equal(fighter.subclassTitle, "武術範型");
assert.deepEqual(fighter.startingEquipment.default, ["（a）鏈甲，或（b）皮甲"]);
assert.deepEqual(fighter.startingEquipment.defaultData, [{a: ["chain mail|phb"], b: ["leather armor|phb"]}], "Mechanical equipment data must remain untouched");
assert.deepEqual(fighter.classTableGroups[0].colLabels, ["回氣", "武器精通"]);
assert.deepEqual(fighter.classTableGroups[0].rows, [[2, 3]], "Mechanical table rows must remain untouched");
assert.equal(fighter.optionalfeatureProgression[0].name, "戰鬥風格");
assert.deepEqual(fighter.optionalfeatureProgression[0].progression, {1: 1}, "Progression mechanics must remain untouched");

assert.equal(fightingStyle.name, "戰鬥風格");
assert.equal(fightingStyle.source, "PHB");
assert.equal(fightingStyle.level, 1, "Feature level must remain canonical");
assert.equal(fightingStyle.entries[0], "你採用一種特定戰鬥風格作為自己的專長。");
assert.equal(improvedCritical.entries[0], "你的武器攻擊在擲出 19 或 20 時造成重擊。");
assert.equal(champion.subclassTableGroups[0].title, "重擊");
assert.equal(champion.fluff._subclassFluff.ENG_name, "Champion");
assert.equal(champion.fluff._subclassFluff.ENG_shortName, "Champion", "Predefined fluff hash must retain the canonical English short name");

assert.deepEqual(
	I18nZhTwClassBody.getEnglishBackup(fightingStyle),
	[
		"You adopt a particular style of fighting as your specialty.",
		{type: "options", count: 1, entries: [{type: "refOptionalfeature", optionalfeature: "Archery"}]},
	],
	"English body backup must remain available",
);
assert.equal(I18nZhTwClassBody.getEnglishBackup(fighter, "/subclassTitle"), "Martial Archetype");

assert.equal(report.records, 5);
assert.equal(report.matchedRecords, 4);
assert.equal(report.matchedEntities, 4);
assert.ok(report.appliedFields >= 9);
assert.ok(report.missingEntityUids.includes("subclassFeature:Missing Feature|Fighter||Champion||99"));
assert.ok(report.skippedFields.some(it => it.path === "/name" && it.reason === "field-not-allowed"));
assert.ok(report.skippedFields.some(it => it.path === "/source" && it.reason === "field-not-allowed"));
assert.ok(report.skippedFields.some(it => it.path === "/startingEquipment/defaultData" && it.reason === "field-not-allowed"));
assert.ok(report.skippedFields.some(it => it.path === "/classTableGroups/0/rows" && it.reason === "field-not-allowed"));
assert.ok(report.skippedFields.some(it => it.path === "/optionalfeatureProgression/0/progression" && it.reason === "field-not-allowed"));
assert.ok(report.skippedFields.some(it => it.path === "/level" && it.reason === "field-not-allowed"));

const reportSecondApply = I18nZhTwClassBody.applyToData(data, {sidecar});
assert.equal(reportSecondApply.matchedRecords, 4, "Re-applying should remain idempotently matchable after name localization");
assert.equal(
	I18nZhTwClassBody.getEnglishBackup(fightingStyle)[0],
	"You adopt a particular style of fighting as your specialty.",
	"Re-applying must not replace the original English backup",
);

assert.equal(I18nZhTwClassBody.restoreEntity(improvedCritical, {isClearBackup: true}), 1);
assert.equal(improvedCritical.entries[0], "Your weapon attacks score a critical hit on a roll of 19 or 20.");
assert.equal(I18nZhTwClassBody.getEnglishBackup(improvedCritical), undefined);

assert.equal(
	I18nZhTwClassBody.normalizeUid("Fighting Style|Fighter||1|PHB", "classFeature"),
	I18nZhTwClassBody.normalizeUid("Fighting Style|Fighter||1", "classFeature"),
	"Explicit default sources should normalize to the same canonical UID",
);
assert.equal(
	I18nZhTwClassBody.normalizeUid("Champion|Fighter||PHB", "subclass"),
	I18nZhTwClassBody.normalizeUid("Champion|Fighter", "subclass"),
);

const guardedFeature = {
	name: "Second Wind",
	source: "PHB",
	className: "Fighter",
	classSource: "PHB",
	level: 1,
	entries: ["As a bonus action, regain {@dice 1d10} + 1 Hit Points."],
};
const guardedReport = I18nZhTwClassBody.applyToData(
	{classFeature: [guardedFeature]},
	{
		sidecar: {
			classFeature: [{
				match: {canonicalName: "Second Wind", className: "Fighter", classSource: "PHB", level: 1, source: "PHB"},
				patches: [
					{
						path: "/entries/0",
						expectedEnglish: "As a bonus action, regain {@dice 1d10} + 1 Hit Points.",
						translation: "你可以使用一個附贈動作，恢復 {@dice 1d10} + 1 點生命值。",
					},
					{
						path: "/name",
						expectedEnglish: "Second Wind",
						translation: "不應由正文 sidecar 覆蓋",
					},
				],
			}],
		},
	},
);
assert.equal(guardedFeature.name, "Second Wind");
assert.equal(guardedFeature.entries[0], "你可以使用一個附贈動作，恢復 {@dice 1d10} + 1 點生命值。");
assert.equal(guardedReport.appliedFields, 1);
assert.ok(guardedReport.skippedFields.some(it => it.path === "/name" && it.reason === "field-not-allowed"));
assert.equal(
	I18nZhTwClassBody.getEnglishBackup(guardedFeature, "/entries/0"),
	"As a bonus action, regain {@dice 1d10} + 1 Hit Points.",
);

const invalidGuardedFeature = {
	name: "Action Surge",
	source: "PHB",
	className: "Fighter",
	classSource: "PHB",
	level: 2,
	entries: ["You can take 1 additional action."],
};
const invalidGuardedReport = I18nZhTwClassBody.applyToData(
	{classFeature: [invalidGuardedFeature]},
	{
		sidecar: {
			classFeature: [{
				match: {canonicalName: "Action Surge", className: "Fighter", classSource: "PHB", level: 2, source: "PHB"},
				patches: [{
					path: "/entries/0",
					expectedEnglish: "You can take 1 additional action.",
					translation: "你可以額外採取 2 個動作。",
				}],
			}],
		},
	},
);
assert.equal(invalidGuardedFeature.entries[0], "You can take 1 additional action.");
assert.ok(invalidGuardedReport.skippedFields.some(it => it.reason === "visible-number-signature-mismatch"));

console.log(JSON.stringify({
	status: "ok",
	records: report.records,
	matchedRecords: report.matchedRecords,
	appliedFields: report.appliedFields,
	guardedAppliedFields: guardedReport.appliedFields,
	skippedFields: report.skippedFields.length,
	missingEntityUids: report.missingEntityUids.length,
}, null, 2));
