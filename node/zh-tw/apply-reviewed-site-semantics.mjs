import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildSiteLocale} from "./build-site-locale.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const review = JSON.parse(fs.readFileSync(path.join(ROOT, "translation/zh-TW/reviewed-site-semantics.json"), "utf8"));
const get = (obj, pointer) => pointer.split("/").reduce((v, k) => v?.[k], obj);
const set = (obj, pointer, value) => { const parts = pointer.split("/"); const key = parts.pop(); get(obj, parts.join("/"))[key] = value; };
const nameTerms = new Map(Object.values(review.terms).flatMap(group => Object.entries(group)));
const SKIP = new Set(["_meta", "_copy", "en", "english", "fallbacks", "ENG_name", "ENG_shortName", "namePrefix", "nameSuffix", "reprintedAs", "additionalSpells", "conditionImmune"]);

export function normalizeText (text) {
	return text.replace(/\{@(condition|skill|action|variantrule) ([^{}]+)\}/gu, (full, type, payload) => {
		const parts = payload.split("|");
		const term = review.terms[type]?.[parts[0].toLowerCase()];
		if (!term || parts.length < 3 || ![term[0], ...term[1]].includes(parts[2])) return full;
		parts[2] = term[0];
		return `{@${type} ${parts.join("|")}}`;
	}).replaceAll("無力狀態", "失能狀態")
		.replaceAll("被擒狀態", "受擒狀態")
		.replaceAll("伏地狀態", "倒地狀態")
		.replaceAll("恐懼狀態", "恐慌狀態")
		.replaceAll("感知（感知）", "感知（察覺）");
}

export function normalizeTree (node) {
	if (typeof node === "string") return normalizeText(node);
	if (Array.isArray(node)) return node.map(normalizeTree);
	if (!node || typeof node !== "object") return node;
	// Canonical names and sources are kept in English backups/identity fields.
	const term = nameTerms.get(`${node.ENG_name || ""}`.toLowerCase());
	if (term && [term[0], ...term[1]].includes(node.name)) node.name = term[0];
	if (typeof node.en === "string" && typeof node["zh-TW"] === "string") {
		const term = nameTerms.get(node.en.toLowerCase());
		if (term && [term[0], ...term[1]].includes(node["zh-TW"])) node["zh-TW"] = term[0];
	}
	for (const key of Object.keys(node)) {
		if (SKIP.has(key) || key.startsWith("ENG_")) continue;
		const term = nameTerms.get(key.toLowerCase());
		if (term && typeof node[key] === "string" && [term[0], ...term[1]].includes(node[key])) node[key] = term[0];
		else node[key] = normalizeTree(node[key]);
	}
	return node;
}

function strings (node, out = new Set()) {
	if (typeof node === "string") out.add(node);
	else if (Array.isArray(node)) node.forEach(v => strings(v, out));
	else if (node && typeof node === "object") Object.values(node).forEach(v => strings(v, out));
	return out;
}

function filesIn (folder) {
	return fs.readdirSync(folder, {withFileTypes: true}).flatMap(entry => {
		if (entry.name === "canonical-v2.33.3") return [];
		const file = path.join(folder, entry.name);
		return entry.isDirectory() ? filesIn(file) : file.endsWith(".json") ? [file] : [];
	});
}

export async function applyReview () {
	const documents = new Map();
	const load = file => {
		if (!documents.has(file)) documents.set(file, JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")));
		return documents.get(file);
	};
	const sourceStrings = new Map();
	for (const record of review.corrections) {
		if (!sourceStrings.has(record.sourceFile)) sourceStrings.set(record.sourceFile, strings(load(record.sourceFile)));
		if (!sourceStrings.get(record.sourceFile).has(record.english)) throw new Error(`English changed; re-review ${record.file}:${record.path}`);
		const data = load(record.file), current = get(data, record.path);
		if (![record.before, record.after, normalizeText(record.after)].includes(current)) throw new Error(`Translation changed; re-review ${record.file}:${record.path}`);
		set(data, record.path, record.after);
	}
	let changedFiles = 0;
	for (const absolute of [...filesIn(path.join(ROOT, "data/zh-TW")), path.join(ROOT, "translation/zh-TW/site/messages.json")]) {
		const file = path.relative(ROOT, absolute);
		const original = fs.readFileSync(absolute, "utf8");
		const data = normalizeTree(load(file));
		if (JSON.stringify(JSON.parse(original)) === JSON.stringify(data)) continue;
		fs.writeFileSync(absolute, `${JSON.stringify(data, null, "\t")}\n`);
		++changedFiles;
	}
	// The shared runtime getters and interface labels use the same reviewed terms.
	const runtimeFile = path.join(ROOT, "js/zh-tw/content-i18n.js");
	let runtime = fs.readFileSync(runtimeFile, "utf8");
	for (const [key, [translation]] of Object.entries(review.terms.condition)) {
		const regex = new RegExp(`(\\b${key}: )"[^"\\n]+"`, "gu");
		runtime = runtime.replace(regex, `$1"${translation}"`);
	}
	fs.writeFileSync(runtimeFile, runtime);
	await buildSiteLocale();
	console.log(`Applied ${review.corrections.length} source-guarded reviewed corrections; normalized reviewed 2014/2024 terms in ${changedFiles} data files.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await applyReview();
}
