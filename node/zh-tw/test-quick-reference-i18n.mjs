import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {I18nZhTwQuickReference} from "../../js/zh-tw/quick-reference-i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const referenceId = "bookref-quick";

const canonicalHeaders = [
	"Beyond 1st Level",
	"Languages",
	"Multiclassing",
	"Step-by-Step Characters",
];
const displayHeaders = {
	"Beyond 1st Level": "超越 1 級",
	Languages: "語言",
	Multiclassing: "多職業",
	"Step-by-Step Characters": "逐步建立角色",
};

const getCanonicalSection = (name, ix) => ({
	type: "section",
	name,
	source: "PHB",
	page: 10 + ix,
	data: {quickref: 1},
	entries: name === "Beyond 1st Level"
		? [
			"English advancement prose.",
			{type: "entries", name: "Tiers of Play", source: "PHB", entries: ["English tier prose."]},
			{type: "inset", name: "Quick Build", source: "PHB", entries: ["English inset prose."]},
			{type: "list", items: [{type: "item", name: "Strength", entry: "English item prose."}]},
			{type: "table", caption: "Character Advancement", colLabels: ["Level"], rows: [[1]]},
		]
		: [`English prose for ${name}.`],
});

const canonical = {
	reference: {
		[referenceId]: {
			id: referenceId,
			name: "Quick Reference (5e/2014)",
			contents: [
				{name: "Character Creation", headers: canonicalHeaders},
				{name: "Equipment", headers: ["Adventuring Gear"]},
			],
		},
	},
	data: {
		[referenceId]: [
			{type: "entries", entries: canonicalHeaders.map(getCanonicalSection)},
			{type: "entries", entries: [getCanonicalSection("Adventuring Gear", 4)]},
		],
	},
};

const localizedSections = Object.fromEntries(canonicalHeaders.map((name, ix) => [name, {
	...getCanonicalSection(name, ix),
	ENG_name: name,
	name: displayHeaders[name],
	entries: name === "Beyond 1st Level"
		? [
			"升級的繁體中文規則敘述。",
			{type: "entries", ENG_name: "Tiers of Play", name: "遊戲層級", source: "PHB", entries: ["遊戲層級的中文敘述。"]},
			{type: "inset", ENG_name: "Quick Build", name: "快速建立", source: "PHB", entries: ["快速建立的中文敘述。"]},
			{type: "list", items: [{type: "item", ENG_name: "Strength", name: "力量", entry: "力量的中文敘述。"}]},
			{type: "table", caption: "角色升級", colLabels: ["等級"], rows: [[1]]},
		]
		: [`${displayHeaders[name]}的繁體中文規則敘述。`],
}]));

const localized = {
	reference: {
		[referenceId]: {
			ENG_name: "Quick Reference (5e/2014)",
			id: referenceId,
			name: "快速參考（5e／2014）",
			contents: [
				{
					ENG_name: "Character Creation",
					name: "角色建立",
					// Deliberately translated-source order, which must never control hash/index order.
					headers: ["逐步建立角色", "超越 1 級", "語言", "多職業"],
				},
				{ENG_name: "Equipment", name: "裝備", headers: ["冒險裝備"]},
			],
		},
	},
	data: {
		[referenceId]: [
			{
				type: "entries",
				// Deliberately reordered to prove `ENG_name`, not array position, controls sections.
				entries: [
					localizedSections["Step-by-Step Characters"],
					localizedSections.Multiclassing,
					localizedSections["Beyond 1st Level"],
					localizedSections.Languages,
				],
			},
			{
				type: "entries",
				entries: [{...getCanonicalSection("Adventuring Gear", 4), ENG_name: "Adventuring Gear", name: "冒險裝備", entries: ["冒險裝備的中文敘述。"]}],
			},
		],
	},
};

const canonicalBefore = JSON.stringify(canonical);
const localizedBefore = JSON.stringify(localized);
const view = I18nZhTwQuickReference.createLocalizedView({canonical, localized});

assert.equal(view.isLocalized, true);
assert.equal(view.reference.id, referenceId);
assert.equal(view.reference.name, "快速參考（5e／2014）");
assert.equal(view.reference.contents[0].name, "角色建立");

const outputHeaders = view.reference.contents[0].headers;
assert.deepEqual(outputHeaders.map(it => it.header), canonicalHeaders, "canonical first-chapter header order changed");
assert.deepEqual(outputHeaders.map(it => it.displayName), canonicalHeaders.map(it => displayHeaders[it]), "header display names were not mapped by ENG_name");
assert.deepEqual(
	outputHeaders.map(it => it.header.toLowerCase()),
	["beyond 1st level", "languages", "multiclassing", "step-by-step characters"],
	"hash components must remain English",
);

const outputSections = view.dataDocument.data[referenceId][0].entries;
assert.deepEqual(outputSections.map(it => it.name), canonicalHeaders, "body section order must follow canonical English data");
assert.deepEqual(outputSections.map(it => it._displayName), canonicalHeaders.map(it => displayHeaders[it]));
assert.equal(outputSections[0].source, "PHB");
assert.equal(outputSections[0].page, 10);
assert.equal(outputSections[0].data.quickref, 1);
assert.equal(outputSections[0].entries[0], "升級的繁體中文規則敘述。");

const nestedEntry = outputSections[0].entries[1];
assert.equal(nestedEntry.name, "Tiers of Play");
assert.equal(nestedEntry._displayName, "遊戲層級");

const inset = outputSections[0].entries[2];
assert.equal(inset.name, "Quick Build", "tracked inset title must remain canonical");
assert.equal(inset._displayName, "快速建立");
assert.equal(view.adapter.getDisplayHeaderText("Quick Build"), "快速建立");

const item = outputSections[0].entries[3].items[0];
assert.equal(item.name, "力量", "untracked item name should render in Chinese");
assert.equal(item._canonicalName, "Strength", "item English name must remain searchable");

const table = outputSections[0].entries[4];
assert.equal(table.caption, "Character Advancement", "tracked table caption must remain canonical");
assert.equal(table._displayCaption, "角色升級");
assert.equal(view.adapter.getDisplayHeaderText("Character Advancement"), "角色升級");

assert.equal(view.adapter.getCanonicalHeaderText("語言"), "Languages");
assert.equal(view.adapter.getDisplayHeaderText("Languages"), "語言");
assert.strictEqual(view.adapter.searchDataAlternate, canonical.data[referenceId], "English prose search must use canonical data");
assert.match(view.dataDocument.data[referenceId][0].entries[0].entries[0], /繁體中文/);
assert.match(view.adapter.searchDataAlternate[0].entries[0].entries[0], /English/);

const insetHeadingText = {textContent: "Quick Build"};
const tableCaptionText = {textContent: "Character Advancement"};
const fakeRenderedTitles = [
	{
		getAttribute: () => "7",
		matches: () => false,
		querySelector: () => insetHeadingText,
	},
	{
		getAttribute: () => "8",
		matches: selector => selector === "caption",
		querySelector: () => null,
		get textContent () { return tableCaptionText.textContent; },
		set textContent (value) { tableCaptionText.textContent = value; },
	},
];
view.adapter.localizeRenderedHeadings({
	root: {querySelectorAll: () => fakeRenderedTitles},
	trackedTitles: {7: "Quick Build", 8: "Character Advancement"},
});
assert.equal(insetHeadingText.textContent, "快速建立");
assert.equal(tableCaptionText.textContent, "角色升級");

assert.equal(JSON.stringify(canonical), canonicalBefore, "canonical input was mutated");
assert.equal(JSON.stringify(localized), localizedBefore, "localized input was mutated");
assert.equal(view.report.missingSections.length, 0);
assert.equal(view.report.extraSections.length, 0);
assert.equal(view.report.captionAlignmentMismatches.length, 0);

const fallback = I18nZhTwQuickReference.createLocalizedView({canonical, localized: null});
assert.equal(fallback.isLocalized, false);
assert.deepEqual(fallback.reference.contents[0].headers, canonicalHeaders);
assert.strictEqual(fallback.adapter.searchDataAlternate, fallback.dataDocument.data[referenceId]);

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/render.js");
await import("../../js/render-dice.js");
globalThis.VetoolsConfig = {get: () => null};
const RealRenderer = globalThis.Renderer;
const RealUrlUtil = globalThis.UrlUtil;
const renderer = new RealRenderer()
	.setFirstSection(true)
	.setEnumerateTitlesRel(true)
	.setTrackTitles(true)
	.resetHeaderIndex()
	.setHeaderIndexTableCaptions(true);
const renderStack = [];
renderer.recursiveRender(view.dataDocument.data[referenceId][0], renderStack);
const renderedHtml = renderStack.join("");
const trackedTitles = Object.values(renderer.getTrackedTitles());
assert.match(renderedHtml, /超越 1 級/, "standard body heading did not render in Chinese");
assert.match(renderedHtml, /遊戲層級/, "nested body heading did not render in Chinese");
assert.match(renderedHtml, /力量/, "item name did not render in Chinese");
assert.ok(trackedTitles.includes("Beyond 1st Level"), "section tracked title was localized");
assert.ok(trackedTitles.includes("Tiers of Play"), "nested tracked title was localized");
assert.ok(trackedTitles.includes("Quick Build"), "inset tracked title was localized");
assert.ok(trackedTitles.includes("Character Advancement"), "table tracked title was localized");
assert.ok(!trackedTitles.some(it => /[\u3400-\u9fff]/.test(it)), "tracked title leaked localized text into hashes");

// Load the real BookUtil implementation with the minimal browser-renderer globals
// needed by its static initializer, then exercise the bilingual search path.
class FakeRenderer {
	setEnumerateTitlesRel () { return this; }
	setTrackTitles () { return this; }

	static stripTags (value) { return `${value ?? ""}`.replace(/<[^>]*>/g, ""); }
	static get () {
		return {
			withSetRenderHeaderIndex: (_isEnabled, fn) => fn({render: value => `${value}`}),
		};
	}
}

globalThis.Renderer = FakeRenderer;
globalThis.RenderMap = {};
globalThis.HASH_PART_SEP = ",";
const FakeUrlUtil = {encodeForHash: value => encodeURIComponent(`${value}`.toLowerCase())};
globalThis.UrlUtil = FakeUrlUtil;
globalThis.veT = (strings, ...values) => {
	const html = strings.reduce((out, part, ix) => `${out}${part}${values[ix] ?? ""}`, "");
	return {vee: {txt: () => html.replace(/<[^>]*>/g, "")}};
};

const bookUtilSource = fs.readFileSync(path.join(repoRoot, "js/bookutils.js"), "utf8")
	.replace(/^import .*;\n/gm, "");
const {BookUtil} = await import(`data:text/javascript;base64,${Buffer.from(bookUtilSource).toString("base64")}`);
BookUtil.curRender.data = view.dataDocument.data[referenceId];
BookUtil.referenceI18n = view.adapter;

const chineseProseResults = BookUtil.Search.doSearch("升級的繁體中文", false);
assert.ok(chineseProseResults.length);
assert.equal(chineseProseResults[0].header, "Beyond 1st Level");
assert.equal(chineseProseResults[0].isAlternateSearchData, undefined);

const englishProseResults = BookUtil.Search.doSearch("English advancement prose", false);
assert.ok(englishProseResults.length);
assert.equal(englishProseResults[0].header, "Beyond 1st Level");
assert.equal(englishProseResults[0].isAlternateSearchData, true);
assert.match(BookUtil.Search.getResultHash(referenceId, englishProseResults[0]), /beyond%201st%20level/);
assert.doesNotMatch(BookUtil.Search.getResultHash(referenceId, englishProseResults[0]), /%E8%B6%85%E8%B6%8A/i);

for (const [term, expectedHeader] of [
	["超越 1 級", "Beyond 1st Level"],
	["Beyond 1st Level", "Beyond 1st Level"],
	["力量", "Beyond 1st Level"],
	["Strength", "Beyond 1st Level"],
	["角色升級", "Beyond 1st Level"],
	["Character Advancement", "Beyond 1st Level"],
]) {
	const results = BookUtil.Search.doSearch(term, false);
	assert.ok(results.length, `no bilingual search result for ${term}`);
	assert.equal(results[0].header, expectedHeader, `search result hash header was localized for ${term}`);
}

const fullCanonicalPath = path.join(repoRoot, "data/generated/bookref-quick.json");
const fullLocalizedPath = path.join(repoRoot, I18nZhTwQuickReference.DATA_URL);
if (fs.existsSync(fullLocalizedPath)) {
	const fullCanonical = JSON.parse(fs.readFileSync(fullCanonicalPath, "utf8"));
	const fullLocalized = JSON.parse(fs.readFileSync(fullLocalizedPath, "utf8"));
	const fullView = I18nZhTwQuickReference.createLocalizedView({canonical: fullCanonical, localized: fullLocalized});

	assert.equal(fullView.isLocalized, true);
	assert.equal(fullView.report.missingSections.length, 0);
	assert.equal(fullView.report.extraSections.length, 0);
	assert.equal(fullView.report.conflictingNames.length, 0);
	assert.equal(fullView.report.captionAlignmentMismatches.length, 0);
	assert.equal(fullView.reference.contents.length, 5);
	assert.equal(fullView.reference.contents.flatMap(it => it.headers).length, 46);
	assert.deepEqual(fullView.reference.contents[0].headers.map(it => it.header), canonicalHeaders);

	for (let ixChapter = 0; ixChapter < fullView.reference.contents.length; ++ixChapter) {
		assert.deepEqual(
			fullView.dataDocument.data[referenceId][ixChapter].entries.map(it => it.name),
			fullView.reference.contents[ixChapter].headers.map(it => it.header),
			`chapter ${ixChapter} body/reference canonical order mismatch`,
		);
		assert.deepEqual(
			fullView.dataDocument.data[referenceId][ixChapter].entries.map(it => it._displayName),
			fullView.reference.contents[ixChapter].headers.map(it => it.displayName),
			`chapter ${ixChapter} body/reference display names mismatch`,
		);
	}

	let bodyEngNameCount = 0;
	I18nZhTwQuickReference._walk(fullView.dataDocument.data[referenceId], obj => {
		if (typeof obj.ENG_name !== "string" || typeof obj.name !== "string") return;
		bodyEngNameCount++;
		if (obj.type === "item" || obj.type === "itemSub") assert.equal(obj._canonicalName, obj.ENG_name);
		else assert.equal(obj.name, obj.ENG_name);
	});
	assert.equal(bodyEngNameCount, 395);

	globalThis.Renderer = RealRenderer;
	globalThis.UrlUtil = RealUrlUtil;
	const fullRenderer = new RealRenderer()
		.setFirstSection(true)
		.setLazyImages(true)
		.setEnumerateTitlesRel(true)
		.setTrackTitles(true)
		.resetHeaderIndex()
		.setHeaderIndexTableCaptions(true)
		.setHeaderIndexImageTitles(true);
	const fullRenderStack = [];
	fullView.dataDocument.data[referenceId].forEach(group => fullRenderer.recursiveRender(group, fullRenderStack));
	const fullRenderedHtml = fullRenderStack.join("");
	const fullTrackedTitles = Object.values(fullRenderer.getTrackedTitles());
	assert.match(fullRenderedHtml, /高於1級/);
	assert.ok(fullTrackedTitles.includes("Beyond 1st Level"));
	assert.ok(fullTrackedTitles.includes("Character Advancement"));
	assert.ok(!fullTrackedTitles.some(it => /[\u3400-\u9fff]/.test(it)), "full sidecar tracked title leaked localized text into hashes");
	globalThis.Renderer = FakeRenderer;
	globalThis.UrlUtil = FakeUrlUtil;

	BookUtil.curRender.data = fullView.dataDocument.data[referenceId];
	BookUtil.referenceI18n = fullView.adapter;
	const fullChineseSearch = BookUtil.Search.doSearch("持續的冒險與挑戰", false);
	assert.ok(fullChineseSearch.length, "full sidecar Chinese prose search failed");
	assert.equal(fullChineseSearch[0].header, "Beyond 1st Level");
	assert.equal(fullChineseSearch[0].isAlternateSearchData, undefined);
	const fullEnglishSearch = BookUtil.Search.doSearch("goes on adventures and overcomes challenges", false);
	assert.ok(fullEnglishSearch.length, "full sidecar canonical English prose search failed");
	assert.equal(fullEnglishSearch[0].header, "Beyond 1st Level");
	assert.equal(fullEnglishSearch[0].isAlternateSearchData, true);

	console.log("Quick Reference full-sidecar QA: PASS (5 chapters, 46 canonical headers, 395 named body entries)");
} else {
	console.log("Quick Reference full-sidecar QA: SKIP (generated sidecar not present)");
}

console.log("Quick Reference fixture QA: PASS");
