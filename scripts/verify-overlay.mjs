import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstreamRoot = path.join(projectRoot, "vendor", "5etools-src");
const required = [
  "classes.html",
  "actions.html",
	"conditionsdiseases.html",
	"variantrules.html",
	"quickreference.html",
	"spells.html",
	"data/zh-TW/class.json",
	"data/zh-TW/class/index.json",
	"data/zh-TW/site.json",
	"data/zh-TW/rules/index.json",
	"data/zh-TW/rules/actions.json",
	"data/zh-TW/rules/generated/bookref-quick.json",
	"data/zh-TW/spells/index.json",
	"data/zh-TW/spells/spells-phb.json",
	"data/zh-TW/spells/spells-xphb.json",
	"data/zh-TW/spells/fluff-spells-xphb.json",
	"js/zh-tw/class-i18n.js",
	"js/zh-tw/class-body-i18n.js",
	"js/zh-tw/site-i18n.js",
	"js/zh-tw/rules-i18n.js",
	"js/zh-tw/quick-reference-i18n.js",
	"js/zh-tw/content-i18n.js",
	"node/zh-tw/test-class-i18n.mjs",
	"node/zh-tw/test-class-body-i18n-full.mjs",
	"node/zh-tw/test-site-i18n.mjs",
	"node/zh-tw/test-rules-i18n.mjs",
	"node/zh-tw/test-quick-reference-i18n.mjs",
	"node/zh-tw/test-content-i18n.mjs",
	"node/zh-tw/validate-full-class-translations.mjs",
	"node/zh-tw/validate-core-rules.mjs",
	"node/zh-tw/validate-content-translations.mjs",
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(upstreamRoot, relativePath))) throw new Error(`Missing applied file: ${relativePath}`);
}

const runNode = (script, ...args) => execFileSync(process.execPath, [script, ...args], {cwd: upstreamRoot, stdio: "inherit"});
for (const script of [
  "js/classes.js",
  "js/render-class.js",
  "js/actions.js",
  "js/conditionsdiseases.js",
  "js/variantrules.js",
  "js/quickreference.js",
  "js/bookutils.js",
  "js/listpage.js",
  "js/render.js",
  "js/render-actions.js",
  "js/render-conditionsdiseases.js",
	"js/render-variantrules.js",
	"js/filter-spells.js",
	"js/render-spells.js",
	"js/spells.js",
	"js/utils.js",
	"js/utils-list.js",
	"js/utils-dataloader/utils-dataloader-dataloader.js",
  "js/zh-tw/class-i18n.js",
  "js/zh-tw/class-body-i18n.js",
	"js/zh-tw/site-i18n.js",
	"js/zh-tw/rules-i18n.js",
	"js/zh-tw/quick-reference-i18n.js",
	"js/zh-tw/content-i18n.js",
]) execFileSync(process.execPath, ["--check", script], {cwd: upstreamRoot, stdio: "inherit"});

runNode("node/zh-tw/validate-glossary.mjs");
runNode("node/zh-tw/test-class-i18n.mjs");
runNode("node/zh-tw/test-class-body-i18n.mjs");
runNode("node/zh-tw/test-class-body-i18n-full.mjs");
runNode("node/zh-tw/validate-full-class-translations.mjs");
runNode("node/zh-tw/apply-site-i18n-html.mjs", "--check");
runNode("node/zh-tw/test-site-i18n.mjs");
runNode("node/zh-tw/validate-core-rules.mjs");
runNode("node/zh-tw/test-rules-i18n.mjs");
runNode("node/zh-tw/test-quick-reference-i18n.mjs");
runNode("node/zh-tw/validate-content-translations.mjs");
runNode("node/zh-tw/test-content-i18n.mjs");
execFileSync("git", ["diff", "--check"], {cwd: upstreamRoot, stdio: "inherit"});
console.log("zh-TW interface, Class, core-rules, Quick Reference, and spells overlay verification passed.");
