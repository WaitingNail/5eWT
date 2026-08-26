import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(FILE), "../..");
const PATH_SITE_I18N = path.join(ROOT, "data/zh-TW/site.json");

const EXPECTED_PAGE_COUNT = 56;
const SEO_INDEX_PAGES = [
	"bestiary/index.html",
	"items/index.html",
	"spells/index.html",
];
const CANONICAL_ATTRIBUTES = [
	"data-sort",
	"data-sortby",
	"href",
	"id",
	"name",
	"onclick",
	"value",
];
const SKIP_TEXT_TAGS = new Set(["code", "pre", "script", "style", "template", "textarea"]);

const RE_SITE_I18N_SCRIPT = /^[\t ]*<script\b[^>]*\bsrc=(['"])\/?js\/zh-tw\/site-i18n(?:-data)?\.js\1[^>]*><\/script>[\t ]*(?:\r?\n)?/gimu;

function escapeRegexp (value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml (value) {
	return value
		.replace(/&(?:#39|apos);/giu, "'")
		.replace(/&#x27;/giu, "'")
		.replace(/&quot;/giu, "\"")
		.replace(/&nbsp;/giu, "\u00a0")
		.replace(/&lt;/giu, "<")
		.replace(/&gt;/giu, ">")
		.replace(/&amp;/giu, "&");
}

function escapeHtmlText (value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function escapeHtmlAttribute (value) {
	return escapeHtmlText(value)
		.replaceAll("\"", "&quot;")
		.replaceAll("'", "&#39;");
}

function getCanonicalAttributes (html) {
	return Object.fromEntries(
		CANONICAL_ATTRIBUTES.map(attribute => {
			const re = new RegExp(`\\b${escapeRegexp(attribute)}\\s*=\\s*(?:"[^"]*"|'[^']*')`, "giu");
			return [attribute, html.match(re) || []];
		}),
	);
}

function assertCanonicalAttributesUnchanged ({before, after, page}) {
	const beforeAttributes = getCanonicalAttributes(before);
	const afterAttributes = getCanonicalAttributes(after);
	CANONICAL_ATTRIBUTES.forEach(attribute => {
		if (JSON.stringify(beforeAttributes[attribute]) === JSON.stringify(afterAttributes[attribute])) return;
		throw new Error(`${page}: canonical attribute "${attribute}" changed during localization.`);
	});
}

function getTranslator (siteI18n) {
	const getTranslated = value => {
		const decoded = decodeHtml(value);
		const normalized = decoded.replace(/\s+/gu, " ").trim();
		const candidates = [
			value,
			decoded,
			normalized,
			normalized.replace(/"([^"]+)"/gu, "'$1'"),
		];

		for (const candidate of candidates) {
			const key = siteI18n.english[candidate];
			const translated = key == null ? null : siteI18n.messages[key];
			if (typeof translated === "string" && translated.length) return translated;
		}
		return null;
	};

	const translateText = rawText => {
		const match = /^(\s*)([\s\S]*?)(\s*)$/u.exec(rawText);
		if (!match?.[2]) return rawText;

		const [, leadingWhitespace, rawCore, trailingWhitespace] = match;
		const decodedCore = decodeHtml(rawCore).replace(/\s+/gu, " ").trim();

		const titleMatch = /^(.*?) - 5etools$/u.exec(decodedCore);
		if (titleMatch) {
			const translatedTitle = getTranslated(titleMatch[1]);
			if (translatedTitle) return `${leadingWhitespace}${escapeHtmlText(translatedTitle)} - 5etools${trailingWhitespace}`;
		}

		const translated = getTranslated(rawCore);
		if (translated) return `${leadingWhitespace}${escapeHtmlText(translated)}${trailingWhitespace}`;

		const prefixedMatch = /^(&\s+)(.+)$/u.exec(decodedCore);
		if (prefixedMatch) {
			const translatedRest = getTranslated(prefixedMatch[2]);
			if (translatedRest) return `${leadingWhitespace}&amp; ${escapeHtmlText(translatedRest)}${trailingWhitespace}`;
		}

		return rawText;
	};

	const translateAttributeValue = rawValue => {
		const translated = getTranslated(rawValue);
		return translated == null ? rawValue : escapeHtmlAttribute(translated);
	};

	return {translateText, translateAttributeValue, getTranslated};
}

function getTagEnd (html, start) {
	if (html.startsWith("<!--", start)) {
		const endComment = html.indexOf("-->", start + 4);
		return endComment < 0 ? html.length : endComment + 3;
	}

	let quote = null;
	for (let i = start + 1; i < html.length; ++i) {
		const char = html[i];
		if (quote) {
			if (char === quote) quote = null;
			continue;
		}
		if (char === "\"" || char === "'") {
			quote = char;
			continue;
		}
		if (char === ">") return i + 1;
	}
	return html.length;
}

function translateTagAttributes (tag, {translateAttributeValue}) {
	if (/^<\s*(?:!|\/)/u.test(tag)) return tag;

	let out = tag.replace(
		/\b(title|placeholder|aria-label)\s*=\s*(['"])([\s\S]*?)\2/giu,
		(full, attribute, quote, value) => `${attribute}=${quote}${translateAttributeValue(value)}${quote}`,
	);

	if (!/^<\s*meta\b/iu.test(out) || !/\bname\s*=\s*(['"])description\1/iu.test(out)) return out;
	return out.replace(
		/\bcontent\s*=\s*(['"])([\s\S]*?)\1/iu,
		(full, quote, value) => `content=${quote}${translateAttributeValue(value)}${quote}`,
	);
}

function translateHtml ({html, translator}) {
	let out = "";
	let cursor = 0;
	let skipTag = null;

	while (cursor < html.length) {
		if (skipTag) {
			const closeStart = html.toLowerCase().indexOf(`</${skipTag}`, cursor);
			if (closeStart < 0) return `${out}${html.slice(cursor)}`;
			const closeEnd = getTagEnd(html, closeStart);
			out += html.slice(cursor, closeEnd);
			cursor = closeEnd;
			skipTag = null;
			continue;
		}

		const tagStart = html.indexOf("<", cursor);
		if (tagStart < 0) return `${out}${translator.translateText(html.slice(cursor))}`;

		out += translator.translateText(html.slice(cursor, tagStart));
		const tagEnd = getTagEnd(html, tagStart);
		const tag = html.slice(tagStart, tagEnd);
		out += translateTagAttributes(tag, translator);

		const tagName = /^<\s*([a-z][\w:-]*)\b/iu.exec(tag)?.[1]?.toLowerCase();
		if (tagName && SKIP_TEXT_TAGS.has(tagName) && !/\/\s*>$/u.test(tag)) skipTag = tagName;
		cursor = tagEnd;
	}

	return out;
}

function setDocumentLanguage (html, page) {
	let isFound = false;
	const out = html.replace(/<html\b[^>]*>/iu, tag => {
		isFound = true;
		if (/\blang\s*=\s*(['"])[^'"]*\1/iu.test(tag)) return tag.replace(/\blang\s*=\s*(['"])[^'"]*\1/iu, "lang=\"zh-Hant-TW\"");
		return tag.replace(/^<html\b/iu, "<html lang=\"zh-Hant-TW\"");
	});
	if (!isFound) throw new Error(`${page}: no <html> element found.`);
	return out;
}

function injectLocaleScripts ({html, isSeo, page}) {
	const withoutLocaleScripts = html.replace(RE_SITE_I18N_SCRIPT, "");
	const srcPrefix = isSeo ? "/" : "";
	const indent = isSeo ? "" : "\t";
	const scriptBlock = [
		`${indent}<script type="text/javascript" src="${srcPrefix}js/zh-tw/site-i18n-data.js"></script>`,
		`${indent}<script type="text/javascript" src="${srcPrefix}js/zh-tw/site-i18n.js"></script>`,
	].join("\n");

	const anchor = isSeo
		? `<script type="module" defer src="/js/styleswitch.js"></script>`
		: `<script type="text/javascript" src="sw-injector.js"></script>`;
	if (!withoutLocaleScripts.includes(anchor)) throw new Error(`${page}: locale-script injection anchor not found.`);

	return isSeo
		? withoutLocaleScripts.replace(anchor, `${scriptBlock}\n${anchor}`)
		: withoutLocaleScripts.replace(anchor, `${anchor}\n${scriptBlock}`);
}

function localizeRedirectShell ({html, translator}) {
	return html.replace(
		/Click\s+<a href="([^"]+)">here<\/a>\s+to be redirected to\s+([^<]+)\./u,
		(full, href, destination) => {
			const redirecting = translator.getTranslated("Redirecting to") || "Redirecting to";
			const continueText = translator.getTranslated("Continue") || "Continue";
			const destinationTranslated = translator.getTranslated(destination.trim()) || destination.trim();
			return `${escapeHtmlText(redirecting)} ${escapeHtmlText(destinationTranslated)}. <a href="${href}">${escapeHtmlText(continueText)}</a>`;
		},
	);
}

function transformPage ({html, page, isSeo, translator}) {
	let out = setDocumentLanguage(html, page);
	out = injectLocaleScripts({html: out, isSeo, page});
	out = localizeRedirectShell({html: out, translator});
	out = translateHtml({html: out, translator});
	assertCanonicalAttributesUnchanged({before: html, after: out, page});
	return out;
}

function countOccurrences (value, needle) {
	let count = 0;
	let cursor = 0;
	while ((cursor = value.indexOf(needle, cursor)) >= 0) {
		++count;
		cursor += needle.length;
	}
	return count;
}

function validatePage ({html, page, isSeo}) {
	if (!/<html\b[^>]*\blang="zh-Hant-TW"[^>]*>/iu.test(html)) throw new Error(`${page}: expected lang="zh-Hant-TW".`);

	const srcPrefix = isSeo ? "/" : "";
	const dataSrc = `${srcPrefix}js/zh-tw/site-i18n-data.js`;
	const runtimeSrc = `${srcPrefix}js/zh-tw/site-i18n.js`;
	if (countOccurrences(html, `src="${dataSrc}"`) !== 1) throw new Error(`${page}: expected exactly one ${dataSrc} script.`);
	if (countOccurrences(html, `src="${runtimeSrc}"`) !== 1) throw new Error(`${page}: expected exactly one ${runtimeSrc} script.`);
	if (html.indexOf(`src="${dataSrc}"`) > html.indexOf(`src="${runtimeSrc}"`)) throw new Error(`${page}: locale runtime loads before locale data.`);

	const navigationSrc = `${srcPrefix}js/navigation.js`;
	const ixNavigation = html.indexOf(`src="${navigationSrc}"`);
	if (ixNavigation >= 0 && html.indexOf(`src="${runtimeSrc}"`) > ixNavigation) throw new Error(`${page}: navigation loads before locale runtime.`);
}

async function getPagePaths () {
	const rootPages = (await fs.readdir(ROOT, {withFileTypes: true}))
		.filter(entry => entry.isFile() && entry.name.endsWith(".html"))
		.map(entry => entry.name)
		.sort();
	const nestedPages = [];
	for (const page of SEO_INDEX_PAGES) {
		await fs.access(path.join(ROOT, page));
		nestedPages.push(page);
	}

	const pages = [...rootPages, ...nestedPages];
	if (pages.length !== EXPECTED_PAGE_COUNT) throw new Error(`Expected ${EXPECTED_PAGE_COUNT} generated HTML pages, found ${pages.length}.`);
	return pages;
}

async function main () {
	const isCheck = process.argv.includes("--check");
	const siteI18n = JSON.parse(await fs.readFile(PATH_SITE_I18N, "utf8"));
	const translator = getTranslator(siteI18n);
	const pages = await getPagePaths();
	const stalePages = [];
	let changedCount = 0;

	for (const page of pages) {
		const pagePath = path.join(ROOT, page);
		const html = await fs.readFile(pagePath, "utf8");
		const transformed = transformPage({html, page, isSeo: page.includes("/"), translator});
		validatePage({html: transformed, page, isSeo: page.includes("/")});

		if (transformed === html) continue;
		++changedCount;
		if (isCheck) stalePages.push(page);
		else await fs.writeFile(pagePath, transformed, "utf8");
	}

	if (stalePages.length) throw new Error(`${stalePages.length} generated HTML pages are stale:\n${stalePages.map(page => `\t${page}`).join("\n")}`);
	console.log(`${isCheck ? "Verified" : "Localized"} ${pages.length}/${EXPECTED_PAGE_COUNT} generated HTML pages (${changedCount} changed).`);
}

main().catch(error => {
	console.error(error instanceof Error ? error.stack : error);
	process.exitCode = 1;
});
