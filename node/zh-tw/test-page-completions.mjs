import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {I18nZhTwRules} from "../../js/zh-tw/rules-i18n.js";
import {I18nZhTwClassBody} from "../../js/zh-tw/class-body-i18n.js";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const manifest = read("translation/zh-TW/reviewed-page-completions.json");
const records = manifest.files.flatMap(read);
const han = text => /\p{Script=Han}/u.test(text);
const get = (obj, ptr) => ptr.split("/").reduce((v, k) => v?.[k], obj);
await import("../../js/parser.js");
await import("../../js/utils.js");
await import("../../js/utils-ui.js");
await import("../../js/zh-tw/content-i18n.js");
await import("../../js/zh-tw/utility-pages-i18n.js");
await import("../../js/render.js");
const I = I18nZhTwContent;
// Exercise the same field overlay as the live page, not only the stored translation.
const recipes = await I.pApplyDataFile({file: "recipes.json", data: read("data/recipes.json"), fnLoad: async () => read("data/zh-TW/craft-pages/recipes.json")});
let recipeStrings = 0;
for (const rec of records.filter(r => r.file === "data/zh-TW/craft-pages/recipes.json")) {
 if (rec.path.includes("/images/")) continue;
 const value = get(recipes, rec.path.endsWith("/name") ? rec.path.replace(/\/name$/u, "/_displayName") : rec.path);
 assert.ok(han(value || ""), `Recipe field still falls back to English: ${rec.path}`);
 ++recipeStrings;
 const templates = str => [...str.matchAll(/\{=([^{}]+)\}/gu)].map(m => m[1]).sort();
 assert.deepEqual(templates(rec.after), templates(rec.english), `Recipe quantity variables changed: ${rec.path}`);
}
const conditions = await I18nZhTwRules.pApplyToData(read("data/conditionsdiseases.json"), {filenames: ["conditionsdiseases.json"], fnLoad: async () => read("data/zh-TW/rules/conditionsdiseases.json")});
assert.equal(conditions.condition.length + conditions.disease.length + conditions.status.length, 64);
assert.match(conditions.status.find(e => e.name === "Surprised" && e.source === "XPHB").entries[0], /Initiative\|XPHB\|先攻.*Disadvantage\|XPHB\|劣勢/u);
assert.match(conditions.condition.find(e => e.name === "Invisible" && e.source === "XPHB").entries[1].entries[0].entries[0], /處於隱形狀態/u);
assert.match(conditions.condition.find(e => e.name === "Restrained" && e.source === "XPHB").entries[1].entries[2].entries[0], /Saving Throw\|XPHB\|豁免檢定.*Disadvantage\|XPHB\|劣勢/u);
assert.match(conditions.disease.find(e => e.name === "Sewer Plague" && e.source === "DMG").entries[4], /^若豁免成功/u);
// Class fluff has a separate adapter. Its image title must reach the rendered object,
// while the URL and credit remain exactly the canonical values.
let classCaptions = 0;
for (const file of new Set(records.filter(r => r.file.startsWith("data/zh-TW/class/")).map(r => r.file))) {
 const source = read(file.replace("/zh-TW", ""));
 const sidecar = read(file);
 for (const prop of ["classFluff", "subclassFluff"]) for (const ent of source[prop] || []) {
  const translated = structuredClone(ent);
  const owner = prop === "subclassFluff" ? {...ent, shortName: ent.name, __prop: "subclass"} : {...ent, __prop: "class"};
  const report = I18nZhTwClassBody.applyToFluff(translated, {entity: owner, category: prop, sidecar});
  assert.equal(report.skippedFields.length, 0, JSON.stringify(report.skippedFields));
  for (const [i, image] of (ent.images || []).entries()) {
   assert.deepEqual(translated.images[i].href, image.href);
   assert.deepEqual(translated.images[i].credit, image.credit);
   if (translated.images[i].title !== image.title) { assert.ok(han(translated.images[i].title)); ++classCaptions; }
  }
 }
}
assert.ok(classCaptions >= 18, `Class image captions were not applied: ${classCaptions}`);
// Newly added display fields must never replace canonical spread names or outcome IDs.
globalThis.fetch = async url => ({ok: true, json: async () => read(url.split("?")[0])});
const canonicalDecks = read("data/decks.json");
const decks = await I18nZhTwUtilities.pApplyDataFile({url: "data/decks.json", data: canonicalDecks});
let spreads = 0;
for (const [i, deck] of canonicalDecks.deck.entries()) for (const [j, spread] of (deck.spreads || []).entries()) {
 const localized = decks.deck[i].spreads[j];
 assert.equal(localized.name, spread.name);
 assert.ok(han(I18nZhTwUtilities.name(localized)));
 assert.deepEqual(localized.outcomes, spread.outcomes);
 for (const [k, position] of (spread.positions || []).entries()) {
  assert.equal(localized.positions[k].name, position.name);
  assert.deepEqual(localized.positions[k].outcomes, position.outcomes);
  assert.deepEqual(localized.positions[k].suits, position.suits);
  if (position.name) assert.ok(han(I18nZhTwUtilities.name(localized.positions[k])));
 }
 ++spreads;
}
const feats = await I.pApplyDataFile({file: "feats.json", data: read("data/feats.json"), fnLoad: async () => read("data/zh-TW/character-options/feats.json")});
assert.ok(han(feats.feat[26].prerequisite[0].otherSummary.entry));
assert.ok(han(feats.feat[225].ability[0].choose.entry));
assert.deepEqual(feats.feat[225].ability[0].choose.from, read("data/feats.json").feat[225].ability[0].choose.from);
console.log(JSON.stringify({completionRecords: records.length, runtimeRecipeFields: recipeStrings, conditionDiseaseStatusEntities: 64, classCaptions, spreads, canonicalIdentitiesAndQuantityTemplates: "passed"}));
