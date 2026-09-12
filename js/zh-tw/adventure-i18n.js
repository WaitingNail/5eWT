import {I18nZhTwQuickReference} from "./quick-reference-i18n.js";

/** Adventure display adapter. Canonical headings/IDs remain usable in old URLs. */
export class I18nZhTwAdventure {
	static _loadPromises = new Map();
	static _supportedBooks = new Set(["cos", "hotdq", "rot"]);
	static _visibleKeys = new Set([
		"name", "caption", "title", "label", "by", "text", "quote", "author",
		"entries", "entry", "items", "footnotes", "headerEntries", "footerEntries",
		"colLabels", "rowLabels", "rows", "row", "tables", "default", "columns", "images",
	]);

	static async pLoad ({bookId = "cos", fnLoad = null} = {}) {
		bookId = `${bookId}`.toLowerCase();
		if (!this._supportedBooks.has(bookId)) return null;
		const url = `${globalThis.Renderer?.get?.().baseUrl || ""}data/zh-TW/adventures/adventure-${bookId}.json`;
		const load = async () => {
			try {
				if (fnLoad) return await fnLoad({url});
				const response = await fetch(url);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return await response.json();
			} catch (error) {
				console.warn(`[zh-TW ${bookId}] Translation unavailable; using English.`, error);
				return null;
			}
		};
		if (fnLoad) return load();
		if (!this._loadPromises.has(bookId)) this._loadPromises.set(bookId, load());
		return this._loadPromises.get(bookId);
	}

	static async pGetView ({bookId, canonical, index, fnLoad = null}) {
		bookId = `${bookId}`.toLowerCase();
		if (!this._supportedBooks.has(bookId) || index?.id?.toLowerCase() !== bookId) return null;
		const localized = await this.pLoad({bookId, fnLoad});
		if (!localized) return null;
		try {
			return this.createLocalizedView({canonical, localized, index});
		} catch (error) {
			console.warn(`[zh-TW ${bookId}] Translation does not match this source; using English.`, error);
			return null;
		}
	}

	static createLocalizedView ({canonical, localized, index}) {
		if (localized?._meta?.upstreamTag !== "v2.33.3" || localized?.adventure?.id !== index.id) {
			throw new Error("Adventure translation identity/version mismatch");
		}
		const displayByCanonical = new Map();
		const topCanonicalByDisplay = new Map();
		const clean = value => `${value}`.trim().toLowerCase();
		const bilingual = (en, zh) => !zh || en === zh ? en : `${zh}（${en}）`;
		const register = (en, zh) => {
			if (!en || !zh || en === zh) return;
			const key = clean(en);
			const prev = displayByCanonical.get(key);
			// Repeated generic headings use the same display label throughout.
			if (!prev) displayByCanonical.set(key, {canonical: en, display: bilingual(en, zh)});
			topCanonicalByDisplay.set(clean(zh), en);
		};
		const overlay = (en, zh, path) => {
			if (typeof en === "string") {
				if (typeof zh !== "string") throw new Error(`Missing string: ${path}`);
				return zh;
			}
			if (Array.isArray(en)) {
				if (!Array.isArray(zh) || en.length !== zh.length) throw new Error(`Array mismatch: ${path}`);
				return en.map((child, ix) => overlay(child, zh[ix], `${path}/${ix}`));
			}
			if (!en || typeof en !== "object") return en;
			if (!zh || typeof zh !== "object") throw new Error(`Missing object: ${path}`);
			if (en.id !== zh.id || en.type !== zh.type) throw new Error(`ID/type mismatch: ${path}`);
			const out = structuredClone(en);
			for (const [key, value] of Object.entries(en)) {
				if (!this._visibleKeys.has(key)) continue;
				if (key === "name") {
					if (zh.ENG_name !== value) throw new Error(`Heading mismatch: ${path}`);
					register(value, zh.name);
					out._displayName = bilingual(value, zh.name);
					out.ENG_name = value;
					// List-item labels are not heading/hash targets.
					if (["item", "itemSub"].includes(en.type)) {
						out._canonicalName = value;
						out.name = out._displayName;
					}
				} else if (key === "caption") {
					register(value, zh.caption);
					out._displayCaption = bilingual(value, zh.caption);
				} else {
					out[key] = overlay(value, zh[key], `${path}/${key}`);
				}
			}
			return out;
		};
		const data = overlay(canonical.data, localized.data, "data");
		if (index.contents.length !== localized.adventure.contents.length) throw new Error("Chapter index mismatch");
		const displayIndex = structuredClone(index);
		displayIndex.ENG_name = index.name;
		displayIndex.name = bilingual(index.name, localized.adventure.name);
		displayIndex.contents = index.contents.map((chapter, ix) => {
			const zh = localized.adventure.contents[ix];
			if (zh.ENG_name !== chapter.name) throw new Error(`Index heading mismatch: ${ix}`);
			register(chapter.name, zh.name);
			return {
				...structuredClone(chapter),
				name: bilingual(chapter.name, zh.name),
				...(chapter.headers ? {headers: chapter.headers.map(header => {
					const name = header.header || header;
					return {...(typeof header === "object" ? header : {header}), displayName: displayByCanonical.get(clean(name))?.display || name};
				})} : {}),
			};
		});
		return {
			dataDocument: {...structuredClone(canonical), data},
			index: displayIndex,
			adapter: I18nZhTwQuickReference._getAdapter({canonicalData: canonical.data, displayByCanonical, topCanonicalByDisplay}),
		};
	}
}
