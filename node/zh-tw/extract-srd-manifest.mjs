import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTPUT_DIR = path.join(ROOT_DIR, "translation", "zh-TW", "generated");

const EXCLUDED_PATH_PARTS = new Set(["generated"]);
const EXCLUDED_FILENAME_PREFIXES = ["foundry"];
const TRANSLATABLE_KEYS = new Set([
	"caption",
	"colLabels",
	"entries",
	"entry",
	"headerEntries",
	"items",
	"name",
	"reasons",
	"rows",
	"title",
]);

function getJsonFiles (dir) {
	const out = [];
	for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
		if (EXCLUDED_PATH_PARTS.has(ent.name)) continue;
		const abs = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			out.push(...getJsonFiles(abs));
			continue;
		}
		if (!ent.name.endsWith(".json")) continue;
		if (EXCLUDED_FILENAME_PREFIXES.some(prefix => ent.name.startsWith(prefix))) continue;
		out.push(abs);
	}
	return out.sort();
}

function toJsonPointerSegment (value) {
	return `${value}`.replaceAll("~", "~0").replaceAll("/", "~1");
}

function countTranslatableStrings (value, activeKey = null) {
	if (typeof value === "string") return TRANSLATABLE_KEYS.has(activeKey) ? 1 : 0;
	if (Array.isArray(value)) return value.reduce((total, it) => total + countTranslatableStrings(it, activeKey), 0);
	if (!value || typeof value !== "object") return 0;
	return Object.entries(value)
		.reduce((total, [key, child]) => total + countTranslatableStrings(child, key), 0);
}

function csvEscape (value) {
	const str = value == null ? "" : `${value}`;
	return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

const jsonFiles = getJsonFiles(DATA_DIR);
const entities = [];
const parseErrors = [];

for (const absFile of jsonFiles) {
	const relFile = path.relative(ROOT_DIR, absFile).split(path.sep).join("/");
	let json;
	try {
		json = JSON.parse(fs.readFileSync(absFile, "utf8"));
	} catch (error) {
		parseErrors.push({file: relFile, error: error.message});
		continue;
	}

	const visit = (value, {pointer = "", dataType = null} = {}) => {
		if (Array.isArray(value)) {
			value.forEach((it, ix) => visit(it, {pointer: `${pointer}/${ix}`, dataType}));
			return;
		}
		if (!value || typeof value !== "object") return;

		const hasSrd51 = Object.hasOwn(value, "srd") && Boolean(value.srd);
		const hasSrd52 = Object.hasOwn(value, "srd52") && Boolean(value.srd52);
		if (hasSrd51 || hasSrd52) {
			entities.push({
				file: relFile,
				pointer: pointer || "/",
				dataType: dataType || "unknown",
				name: typeof value.name === "string" ? value.name : "",
				source: typeof value.source === "string" ? value.source : "",
				page: Number.isFinite(value.page) ? value.page : "",
				srd51: hasSrd51,
				srd51Alias: typeof value.srd === "string" ? value.srd : "",
				srd52: hasSrd52,
				srd52Alias: typeof value.srd52 === "string" ? value.srd52 : "",
				translatableStringCount: countTranslatableStrings(value),
			});
		}

		for (const [key, child] of Object.entries(value)) {
			const nextType = Array.isArray(child) && child.some(it => it && typeof it === "object") ? key : dataType;
			visit(child, {pointer: `${pointer}/${toJsonPointerSegment(key)}`, dataType: nextType});
		}
	};

	visit(json);
}

const countBy = (getKey) => Object.fromEntries(
	[...entities.reduce((map, ent) => {
		const key = getKey(ent);
		map.set(key, (map.get(key) || 0) + 1);
		return map;
	}, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)),
);

const uniqueNames = new Map();
for (const ent of entities) {
	if (!ent.name) continue;
	const curr = uniqueNames.get(ent.name) || {
		english: ent.name,
		categories: new Set(),
		sources: new Set(),
		srd51: false,
		srd52: false,
	};
	curr.categories.add(ent.dataType);
	if (ent.source) curr.sources.add(ent.source);
	curr.srd51 ||= ent.srd51;
	curr.srd52 ||= ent.srd52;
	uniqueNames.set(ent.name, curr);
}

const manifest = {
	upstream: {
		repository: "5etools-mirror-3/5etools-src",
		tag: "v2.33.3",
		commit: "e5f3e77b303a92df10487207857200245e71957c",
	},
	licensePolicy: {
		srd51: "CC BY 4.0",
		srd52: "CC BY 4.0",
		includeOnlyExplicitSrdFlags: true,
		excludedDirectories: [...EXCLUDED_PATH_PARTS],
		excludedFilenamePrefixes: EXCLUDED_FILENAME_PREFIXES,
	},
	statistics: {
		jsonFilesScanned: jsonFiles.length,
		parseErrors: parseErrors.length,
		flaggedEntityOccurrences: entities.length,
		uniqueEnglishNames: uniqueNames.size,
		srd51Occurrences: entities.filter(it => it.srd51).length,
		srd52Occurrences: entities.filter(it => it.srd52).length,
		estimatedTranslatableStrings: entities.reduce((total, it) => total + it.translatableStringCount, 0),
		byDataType: countBy(it => it.dataType),
		byFile: countBy(it => it.file),
	},
	parseErrors,
};

fs.mkdirSync(OUTPUT_DIR, {recursive: true});
fs.writeFileSync(path.join(OUTPUT_DIR, "srd-manifest.json"), `${JSON.stringify(manifest, null, "\t")}\n`);

const entityHeaders = [
	"file", "json_pointer", "data_type", "name", "source", "page",
	"srd_5_1", "srd_5_1_alias", "srd_5_2", "srd_5_2_alias", "translatable_string_count",
];
const entityRows = entities.map(ent => [
	ent.file, ent.pointer, ent.dataType, ent.name, ent.source, ent.page,
	ent.srd51, ent.srd51Alias, ent.srd52, ent.srd52Alias, ent.translatableStringCount,
]);
fs.writeFileSync(
	path.join(OUTPUT_DIR, "srd-entity-index.csv"),
	`${[entityHeaders, ...entityRows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`,
);

const termHeaders = ["english", "category", "sources", "srd_5_1", "srd_5_2", "proposed_zh_tw", "status", "notes"];
const termRows = [...uniqueNames.values()]
	.sort((a, b) => a.english.localeCompare(b.english))
	.map(it => [
		it.english,
		[...it.categories].sort().join("; "),
		[...it.sources].sort().join("; "),
		it.srd51,
		it.srd52,
		"",
		"pending",
		"",
	]);
fs.writeFileSync(
	path.join(OUTPUT_DIR, "srd-entity-terms.csv"),
	`${[termHeaders, ...termRows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`,
);

console.log(JSON.stringify(manifest.statistics, null, 2));
