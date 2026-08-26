import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

import {compileSiteLocale, PATH_DATA, PATH_DATA_JS, PATH_SOURCE} from "./build-site-locale.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const source = JSON.parse(await fs.readFile(PATH_SOURCE, "utf8"));
const expected = compileSiteLocale(source);
const generatedJson = JSON.parse(await fs.readFile(PATH_DATA, "utf8"));

assert.deepEqual(generatedJson, expected, "data/zh-TW/site.json is stale; run build-site-locale.mjs");
assert.equal(generatedJson._meta.messageCount, Object.keys(generatedJson.messages).length);
assert.equal(generatedJson._meta.englishAliasCount, Object.keys(generatedJson.english).length);
assert.ok(generatedJson._meta.messageCount >= 350, "the first-stage catalog should retain broad shared-UI coverage");

delete globalThis.SITE_I18N_ZH_TW_DATA;
delete globalThis.SiteI18n;
delete globalThis.I18nZhTwSite;
await import(`${pathToFileURL(PATH_DATA_JS).href}?test=${Date.now()}`);
assert.deepEqual(globalThis.SITE_I18N_ZH_TW_DATA, generatedJson, "classic-script data and JSON outputs must match");

await import(`${pathToFileURL(path.join(ROOT, "js/zh-tw/site-i18n.js")).href}?test=${Date.now()}`);
assert.equal(typeof globalThis.SiteI18n, "function");
assert.ok(globalThis.I18nZhTwSite instanceof globalThis.SiteI18n);

const i18n = globalThis.I18nZhTwSite;
assert.equal(i18n.locale, "zh-TW");
assert.equal(i18n.fallbackLocale, "en");
assert.equal(i18n.t("common.search", "Search"), "搜尋");
assert.equal(i18n.tEnglish("Search"), "搜尋");
assert.equal(i18n.has("common.search"), true);
assert.equal(i18n.hasEnglish("Search"), true);

assert.equal(
	i18n.t("search.pagination", "Page {page}/{pages} ({count} results)", {page: 2, pages: 7, count: 123}),
	"第 2/7 頁（123 筆結果）",
);
assert.equal(
	i18n.t("search.resultsHidden", "...{count} more results were hidden. Refine your search!", {count: 9}),
	"……另有 9 筆結果已隱藏，請縮小搜尋範圍！",
);
assert.equal(i18n.t("filter.searchFor", "Filter/Search for {title}", {title: "來源"}), "篩選／搜尋：來源");
assert.equal(i18n.t("book.viewEntire", "View Entire {type}", {type: "書籍"}), "檢視完整書籍");
assert.equal(i18n.t("book.pageNumber", "Page {page}", {page: 42}), "第 42 頁");
assert.equal(i18n.t("book.downloadAsMarkdown", "Download {type} as Markdown", {type: "冒險"}), "將冒險下載為 Markdown");
assert.equal(i18n.t("book.pageNotFound", "Could not find page {page}!", {page: 999}), "找不到第 999 頁！");
assert.equal(i18n.t("brew.manageTitle", "Manage {type}", {type: "自製內容"}), "管理自製內容");
assert.equal(i18n.t("brew.findType", "Find {type}...", {type: "預發佈內容"}), "尋找預發佈內容……");
assert.equal(i18n.t("dice.inputPlaceholder", "{dice} or /help", {dice: "1d20+5"}), "1d20+5 或 /help");
assert.equal(i18n.tEnglish("{shown} of {total} entries", {shown: 8, total: 20}), "顯示 8／20 項");
assert.equal(i18n.tEnglish("View results in {@5etools search|search.html} page"), "在 {@5etools 搜尋|search.html}頁面檢視結果");
assert.equal(i18n.tEnglish("Two (book style)"), "兩欄（書籍樣式）");
assert.equal(i18n.tEnglish("Print columns:"), "列印欄數：");
assert.equal(i18n.tEnglish("Actions Book View"), "動作書籍檢視");
assert.equal(
	i18n.t("bookview.make-list", "If you wish to view multiple {namePlural}, please first make a list", {namePlural: "動作"}),
	"若要同時檢視多個動作，請先建立清單",
);
assert.equal(
	i18n.t("bookview.show-duplicates-help", "If enabled, each copy of a listed {nameSingular} will be displayed separately. This may be preferable when printing handouts.", {nameSingular: "變體規則"}),
	"啟用後，清單中每份變體規則都會分別顯示；列印講義時可能較合適。",
);
assert.equal(i18n.tEnglish("Popout"), "彈出視窗");
assert.equal(i18n.tEnglish("Source Data"), "原始資料");
assert.equal(i18n.tEnglish("Hide Search Bar and Entry List"), "隱藏搜尋列與項目清單");
assert.equal(i18n.tEnglish("Load Saved List"), "載入已儲存清單");
assert.equal(i18n.tEnglish("Moved to link!"), "已前往連結！");
assert.equal(
	i18n.t("list.keyboard-navigation-expand", " Press {navigationKeys} to navigate, and {expandHint} to expand.", {navigationKeys: "J/K", expandHint: "M"}),
	" 按 J/K 導覽，按 M 展開。",
);
assert.equal(i18n.t("export.image-title", "Image Export - {name}", {name: "攻擊"}), "圖片匯出－攻擊");

const [bookModeSource, listPageSource, listUtilSource, bookUtilSource, rendererSource] = await Promise.all([
	fs.readFile(path.join(ROOT, "js/utils.js"), "utf8"),
	fs.readFile(path.join(ROOT, "js/listpage.js"), "utf8"),
	fs.readFile(path.join(ROOT, "js/utils-list.js"), "utf8"),
	fs.readFile(path.join(ROOT, "js/bookutils.js"), "utf8"),
	fs.readFile(path.join(ROOT, "js/render.js"), "utf8"),
]);
assert.ok(bookModeSource.includes(`_getLocalizedText({english: "Two (book style)"})`));
assert.ok(bookModeSource.includes(`_getLocalizedText({english: this._pageTitle})`));
assert.match(listPageSource, /key: "bookview\.make-list"/u);
assert.match(listPageSource, /key: "bookview\.show-duplicates-help"/u);
assert.ok(listPageSource.includes(`UiUtil.getTranslatedText("Hide Search Bar and Entry List")`));
assert.ok(listPageSource.includes(`"list.keyboard-navigation-expand"`));
assert.ok(listPageSource.includes(`UiUtil.getTranslatedText("Source Data")`));
assert.ok(listUtilSource.includes(`UiUtil.getTranslatedText(comp._state.manager_loader_isExpanded ? "Collapse Preview" : "Expand Preview")`));
assert.ok(bookUtilSource.includes(`this._t("Copied link!")`));
assert.ok(rendererSource.includes(`this._t("Open as Popup Window")`));

const unsafeHotkey = `<img src=x onerror="alert(1)">&'`;
assert.equal(
	i18n.tHtml("common.hotkey-hint", "Press <kbd>{key}</kbd>.", {key: unsafeHotkey}),
	"按下 <kbd>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;</kbd>。",
);
assert.equal(
	i18n.t("common.hotkey-hint", "Press <kbd>{key}</kbd>.", {key: unsafeHotkey}),
	`按下 <kbd>${unsafeHotkey}</kbd>。`,
	"plain-text translation must not silently alter caller data",
);
assert.match(i18n.tEnglishHtml("Preload All <small>(5GB+)</small>"), /^全部預載 <small>.+<\/small>$/);

const logs = [];
const fallbackRuntime = new globalThis.SiteI18n({
	data: {
		_meta: {locale: "zh-TW", fallbackLocale: "en"},
		messages: {},
		english: {"Hello {name}": "test.hello"},
		fallbacks: {"test.hello": "Hello {name}"},
		htmlKeys: [],
	},
	isDev: true,
	logger: message => logs.push(message),
});

assert.equal(fallbackRuntime.t("test.hello", {name: "Ada"}), "Hello Ada", "known keys must fall back to catalog English");
assert.equal(fallbackRuntime.t("missing.key", "Fallback {value}", {value: 42}), "Fallback 42", "explicit English fallback must be supported");
assert.equal(fallbackRuntime.tEnglish("Hello {name}", {name: "Ada"}), "Hello Ada");
assert.equal(fallbackRuntime.tEnglish("Unknown {name}", {name: "Ada"}), "Unknown Ada");
assert.equal(fallbackRuntime.tEnglish("Unknown {name}", {name: "Grace"}), "Unknown Grace");
assert.deepEqual(
	fallbackRuntime.getMissingKeys(),
	["test.hello", "missing.key", "english:Unknown {name}"],
	"missing stable keys and English aliases should be recorded once in encounter order",
);
assert.equal(logs.length, 3, "development missing-key diagnostics should log once per missing token");
assert.ok(logs.every(message => message.startsWith("[zh-TW i18n] Missing translation:")));
fallbackRuntime.clearMissingKeys();
assert.deepEqual(fallbackRuntime.getMissingKeys(), []);
fallbackRuntime.configure({isDev: false});
assert.equal(fallbackRuntime.t("another.missing", "Safe fallback"), "Safe fallback");
assert.equal(logs.length, 3, "production mode should suppress missing-key console diagnostics");
assert.deepEqual(fallbackRuntime.getMissingKeys(), [], "production mode must not retain opportunistic dynamic misses");

const getPlaceholders = text => [...new Set([...text.matchAll(/\{([A-Za-z][A-Za-z0-9_.-]*)\}/g)].map(match => match[1]))].sort();
Object.entries(generatedJson.messages).forEach(([key, translated]) => {
	assert.equal(typeof translated, "string");
	assert.ok(translated.length > 0);
	assert.equal(typeof generatedJson.fallbacks[key], "string");
	assert.deepEqual(getPlaceholders(translated), getPlaceholders(generatedJson.fallbacks[key]), `${key} placeholder mismatch`);
	assert.equal(generatedJson.english[generatedJson.fallbacks[key]], key, `${key} English alias mismatch`);
});

generatedJson.htmlKeys.forEach(key => {
	assert.match(generatedJson.messages[key], /<\/?[a-z][^>]*>/i, `${key} should retain catalog HTML`);
	assert.doesNotMatch(generatedJson.messages[key], /<\s*script\b|\son[a-z]+\s*=|javascript\s*:/i, `${key} contains unsafe catalog HTML`);
});

console.log(`Site UI localization tests passed (${generatedJson._meta.messageCount} messages).`);
