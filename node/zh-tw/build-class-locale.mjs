import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const CLASS_TERMS_PATH = path.join(ROOT_DIR, "translation", "zh-TW", "classes", "generated", "class-terms.csv");
const UI_TERMS_PATH = path.join(ROOT_DIR, "translation", "zh-TW", "classes", "class-ui-glossary.csv");
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, "data", "zh-TW", "class.json");
const OUTPUT_MEMORY_PATH = path.join(ROOT_DIR, "translation", "zh-TW", "classes", "translation-memory.csv");

const CATEGORY_MAP = {
	"class": "class",
	"subclass": "subclass",
	"class-feature": "classFeature",
	"subclass-feature": "subclassFeature",
	"class-label": "classLabel",
	"named-rule-block": "namedRuleBlock",
};

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

function csvEscape (value) {
	const str = value == null ? "" : `${value}`;
	return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

function rowsToObjects (rows) {
	const [headers, ...dataRows] = rows;
	return dataRows.map(row => Object.fromEntries(headers.map((header, ix) => [header, row[ix] || ""])));
}

const locale = {
	_meta: {
		locale: "zh-TW",
		upstreamTag: "v2.33.3",
		approval: "User approved using discovered candidate terms, with later corrections allowed.",
		approvalDate: "2026-08-25",
		fallbackLocale: "en",
	},
	ui: {},
	terms: Object.fromEntries(Object.values(CATEGORY_MAP).map(category => [category, {}])),
};

const memory = [];
const seenMemory = new Set();

for (const row of rowsToObjects(parseCsv(fs.readFileSync(CLASS_TERMS_PATH, "utf8")))) {
	const targetCategory = CATEGORY_MAP[row.category];
	if (!targetCategory || !row.proposed_zh_tw) continue;
	if (locale.terms[targetCategory][row.english] && locale.terms[targetCategory][row.english] !== row.proposed_zh_tw) {
		throw new Error(`Conflicting locale term: ${targetCategory}/${row.english}`);
	}
	locale.terms[targetCategory][row.english] = row.proposed_zh_tw;

	const memoryKey = `${targetCategory}\u0000${row.english}`;
	if (seenMemory.has(memoryKey)) continue;
	seenMemory.add(memoryKey);
	memory.push({
		english: row.english,
		category: targetCategory,
		zhTw: row.proposed_zh_tw,
		alternativeZhTw: row.alternative_zh_tw,
		source: row.translation_source,
		status: "approved",
		lock: true,
		notes: row.status === "conflict" ? "User approved the first listed candidate; may revise later." : "",
	});
}

for (const row of rowsToObjects(parseCsv(fs.readFileSync(UI_TERMS_PATH, "utf8")))) {
	if (!row.proposed_zh_tw) continue;
	locale.ui[row.english] = row.proposed_zh_tw;
	const memoryKey = `ui\u0000${row.english}`;
	if (seenMemory.has(memoryKey)) continue;
	seenMemory.add(memoryKey);
	memory.push({
		english: row.english,
		category: "ui",
		zhTw: row.proposed_zh_tw,
		alternativeZhTw: row.alternative_zh_tw,
		source: row.source,
		status: "approved",
		lock: true,
		notes: "",
	});
}

for (const terms of Object.values(locale.terms)) {
	const sorted = Object.fromEntries(Object.entries(terms).sort(([a], [b]) => a.localeCompare(b)));
	Object.keys(terms).forEach(key => delete terms[key]);
	Object.assign(terms, sorted);
}
locale.ui = Object.fromEntries(Object.entries(locale.ui).sort(([a], [b]) => a.localeCompare(b)));
memory.sort((a, b) => a.category.localeCompare(b.category) || a.english.localeCompare(b.english));

fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), {recursive: true});
fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(locale, null, "\t")}\n`);

const memoryHeaders = ["english", "category", "zh_tw", "alternative_zh_tw", "source", "status", "lock", "notes"];
const memoryRows = memory.map(row => [
	row.english,
	row.category,
	row.zhTw,
	row.alternativeZhTw,
	row.source,
	row.status,
	row.lock,
	row.notes,
]);
fs.writeFileSync(
	OUTPUT_MEMORY_PATH,
	`${[memoryHeaders, ...memoryRows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`,
);

console.log(JSON.stringify({
	uiTerms: Object.keys(locale.ui).length,
	classTerms: Object.fromEntries(Object.entries(locale.terms).map(([category, terms]) => [category, Object.keys(terms).length])),
	lockedMemoryTerms: memory.length,
}, null, 2));
