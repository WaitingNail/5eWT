import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
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

const I18n = globalThis.I18nZhTwContent;
const canonical = readJson("data/psionics.json");
const sidecar = readJson("data/zh-TW/psionics/psionics.json");
const snapshot = structuredClone(canonical);
const localized = await I18n.pApplyDataFile({
	file: "psionics.json",
	data: canonical,
	fnLoad: async () => sidecar,
});

test("psionics browser scripts initialize together in one global scope", () => {
	const listeners = [];
	const context = vm.createContext({
		I18nZhTwContent: I18n,
		Parser,
		DataUtil,
		PageFilterBase: class {},
		Filter: class {},
		ListUiUtil: {ListSyntax: class {}},
		SublistManager: class {},
		ListPage: class {},
		UtilsTableview: {},
		window: {addEventListener: (event, callback) => listeners.push({event, callback})},
	});
	for (const file of ["js/render-psionics.js", "js/filter-psionics.js", "js/psionics.js"]) {
		vm.runInContext(readText(file), context, {filename: file});
	}
	assert.ok(context.dbg_page, "page initialization failed");
	assert.equal(listeners.length, 1);
	assert.equal(listeners[0].event, "load");
});

test("all psionic entities, modes, and submodes load without mutating canonical mechanics", () => {
	assert.deepEqual(canonical, snapshot, "runtime localization mutated canonical psionics data");
	assert.equal(localized.psionic.length, 52);
	assert.equal(localized.psionic.reduce((count, ent) => count + (ent.modes?.length || 0), 0), 172);
	assert.equal(
		localized.psionic.reduce(
			(count, ent) => count + (ent.modes || []).reduce((modeCount, mode) => modeCount + (mode.submodes?.length || 0), 0),
			0,
		),
		7,
	);

	for (let ix = 0; ix < localized.psionic.length; ix++) {
		const original = canonical.psionic[ix];
		const entity = localized.psionic[ix];
		assert.equal(entity.name, original.name, `${original.name} canonical name changed`);
		assert.match(entity._displayName, /\p{Script=Han}/u, `${original.name} name was not translated`);
		assert.ok(I18n.getBilingualName(entity).includes(`（${original.name}）`), `${original.name} name is not bilingual`);
		assert.equal(entity.type, original.type, `${original.name} type changed`);
		assert.equal(entity.order, original.order, `${original.name} order changed`);

		for (let modeIx = 0; modeIx < (entity.modes?.length || 0); modeIx++) {
			const originalMode = original.modes[modeIx];
			const mode = entity.modes[modeIx];
			assert.equal(mode.name, originalMode.name, `${original.name}/${originalMode.name} canonical mode name changed`);
			assert.ok(I18n.getBilingualName(mode).includes(`（${originalMode.name}）`), `${original.name}/${originalMode.name} is not bilingual`);
			assert.deepEqual(mode.cost, originalMode.cost, `${original.name}/${originalMode.name} cost changed`);
			assert.deepEqual(mode.concentration, originalMode.concentration, `${original.name}/${originalMode.name} concentration changed`);

			for (let subIx = 0; subIx < (mode.submodes?.length || 0); subIx++) {
				const originalSubmode = originalMode.submodes[subIx];
				const submode = mode.submodes[subIx];
				assert.equal(submode.name, originalSubmode.name, `${original.name}/${originalSubmode.name} canonical submode name changed`);
				assert.ok(I18n.getBilingualName(submode).includes(`（${originalSubmode.name}）`), `${original.name}/${originalSubmode.name} is not bilingual`);
			}
		}
	}
});

test("psionic details render translated prose with bilingual rule names", () => {
	const adaptiveBody = localized.psionic.find(it => it.name === "Adaptive Body");
	assert.equal(I18n.getBilingualName(adaptiveBody), "軀體適應（Adaptive Body）");
	assert.equal(adaptiveBody.order, "Immortal");
	assert.equal(adaptiveBody._displayOrder, "不朽者修會");
	assert.equal(I18n.getPsionicOrder(adaptiveBody.order, {isBilingual: true}), "不朽者修會（Immortal）");
	assert.equal(I18n.getPsionicType(adaptiveBody.type, {isBilingual: true}), "靈術（Discipline）");
	assert.match(adaptiveBody.focus, /專注於這項靈術/u);

	const environmentalAdaptation = adaptiveBody.modes.find(it => it.name === "Environmental Adaptation");
	assert.equal(I18n.getBilingualName(environmentalAdaptation), "環境適應（Environmental Adaptation）");
	assert.equal(I18n.getPsionicModeMeta(environmentalAdaptation), "（2 靈力點）");
	const energyAdaptation = adaptiveBody.modes.find(it => it.name === "Energy Adaptation");
	assert.equal(I18n.getPsionicModeMeta(energyAdaptation), "（5 靈力點；專注，1 小時）");

	assert.equal(Renderer.psionic.getTypeOrderString(adaptiveBody), "不朽者修會（Immortal） 靈術（Discipline）");
	const rendered = Renderer.psionic.getBodyHtml(adaptiveBody);
	assert.match(rendered, /心靈集中（Psychic Focus）/u);
	assert.match(rendered, /環境適應（Environmental Adaptation）/u);
	assert.match(rendered, /能量適應（Energy Adaptation）/u);
	assert.match(rendered, /5 靈力點；專注，1 小時/u);
	assert.doesNotMatch(rendered, /\bpsi\b|conc\.|\bhr\.|\bfeet\b|\bft\./iu);
	assert.equal(environmentalAdaptation.name, "Environmental Adaptation", "rendering changed the canonical mode name");
});

test("reordered inline tags retain the correct canonical targets and Chinese labels", () => {
	const bestialForm = sidecar.psionic.find(it => it.ENG_name === "Bestial Form");
	const perfectSenses = bestialForm.modes
		.flatMap(mode => mode.submodes || [])
		.find(it => it.ENG_name === "Perfect Senses");
	assert.match(perfectSenses.entries[0], /\{@condition blinded\|\|目盲\}.*\{@condition invisible\|\|隱形\}/u);
	assert.doesNotMatch(perfectSenses.entries[0], /invisible\|\|目盲|blinded\|\|隱形/iu);

	const visit = (value, context = "") => {
		if (typeof value === "string") {
			for (const match of value.matchAll(/\{@(condition|skill|status) ([^{}]+)\}/giu)) {
				const [, tagType, body] = match;
				const parts = body.split("|");
				const expected = tagType === "condition"
					? I18n.getCondition(parts[0])
					: tagType === "skill"
						? I18n.getSkill(parts[0])
						: `${parts[0]}`.toLowerCase() === "concentration" ? "專注" : parts[0];
				if (`${expected}`.toLowerCase() === `${parts[0]}`.toLowerCase()) continue;
				assert.equal(parts[2], expected, `${context} has the wrong ${tagType} display in ${match[0]}`);
			}
			return;
		}
		if (Array.isArray(value)) return value.forEach((child, ix) => visit(child, `${context}/${ix}`));
		if (value && typeof value === "object") {
			for (const [key, child] of Object.entries(value)) visit(child, `${context}/${key}`);
		}
	};
	visit(sidecar.psionic, "psionic");
});

test("guarded psionics import report proves complete alignment and preserved mechanics", () => {
	const index = readJson("data/zh-TW/psionics/index.json");
	assert.deepEqual(index.entityCounts, {psionic: 52});

	const report = readJson("translation/zh-TW/psionics/generated/psionics-import-report.json");
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
		"tagShapeMismatches",
	]) assert.deepEqual(report.qa[key], [], `${key} is not empty`);
	assert.equal(report.qa.numericDifferencesRawCount, report.qa.numericEquivalentDifferences.length);
	assert.ok(report.qa.numericEquivalentDifferences.length > 0);
});

test("psionics page shell, list, filters, and renderer use the zh-TW runtime", () => {
	const html = readText("psionics.html");
	assert.match(html, /<title>靈能 - 5etools<\/title>/u);
	assert.match(html, /js\/zh-tw\/content-i18n\.js/u);

	const page = readText("js/psionics.js");
	assert.match(page, /name: "名稱"/u);
	assert.match(page, /getBilingualName\(p\)/u);
	assert.match(page, /getPsionicType/u);
	assert.match(page, /getPsionicOrder/u);

	const filter = readText("js/filter-psionics.js");
	assert.match(filter, /header: "類型"/u);
	assert.match(filter, /header: "修會"/u);
	assert.match(filter, /getPsionicOrder/u);

	const renderer = readText("js/render.js");
	assert.match(renderer, /心靈集中（Psychic Focus）/u);
	assert.match(renderer, /getPsionicModeMeta/u);
});
