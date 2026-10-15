import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const classesSource = fs.readFileSync(path.join(ROOT, "js/classes.js"), "utf8");

const ixLoadRaw = classesSource.indexOf("DataUtil.class.loadRawJSON()");
const ixApplyBody = classesSource.indexOf("I18nZhTwClassBody.applyToData(rawData)");
const ixLoadDereferenced = classesSource.indexOf("DataUtil.class.loadJSON()", ixLoadRaw);
assert.ok(ixLoadRaw >= 0, "Class page must load raw Class data");
assert.ok(ixApplyBody > ixLoadRaw, "Class body translations must follow the raw-data load");
assert.ok(ixLoadDereferenced > ixApplyBody, "Class body translations must run before feature dereferencing");
assert.doesNotMatch(classesSource, /I18nZhTwClassBody\.applyToData\(data\)/u);

await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/render.js");

globalThis.VetoolsConfig = {get: () => "one"};

const displayEntry = Renderer.class.getDisplayNamedSubclassFeatureEntry({
	type: "entries",
	name: "戰鬥大師",
	ENG_name: "Battle Master",
	level: 3,
	entries: [
		{
			type: "entries",
			name: "戰鬥卓越",
			ENG_name: "Combat Superiority",
			level: 3,
			entries: [
				{
					type: "entries",
					name: "戰技",
					ENG_name: "Maneuvers",
					entries: ["已翻譯的能力內容。"],
				},
			],
		},
	],
}, {styleHint: "one"});

assert.equal(displayEntry._displayName, "戰鬥大師（Battle Master）");
assert.equal(displayEntry.entries[0]._displayName, "等級 3：戰鬥卓越（Combat Superiority）");
assert.equal(displayEntry.entries[0].entries[0]._displayName, "戰技（Maneuvers）");
assert.equal(displayEntry.entries[0].entries[0].entries[0], "已翻譯的能力內容。");

// Use the real JSON loader with filesystem transport. Sidecars include _copy
// metadata, which must not be treated as unresolved canonical entities.
await import("../../js/hist.js");
const {I18nZhTwClassBody} = await import("../../js/zh-tw/class-body-i18n.js");
const originalTransport = DataUtil._pLoad_pGetJson;
const originalVerifyMerged = DataUtil._verifyMerged;
try {
	DataUtil._pLoad_pGetJson = async ({url, id}) => DataUtil._loaded[id] = JSON.parse(fs.readFileSync(path.join(ROOT, url), "utf8"));
	DataUtil._verifyMerged = () => { throw new Error("Class translation sidecars entered the canonical merge pipeline"); };
	const sidecar = await I18nZhTwClassBody.pLoad();
	assert.ok(sidecar.subclass.some(sc => sc._copy), "Copy metadata should be retained as sidecar data");
	assert.ok(sidecar.subclass.some(sc => sc.name === "舞蹈學院"));
} finally {
	DataUtil._pLoad_pGetJson = originalTransport;
	DataUtil._verifyMerged = originalVerifyMerged;
}

console.log("Class page runtime regression tests: PASS");
console.log("Raw translations precede dereferencing; nested subclass feature names render bilingually.");
