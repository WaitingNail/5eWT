import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

// Regression guards for human-reviewed senses, not an automated semantic grader.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const review = read("translation/zh-TW/adventures/reviewed-contextual-semantics.json");
const groups = {cos: "cos", hotdq: "tyranny", rot: "tyranny", wdh: "wdh", vnotee: "vecna", veor: "vecna", oota: "oota"};
const get = (document, pointer) => pointer.split("/").reduce((value, key) => value?.[key], document);
const source = {}, translated = {}, overrides = {};
for (const book of review.books) {
	source[book] = read(`data/adventure/adventure-${book}.json`);
	translated[book] = read(`data/zh-TW/adventures/adventure-${book}.json`);
	const table = read(`translation/zh-TW/adventures/${groups[book]}/text-overrides.json`);
	overrides[book] = book === "cos" ? table : table[book];
}
const checked = new Set();
for (const record of review.siteNameCorrections) {
	const entry = read(record.file)[record.prop].find(it => it.ENG_name === record.english);
	assert.equal(entry?.name, record.zh_tw, `Linked NPC label regressed: ${record.english}`);
}
for (const record of [...review.corrections, ...review.positiveControls]) {
	const key = `${record.book}:${record.path}`;
	assert.ok(!checked.has(key), `Duplicate semantic guard: ${key}`);
	checked.add(key);
	assert.equal(get(source[record.book], record.path), record.english, `Source changed; re-review ${key}`);
	assert.equal(get(translated[record.book], record.path), record.zh_tw, `Reviewed sense regressed: ${key}`);
	if ("before" in record) {
		assert.notEqual(record.before, record.zh_tw, `No-op correction: ${key}`);
		assert.equal(overrides[record.book]?.[record.path]?.english, record.english, `Missing import source guard: ${key}`);
		assert.equal(overrides[record.book]?.[record.path]?.zh_tw, record.zh_tw, `Reimport would lose the correction: ${key}`);
	}
}
console.log(JSON.stringify({reviewedCorrections: review.corrections.length, positiveControls: review.positiveControls.length, books: review.books, sourceGuards: "passed", overrides: "passed", scope: "reviewed contextual senses only; not a full-book semantic certification"}));
