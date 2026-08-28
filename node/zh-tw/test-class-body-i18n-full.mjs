import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {I18nZhTwClassBody} from "../../js/zh-tw/class-body-i18n.js";

globalThis.Renderer = {get: () => ({baseUrl: ""})};
globalThis.DataUtil = {loadJSON: async url => JSON.parse(await fs.readFile(url, "utf8"))};

const sidecar = await I18nZhTwClassBody.pLoad();
const classIndex = JSON.parse(await fs.readFile("data/class/index.json", "utf8"));
const classFiles = await Promise.all(
	Object.values(classIndex)
		.map(file => fs.readFile(`data/class/${file}`, "utf8").then(JSON.parse)),
);
const data = {class: [], subclass: [], classFeature: [], subclassFeature: []};
classFiles.forEach(json => Object.keys(data).forEach(category => data[category].push(...(json[category] || []))));

const getIdentitySnapshot = () => JSON.stringify({
	class: data.class.map(it => [it.name, it.source, it.classFeatures]),
	subclass: data.subclass.map(it => [it.name, it.shortName, it.source, it.className, it.classSource, it.subclassFeatures]),
	classFeature: data.classFeature.map(it => [it.name, it.source, it.className, it.classSource, it.level]),
	subclassFeature: data.subclassFeature.map(it => [it.name, it.source, it.className, it.classSource, it.subclassShortName, it.subclassSource, it.level]),
});
const identityBefore = getIdentitySnapshot();
const bodyReport = I18nZhTwClassBody.applyToData(data, {sidecar, isStrict: true});
const expectedBodyRecords = ["class", "subclass", "classFeature", "subclassFeature"]
	.map(category => sidecar[category].length)
	.reduce((a, b) => a + b, 0);

assert.equal(bodyReport.matchedRecords, expectedBodyRecords);
assert.equal(bodyReport.matchedEntities, expectedBodyRecords);
assert.equal(bodyReport.duplicateUids.length, 0);
assert.equal(bodyReport.missingEntityUids.length, 0);
assert.equal(bodyReport.skippedFields.length, 0);
assert.equal(getIdentitySnapshot(), identityBefore, "Body translation must preserve every canonical identity/reference field");

const fluffIndex = JSON.parse(await fs.readFile("data/class/fluff-index.json", "utf8"));
const fluffFiles = await Promise.all(
	Object.values(fluffIndex)
		.map(file => fs.readFile(`data/class/${file}`, "utf8").then(JSON.parse)),
);
let fluffMatched = 0;
let fluffApplied = 0;
for (const json of fluffFiles) {
	for (const fluff of json.classFluff || []) {
		const owner = {name: fluff.name, source: fluff.source, classFeatures: []};
		const identityBeforeFluff = {name: fluff.name, source: fluff.source, images: structuredClone(fluff.images)};
		const report = I18nZhTwClassBody.applyToFluff(fluff, {entity: owner, category: "classFluff", sidecar, isStrict: true});
		fluffMatched += report.matchedRecords;
		fluffApplied += report.appliedFields;
		assert.equal(fluff.name, identityBeforeFluff.name);
		assert.equal(fluff.source, identityBeforeFluff.source);
		assert.deepEqual(fluff.images, identityBeforeFluff.images);
	}

	for (const fluff of json.subclassFluff || []) {
		const owner = {
			name: fluff.name,
			shortName: fluff.shortName,
			source: fluff.source,
			className: fluff.className,
			classSource: fluff.classSource,
			subclassFeatures: [],
		};
		const identityBeforeFluff = {
			name: fluff.name,
			shortName: fluff.shortName,
			source: fluff.source,
			className: fluff.className,
			classSource: fluff.classSource,
			images: structuredClone(fluff.images),
		};
		const report = I18nZhTwClassBody.applyToFluff(fluff, {entity: owner, category: "subclassFluff", sidecar, isStrict: true});
		fluffMatched += report.matchedRecords;
		fluffApplied += report.appliedFields;
		assert.equal(fluff.name, identityBeforeFluff.name);
		assert.equal(fluff.shortName, identityBeforeFluff.shortName);
		assert.equal(fluff.source, identityBeforeFluff.source);
		assert.equal(fluff.className, identityBeforeFluff.className);
		assert.equal(fluff.classSource, identityBeforeFluff.classSource);
		assert.deepEqual(fluff.images, identityBeforeFluff.images);
	}
}

assert.equal(fluffMatched, sidecar.classFluff.length + sidecar.subclassFluff.length);

console.log(JSON.stringify({
	status: "ok",
	bodyRecords: expectedBodyRecords,
	bodyAppliedFields: bodyReport.appliedFields,
	fluffRecords: fluffMatched,
	fluffAppliedFields: fluffApplied,
	identityChanges: 0,
}, null, 2));
