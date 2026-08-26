import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SIDECAR_DIR = path.join(ROOT, "data/zh-TW/class");
const CORRECTIONS_DIR = path.join(ROOT, "translation/zh-TW/classes/manual-corrections");
const REPORT_IN = path.join(ROOT, "translation/zh-TW/classes/generated/full-class-import-report.json");
const REPORT_OUT = path.join(ROOT, "translation/zh-TW/classes/generated/full-class-validation-report.json");

const CATEGORIES = ["class", "subclass", "classFeature", "subclassFeature", "classFluff", "subclassFluff"];
const CANONICAL_KEYS = new Set([
	"type", "source", "page", "className", "classSource", "subclassShortName", "subclassSource",
	"classFeature", "subclassFeature", "classFeatures", "subclassFeatures", "optionalfeature", "item",
	"spell", "feat", "background", "race", "creature", "condition", "variantrule", "reprintedAs",
	"defaultData", "featureType", "colStyles", "rowStyles", "style", "href", "path", "url",
	"attributes", "tag", "proficiency", "optional", "equipmentType",
]);
const RE_VISIBLE_NUMBER = /\d+(?:[.,]\d+)*/gu;
const RE_ASCII_WORD = /[A-Za-z]{3,}/u;
const RE_HAN = /[\u3400-\u9fff]/u;
const UNTRANSLATED_SHORT_VISIBLE = new Set(["No", "Yes", "None", "Any", "Varies"]);
const RE_INLINE_TAG = /\{@([A-Za-z0-9]+) ([^{}]*)\}/gu;
const REFERENCE_TAGS = new Set([
	"action", "background", "boon", "charoption", "class", "condition", "creature", "creatureFluff",
	"cult", "deck", "deity", "disease", "facility", "feat", "hazard", "item", "itemMastery",
	"itemProperty", "language", "legroup", "object", "optfeature", "optionalfeature", "psionic", "race",
	"raceFluff", "recipe", "reward", "sense", "skill", "spell", "status", "table", "trap", "variantrule",
	"vehicle", "vehupgrade", "subclass", "classFeature", "subclassFeature", "quickref",
]);
const DISPLAY_FIRST_TAGS = new Set(["filter", "5etools", "book", "adventure"]);
const TAG_DISPLAY_INDEX = new Map([
	["deity", 3],
	["subclass", 4],
	["classFeature", 5],
	["subclassFeature", 7],
	["quickref", 4],
]);

const readJson = async file => JSON.parse(await fs.readFile(file, "utf8"));
const jsonEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const stripInlineTags = value => {
	let out = value;
	let prev;
	do {
		prev = out;
		out = out.replace(/\{@[A-Za-z0-9]+ [^{}]*\}/gu, "");
	} while (out !== prev);
	return out
		.replace(/<[^>]+>/gu, "")
		.replace(/&[a-zA-Z0-9#]+;/gu, " ")
		.trim();
};

const getNumberSignature = value => [...stripInlineTags(value).matchAll(RE_VISIBLE_NUMBER)]
	.map(match => match[0].replaceAll(",", ""))
	.sort((a, b) => a.localeCompare(b, "en", {numeric: true}));

const getRawNumberSet = value => new Set([...value.matchAll(RE_VISIBLE_NUMBER)]
	.map(match => match[0].replaceAll(",", "")));

const ENGLISH_WRITTEN_NUMBERS = new Map([
	["0", /\b(?:zero|none)\b/iu],
	["1", /\b(?:a|an|one|once|first|single|next|past)\b/iu],
	["2", /\b(?:two|twice|second|both|double|half)\b/iu],
	["3", /\b(?:three|third|triple)\b/iu],
	["4", /\b(?:four|fourth|quarter)\b/iu],
	["5", /\b(?:five|fifth)\b/iu],
	["6", /\b(?:six|sixth)\b/iu],
	["7", /\b(?:seven|seventh)\b/iu],
	["8", /\b(?:eight|eighth)\b/iu],
	["9", /\b(?:nine|ninth)\b/iu],
	["10", /\b(?:ten|tenth)\b/iu],
	["11", /\b(?:eleven|eleventh)\b/iu],
	["12", /\b(?:twelve|twelfth)\b/iu],
	["13", /\b(?:thirteen|thirteenth)\b/iu],
	["14", /\b(?:fourteen|fourteenth)\b/iu],
	["15", /\b(?:fifteen|fifteenth)\b/iu],
	["16", /\b(?:sixteen|sixteenth)\b/iu],
	["17", /\b(?:seventeen|seventeenth)\b/iu],
	["18", /\b(?:eighteen|eighteenth)\b/iu],
	["19", /\b(?:nineteen|nineteenth)\b/iu],
	["20", /\b(?:twenty|twentieth)\b/iu],
	["100", /\b(?:hundred|hundredth|percentile)\b/iu],
]);

// These localized sentences repeat an entity's level or resource die from the
// surrounding feature metadata. The extra number is contextual clarification,
// not a changed rule value.
const CONTEXTUAL_NUMBER_ALLOWLIST = new Set([
	"class-druid.json:/subclassFeature/1/entries/0:2",
	"class-druid.json:/subclassFeature/9/entries/0:2",
	"class-druid.json:/subclassFeature/36/entries/1:6",
	"class-sidekick.json:/classFeature/35/entries/1:6",
]);

const toChineseInteger = value => {
	if (!Number.isSafeInteger(value) || value < 0 || value > 9999) return null;
	if (value === 0) return "零";
	const digits = "零一二三四五六七八九";
	const units = [[1000, "千"], [100, "百"], [10, "十"]];
	let remaining = value;
	let out = "";
	let needsZero = false;
	for (const [unitValue, unitLabel] of units) {
		const digit = Math.floor(remaining / unitValue);
		remaining %= unitValue;
		if (digit) {
			if (needsZero) out += "零";
			if (!(unitValue === 10 && digit === 1 && !out)) out += digits[digit];
			out += unitLabel;
			needsZero = remaining > 0 && remaining < unitValue / 10;
		} else if (out && remaining) {
			needsZero = true;
		}
	}
	if (remaining) {
		if (needsZero) out += "零";
		out += digits[remaining];
	}
	return out;
};

const localizedHasWrittenNumber = (number, value) => {
	if (!/^\d+$/u.test(number)) return false;
	const integer = Number(number);
	if (integer === 0 && value.includes("戲法")) return true;
	const candidates = new Set([toChineseInteger(integer)]);
	if (integer === 1) candidates.add("首");
	if (integer === 2) ["兩", "雙"].forEach(candidate => candidates.add(candidate));
	return [...candidates].filter(Boolean).some(candidate => value.includes(candidate));
};

const englishHasWrittenNumber = (number, value) => ENGLISH_WRITTEN_NUMBERS.get(number)?.test(value) || false;

const getCanonicalTagSignature = match => {
	const tagType = match[1];
	const parts = match[2].split("|");
	if (REFERENCE_TAGS.has(tagType)) {
		const displayIx = TAG_DISPLAY_INDEX.get(tagType) ?? 2;
		return JSON.stringify([tagType, ...Array.from({length: displayIx}, (_, ix) => parts[ix] || "")]);
	}
	if (DISPLAY_FIRST_TAGS.has(tagType)) return JSON.stringify([tagType, ...parts.slice(1)]);
	return null;
};

const getCanonicalTagSignatures = value => [...value.matchAll(RE_INLINE_TAG)]
	.map(getCanonicalTagSignature)
	.filter(Boolean);

const approvedCorrectionTagSignatures = new Map();
for (const file of await fs.readdir(CORRECTIONS_DIR)) {
	if (!file.endsWith(".json")) continue;
	const corrections = (await readJson(path.join(CORRECTIONS_DIR, file))).corrections || [];
	for (const correction of corrections) {
		if (typeof correction.value !== "string") continue;
		approvedCorrectionTagSignatures.set(
			`${file}:${correction.path}`,
			new Set(getCanonicalTagSignatures(correction.value)),
		);
	}
}

const walkCanonical = ({english, localized, file, entityPath, relativePath = "", failures}) => {
	if (Array.isArray(english)) {
		if (!Array.isArray(localized) || english.length !== localized.length) {
			failures.push({file, path: `${entityPath}${relativePath}`, reason: "structure-array-mismatch"});
			return;
		}
		english.forEach((child, ix) => walkCanonical({
			english: child,
			localized: localized[ix],
			file,
			entityPath,
			relativePath: `${relativePath}/${ix}`,
			failures,
		}));
		return;
	}
	if (!english || typeof english !== "object") return;
	if (!localized || typeof localized !== "object" || Array.isArray(localized)) {
		failures.push({file, path: `${entityPath}${relativePath}`, reason: "structure-object-mismatch"});
		return;
	}
	for (const [key, englishValue] of Object.entries(english)) {
		const childPath = `${relativePath}/${key}`;
		if (CANONICAL_KEYS.has(key) && !jsonEqual(englishValue, localized[key])) {
			failures.push({file, path: `${entityPath}${childPath}`, reason: "canonical-value-changed"});
			continue;
		}
		walkCanonical({english: englishValue, localized: localized[key], file, entityPath, relativePath: childPath, failures});
	}
};

const collectContentStrings = ({english, localized, file, pathPrefix, out}) => {
	if (typeof english === "string" && typeof localized === "string") {
		out.push({file, path: pathPrefix, english, localized});
		return;
	}
	if (Array.isArray(english) && Array.isArray(localized)) {
		english.forEach((child, ix) => collectContentStrings({
			english: child,
			localized: localized[ix],
			file,
			pathPrefix: `${pathPrefix}/${ix}`,
			out,
		}));
		return;
	}
	if (!english || typeof english !== "object" || !localized || typeof localized !== "object") return;
	for (const [key, englishValue] of Object.entries(english)) {
		if (CANONICAL_KEYS.has(key) || ["ENG_name", "ENG_shortName"].includes(key)) continue;
		collectContentStrings({
			english: englishValue,
			localized: localized[key],
			file,
			pathPrefix: `${pathPrefix}/${key}`,
			out,
		});
	}
};

const collectEntityVisibleStrings = ({english, localized, category, file, ix, out}) => {
	const root = `/${category}/${ix}`;
	const collect = (key, englishValue = english[key], localizedValue = localized[key]) => {
		if (englishValue == null || localizedValue == null) return;
		collectContentStrings({english: englishValue, localized: localizedValue, file, pathPrefix: `${root}/${key}`, out});
	};

	["entries", "headerEntries", "footerEntries", "subclassTitle"].forEach(key => collect(key));
	if (category === "class") {
		["default", "entries", "goldAlternative"].forEach(key => collect(
			`startingEquipment/${key}`,
			english.startingEquipment?.[key],
			localized.startingEquipment?.[key],
		));
		["weapons", "tools"].forEach(key => collect(
			`startingProficiencies/${key}`,
			english.startingProficiencies?.[key],
			localized.startingProficiencies?.[key],
		));
		["requirementsSpecial", "entries"].forEach(key => collect(
			`multiclassing/${key}`,
			english.multiclassing?.[key],
			localized.multiclassing?.[key],
		));
		["weapons", "tools"].forEach(key => collect(
			`multiclassing/proficienciesGained/${key}`,
			english.multiclassing?.proficienciesGained?.[key],
			localized.multiclassing?.proficienciesGained?.[key],
		));
	}
	["classTableGroups", "subclassTableGroups"].forEach(key => collect(key));
	["optionalfeatureProgression", "featProgression"].forEach(key => {
		(english[key] || []).forEach((value, progressionIx) => collect(
			`${key}/${progressionIx}/name`,
			value?.name,
			localized[key]?.[progressionIx]?.name,
		));
	});
};

const manifest = await readJson(path.join(SIDECAR_DIR, "index.json"));
assert.equal(manifest._meta.upstreamTag, "v2.33.3");
assert.equal(manifest.files.length, 30);

const report = {
	status: "ok",
	files: manifest.files.length,
	entityCounts: Object.fromEntries(CATEGORIES.map(category => [category, 0])),
	canonicalFailures: [],
	nameBackupFailures: [],
	untranslatedProse: [],
	inlineTagCanonicalFailures: [],
	mixedAsciiWarnings: [],
	rawVisibleNumberWarnings: [],
	visibleNumberWarnings: [],
	importWarnings: {},
};
const visibleStrings = [];

for (const file of manifest.files) {
	const [englishData, localizedData] = await Promise.all([
		readJson(path.join(ROOT, "data/class", file)),
		readJson(path.join(SIDECAR_DIR, file)),
	]);
	for (const category of CATEGORIES) {
		const englishEntities = englishData[category] || [];
		const localizedEntities = localizedData[category] || [];
		assert.equal(localizedEntities.length, englishEntities.length, `${file}:${category} entity count changed`);
		report.entityCounts[category] += localizedEntities.length;
		englishEntities.forEach((english, ix) => {
			const localized = localizedEntities[ix];
			const entityPath = `/${category}/${ix}`;
			if (localized.ENG_name !== english.name) report.nameBackupFailures.push({file, path: `${entityPath}/ENG_name`});
			if (english.shortName != null && localized.ENG_shortName !== english.shortName) report.nameBackupFailures.push({file, path: `${entityPath}/ENG_shortName`});
			walkCanonical({english, localized, file, entityPath, failures: report.canonicalFailures});
			collectEntityVisibleStrings({english, localized, category, file, ix, out: visibleStrings});
		});
	}
}

assert.deepEqual(report.entityCounts, manifest.entityCounts);

for (const item of visibleStrings) {
	const strippedEnglish = stripInlineTags(item.english);
	const strippedLocalized = stripInlineTags(item.localized);
	const isMechanicalDisplayCode = ["simple", "martial", "firearms"].includes(item.english)
		|| /\/attributes\/\d+$/u.test(item.path)
		|| /\/(?:tag|proficiency)$/u.test(item.path);
	if ((RE_ASCII_WORD.test(strippedEnglish) || UNTRANSLATED_SHORT_VISIBLE.has(strippedEnglish)) && item.english === item.localized && !RE_HAN.test(strippedLocalized) && !item.path.endsWith("/by") && !isMechanicalDisplayCode) {
		report.untranslatedProse.push(item);
	}
	const asciiWords = strippedLocalized.match(/[A-Za-z]{4,}/gu) || [];
	const nonRulesAscii = asciiWords.filter(word => !new Set(["Class", "Feature", "Level", "Mystic", "Sidekick", "Artificer"]).has(word));
	if (RE_HAN.test(strippedLocalized) && nonRulesAscii.length) report.mixedAsciiWarnings.push({...item, words: nonRulesAscii});
	const englishNumbers = getNumberSignature(item.english);
	const localizedNumbers = getNumberSignature(item.localized);
	if (!jsonEqual(englishNumbers, localizedNumbers)) {
		const rawWarning = {...item, englishNumbers, localizedNumbers};
		report.rawVisibleNumberWarnings.push(rawWarning);
		const englishSet = new Set(englishNumbers);
		const localizedSet = new Set(localizedNumbers);
		const rawEnglishNumbers = getRawNumberSet(item.english);
		const rawLocalizedNumbers = getRawNumberSet(item.localized);
		const unresolvedEnglishNumbers = [...englishSet].filter(number => (
			!localizedSet.has(number)
			&& !rawLocalizedNumbers.has(number)
			&& !localizedHasWrittenNumber(number, strippedLocalized)
		));
		const unresolvedLocalizedNumbers = [...localizedSet].filter(number => (
			!englishSet.has(number)
			&& !rawEnglishNumbers.has(number)
			&& !englishHasWrittenNumber(number, strippedEnglish)
			&& !CONTEXTUAL_NUMBER_ALLOWLIST.has(`${item.file}:${item.path}:${number}`)
		));
		if (unresolvedEnglishNumbers.length || unresolvedLocalizedNumbers.length) {
			report.visibleNumberWarnings.push({
				...rawWarning,
				unresolvedEnglishNumbers,
				unresolvedLocalizedNumbers,
			});
		}
	}
	const englishTagSignatures = new Set(getCanonicalTagSignatures(item.english));
	const approvedTagSignatures = approvedCorrectionTagSignatures.get(`${item.file}:${item.path}`) || new Set();
	for (const localizedSignature of getCanonicalTagSignatures(item.localized)) {
		if (!englishTagSignatures.has(localizedSignature) && !approvedTagSignatures.has(localizedSignature)) {
			report.inlineTagCanonicalFailures.push({...item, localizedSignature: JSON.parse(localizedSignature)});
		}
	}
}

const importReport = await readJson(REPORT_IN);
for (const key of ["unmatchedEnglishEntities", "unmatchedTranslatedEntities", "arrayShapeMismatches", "tagShapeMismatches", "manualCorrectionsApplied"]) {
	report.importWarnings[key] = importReport.qa[key] || [];
}
report.visibleStringPairsChecked = visibleStrings.length;

if (report.canonicalFailures.length || report.nameBackupFailures.length || report.untranslatedProse.length || report.inlineTagCanonicalFailures.length) report.status = "failed";
await fs.writeFile(REPORT_OUT, `${JSON.stringify(report, null, "\t")}\n`, "utf8");

assert.equal(report.canonicalFailures.length, 0, "Canonical Class metadata/reference fields changed");
assert.equal(report.nameBackupFailures.length, 0, "Canonical English name backups are missing");
assert.equal(report.untranslatedProse.length, 0, "Untranslated visible English prose remains");
assert.equal(report.inlineTagCanonicalFailures.length, 0, "Localized inline tags contain changed canonical lookup keys");

console.log(JSON.stringify({
	status: report.status,
	files: report.files,
	entityCounts: report.entityCounts,
	visibleStringPairsChecked: report.visibleStringPairsChecked,
	untranslatedProse: report.untranslatedProse.length,
	mixedAsciiWarnings: report.mixedAsciiWarnings.length,
	rawVisibleNumberWarnings: report.rawVisibleNumberWarnings.length,
	visibleNumberWarnings: report.visibleNumberWarnings.length,
	canonicalFailures: report.canonicalFailures.length,
	inlineTagCanonicalFailures: report.inlineTagCanonicalFailures.length,
	manualCorrectionsApplied: report.importWarnings.manualCorrectionsApplied.length,
}, null, 2));
