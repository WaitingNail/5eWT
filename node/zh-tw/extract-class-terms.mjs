import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const UPSTREAM_ROOT = process.env.ZH_TW_UPSTREAM_ROOT
	? path.resolve(process.cwd(), process.env.ZH_TW_UPSTREAM_ROOT)
	: PROJECT_ROOT;
const CLASS_DIR = path.join(UPSTREAM_ROOT, "data", "class");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "translation", "zh-TW", "classes", "generated");
const CORE_GLOSSARY_PATH = path.join(PROJECT_ROOT, "translation", "zh-TW", "glossary-proposed.csv");
const LEGACY_BASE_URL = "https://5eclone.pingstudio.tw/data/class";
const LEGACY_CACHE_PATH = path.join(OUTPUT_DIR, "legacy-5eclone-class-term-map.json");

const CLASS_FILE_RE = /^class-[a-z0-9-]+\.json$/;
const TOP_LEVEL_CATEGORIES = {
	class: "class",
	subclass: "subclass",
	classFeature: "class-feature",
	subclassFeature: "subclass-feature",
};

function csvEscape (value) {
	const str = value == null ? "" : `${value}`;
	return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

function parseCsv (text) {
	const rows = [];
	let row = [];
	let field = "";
	let isQuoted = false;
	for (let i = 0; i < text.length; ++i) {
		const char = text[i];
		if (isQuoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				++i;
				continue;
			}
			if (char === '"') {
				isQuoted = false;
				continue;
			}
			field += char;
			continue;
		}
		if (char === '"') {
			isQuoted = true;
			continue;
		}
		if (char === ",") {
			row.push(field);
			field = "";
			continue;
		}
		if (char === "\n") {
			row.push(field.replace(/\r$/, ""));
			if (row.some(Boolean)) rows.push(row);
			row = [];
			field = "";
			continue;
		}
		field += char;
	}
	if (isQuoted) throw new Error("Unterminated quoted CSV field.");
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

function toPointerSegment (value) {
	return `${value}`.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isCandidateTerm (value) {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > 160) return false;
	if (/^\{@/.test(trimmed)) return false;
	if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed)) return false;
	return /[A-Za-z]/.test(trimmed);
}

function getEdition (entity) {
	if (entity.edition) return entity.edition;
	if (entity.source === "XPHB") return "one";
	return "classic-or-other";
}

function loadCoreGlossary () {
	const [headers, ...rows] = parseCsv(fs.readFileSync(CORE_GLOSSARY_PATH, "utf8"));
	const ix = Object.fromEntries(headers.map((header, i) => [header, i]));
	return new Map(rows.map(row => [row[ix.english], {
		zh: row[ix.proposed_zh_tw],
		alternative: row[ix.alternative_zh_tw],
		status: row[ix.status],
		source: row[ix.source],
		notes: row[ix.notes],
	}]));
}

async function loadLegacyTranslations (files) {
	if (!process.env.ZH_TW_REFRESH_LEGACY && fs.existsSync(LEGACY_CACHE_PATH)) {
		const cached = JSON.parse(fs.readFileSync(LEGACY_CACHE_PATH, "utf8"));
		return {
			translations: new Map(Object.entries(cached.terms).map(([english, values]) => [english, new Set(values)])),
			errors: cached.fetchErrors || [],
		};
	}

	const translations = new Map();
	const errors = [];

	await Promise.all(files.map(async file => {
		try {
			const response = await fetch(`${LEGACY_BASE_URL}/${file}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const json = await response.json();

			const visit = value => {
				if (Array.isArray(value)) {
					value.forEach(visit);
					return;
				}
				if (!value || typeof value !== "object") return;

				for (const [englishKey, zhKey] of [["ENG_name", "name"], ["ENG_shortName", "shortName"]]) {
					const english = value[englishKey];
					const zh = value[zhKey];
					if (!isCandidateTerm(english) || typeof zh !== "string" || !/\p{Script=Han}/u.test(zh)) continue;
					const curr = translations.get(english) || new Set();
					curr.add(zh.trim());
					translations.set(english.trim(), curr);
				}

				Object.values(value).forEach(visit);
			};

			visit(json);
		} catch (error) {
			errors.push({file, error: error.message});
		}
	}));

	fs.writeFileSync(LEGACY_CACHE_PATH, `${JSON.stringify({
		source: LEGACY_BASE_URL,
		generatedAt: new Date().toISOString(),
		terms: Object.fromEntries([...translations.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([english, values]) => [english, [...values].sort()])),
		fetchErrors: errors,
	}, null, "\t")}\n`);

	return {translations, errors};
}

const files = fs.readdirSync(CLASS_DIR).filter(file => CLASS_FILE_RE.test(file)).sort();
fs.mkdirSync(OUTPUT_DIR, {recursive: true});
const coreGlossary = loadCoreGlossary();
const {translations: legacyTranslations, errors: legacyErrors} = await loadLegacyTranslations(files);
const parseErrors = [];
const occurrences = [];
const entityCounts = {
	class: 0,
	subclass: 0,
	classFeature: 0,
	subclassFeature: 0,
};

for (const file of files) {
	let json;
	try {
		json = JSON.parse(fs.readFileSync(path.join(CLASS_DIR, file), "utf8"));
	} catch (error) {
		parseErrors.push({file, error: error.message});
		continue;
	}
	for (const key of Object.keys(entityCounts)) entityCounts[key] += (json[key] || []).length;

	for (const [topLevelKey, category] of Object.entries(TOP_LEVEL_CATEGORIES)) {
		for (const [ix, entity] of (json[topLevelKey] || []).entries()) {
			const className = entity.className || (category === "class" ? entity.name : "");
			const subclassName = entity.subclassShortName || (category === "subclass" ? entity.shortName || entity.name : "");
			const base = {
				file: `data/class/${file}`,
				category,
				className,
				subclassName,
				source: entity.source || "",
				edition: getEdition(entity),
			};

			if (isCandidateTerm(entity.name)) occurrences.push({
				...base,
				english: entity.name.trim(),
				pointer: `/${topLevelKey}/${ix}/name`,
				context: `${category}: ${entity.name}`,
			});

			if (category === "class") {
				if (isCandidateTerm(entity.subclassTitle)) occurrences.push({
					...base,
					category: "class-label",
					english: entity.subclassTitle.trim(),
					pointer: `/${topLevelKey}/${ix}/subclassTitle`,
					context: `${entity.name} subclass title`,
				});

				(entity.optionalfeatureProgression || []).forEach((progression, progressionIx) => {
					if (!isCandidateTerm(progression.name)) return;
					occurrences.push({
						...base,
						category: "class-label",
						english: progression.name.trim(),
						pointer: `/${topLevelKey}/${ix}/optionalfeatureProgression/${progressionIx}/name`,
						context: `${entity.name} optional feature progression`,
					});
				});
			}

			if (!new Set(["class-feature", "subclass-feature"]).has(category)) continue;
			const visitNamedEntries = (value, pointer) => {
				if (Array.isArray(value)) {
					value.forEach((child, childIx) => visitNamedEntries(child, `${pointer}/${childIx}`));
					return;
				}
				if (!value || typeof value !== "object") return;
				if (value !== entity && isCandidateTerm(value.name)) occurrences.push({
					...base,
					category: "named-rule-block",
					english: value.name.trim(),
					pointer: `${pointer}/name`,
					context: `${entity.name}: nested named block`,
				});
				for (const [key, child] of Object.entries(value)) visitNamedEntries(child, `${pointer}/${toPointerSegment(key)}`);
			};
			visitNamedEntries(entity, `/${topLevelKey}/${ix}`);
		}
	}
}

const termsByKey = new Map();
for (const occurrence of occurrences) {
	const key = `${occurrence.category}\u0000${occurrence.english}`;
	const term = termsByKey.get(key) || {
		english: occurrence.english,
		category: occurrence.category,
		classes: new Set(),
		subclasses: new Set(),
		sources: new Set(),
		editions: new Set(),
		files: new Set(),
		occurrences: 0,
		firstPointer: occurrence.pointer,
		context: occurrence.context,
	};
	if (occurrence.className) term.classes.add(occurrence.className);
	if (occurrence.subclassName) term.subclasses.add(occurrence.subclassName);
	if (occurrence.source) term.sources.add(occurrence.source);
	if (occurrence.edition) term.editions.add(occurrence.edition);
	term.files.add(occurrence.file);
	term.occurrences++;
	termsByKey.set(key, term);
}

const terms = [...termsByKey.values()]
	.map(term => {
		const core = coreGlossary.get(term.english);
		const legacy = [...(legacyTranslations.get(term.english) || [])];
		let proposedZhTw = "";
		let alternativeZhTw = "";
		let status = "pending";
		let translationSource = "";
		let confidence = 0.5;
		let notes = "";

		if (core?.status === "approved" && core.zh) {
			proposedZhTw = core.zh;
			alternativeZhTw = core.alternative;
			status = "approved";
			translationSource = core.source;
			confidence = 1;
			notes = core.notes;
		} else if (legacy.length) {
			[proposedZhTw] = legacy;
			const alternatives = new Set([
				...legacy.slice(1),
				...(core?.zh ? [core.zh] : []),
				...(core?.alternative ? core.alternative.split(";").map(it => it.trim()).filter(Boolean) : []),
			]);
			alternatives.delete(proposedZhTw);
			alternativeZhTw = [...alternatives].join("; ");
			status = alternatives.size ? "conflict" : "proposed";
			translationSource = status === "conflict"
				? "5eclone.pingstudio.tw (preferred candidate); project glossary alternatives"
				: "5eclone.pingstudio.tw (legacy exact ENG_name match)";
			confidence = status === "conflict" ? 0.65 : 0.85;
			notes = status === "conflict"
				? "5eclone candidate is listed first; alternatives require user approval."
				: "";
		} else if (core?.zh) {
			proposedZhTw = core.zh;
			alternativeZhTw = core.alternative;
			status = core.status;
			translationSource = core.source;
			confidence = status === "conflict" ? 0.65 : 0.95;
			notes = core.notes;
		}

		return {...term, proposedZhTw, alternativeZhTw, status, translationSource, confidence, notes};
	})
	.sort((a, b) => a.category.localeCompare(b.category) || a.english.localeCompare(b.english));

const countBy = getter => Object.fromEntries([...terms.reduce((map, term) => {
	const key = getter(term);
	map.set(key, (map.get(key) || 0) + 1);
	return map;
}, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));

const fluffFiles = fs.readdirSync(CLASS_DIR).filter(file => /^fluff-class-[a-z0-9-]+\.json$/.test(file)).sort();
const fluffInventory = {files: fluffFiles.length, classFluff: 0, subclassFluff: 0, strings: 0, approximateEnglishWords: 0};
const countFluffText = value => {
	if (typeof value === "string") {
		fluffInventory.strings++;
		fluffInventory.approximateEnglishWords += value.split(/\s+/).filter(Boolean).length;
		return;
	}
	if (Array.isArray(value)) {
		value.forEach(countFluffText);
		return;
	}
	if (value && typeof value === "object") Object.values(value).forEach(countFluffText);
};
for (const file of fluffFiles) {
	try {
		const json = JSON.parse(fs.readFileSync(path.join(CLASS_DIR, file), "utf8"));
		fluffInventory.classFluff += (json.classFluff || []).length;
		fluffInventory.subclassFluff += (json.subclassFluff || []).length;
		countFluffText(json);
	} catch (error) {
		parseErrors.push({file, error: error.message});
	}
}

const manifest = {
	upstream: {
		repository: "5etools-mirror-3/5etools-src",
		tag: "v2.33.3",
		commit: "e5f3e77b303a92df10487207857200245e71957c",
	},
	legacyTermSource: LEGACY_BASE_URL,
	statistics: {
		filesScanned: files.length,
		entityCounts,
		fluffInventory,
		parseErrors: parseErrors.length,
		legacyFetchErrors: legacyErrors.length,
		termOccurrences: occurrences.length,
		uniqueCategoryTerms: terms.length,
		byCategory: countBy(term => term.category),
		proposed: terms.filter(term => term.status === "proposed").length,
		conflicts: terms.filter(term => term.status === "conflict").length,
		pending: terms.filter(term => term.status === "pending").length,
		lowConfidence: terms.filter(term => term.confidence < 0.8).length,
	},
	parseErrors,
	legacyErrors,
};

fs.mkdirSync(OUTPUT_DIR, {recursive: true});
fs.writeFileSync(path.join(OUTPUT_DIR, "class-term-manifest.json"), `${JSON.stringify(manifest, null, "\t")}\n`);

const headers = [
	"english", "category", "classes", "subclasses", "sources", "editions", "occurrences",
	"first_file", "first_json_pointer", "representative_context", "proposed_zh_tw",
	"alternative_zh_tw", "status", "translation_source", "confidence", "notes",
];
const rows = terms.map(term => [
	term.english,
	term.category,
	[...term.classes].sort().join("; "),
	[...term.subclasses].sort().join("; "),
	[...term.sources].sort().join("; "),
	[...term.editions].sort().join("; "),
	term.occurrences,
	[...term.files].sort()[0],
	term.firstPointer,
	term.context,
	term.proposedZhTw,
	term.alternativeZhTw,
	term.status,
	term.translationSource,
	term.confidence.toFixed(2),
	term.notes,
]);
fs.writeFileSync(
	path.join(OUTPUT_DIR, "class-terms.csv"),
	`${[headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`,
);

const reviewRows = rows.filter(row => ["pending", "conflict"].includes(row[12]) || Number(row[14]) < 0.8);
fs.writeFileSync(
	path.join(OUTPUT_DIR, "class-terms-need-review.csv"),
	`${[headers, ...reviewRows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`,
);

const approvalRows = rows.filter(row => row[1] === "class" || row[12] === "conflict");
fs.writeFileSync(
	path.join(OUTPUT_DIR, "class-approval-shortlist.csv"),
	`${[headers, ...approvalRows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`,
);

console.log(JSON.stringify(manifest.statistics, null, 2));
