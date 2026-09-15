"use strict";

(() => {
	class I18nZhTwUtilities {
		static FILES = new Set([
			"trapshazards.json", "objects.json", "decks.json", "tables.json", "generated/gendata-tables.json",
			"life.json", "encounters.json", "loot.json", "names.json", "monsterfeatures.json",
		]);
		static _cache = new Map();
		static async pApplyDataFile ({url, data}) {
			const path = `${url}`.split(/[?#]/u)[0];
			const match = /(?:^|\/)data\/(.+)$/u.exec(path);
			if (!match || !this.FILES.has(match[1])) return data;
			const file = match[1];
			if (!this._cache.has(file)) {
				const localeUrl = `${path.slice(0, path.lastIndexOf("data/"))}data/zh-TW/utility-pages/${file}?v=zh-tw-26`;
				this._cache.set(file, (async () => {
					const response = await fetch(localeUrl);
					if (!response.ok) throw new Error(`zh-TW utility data failed: ${file} (${response.status})`);
					const localized = await response.json();
					for (const [key, values] of Object.entries(data)) {
						if (key.startsWith("_") || !Array.isArray(values)) continue;
						if (!Array.isArray(localized[key]) || localized[key].length !== values.length) throw new Error(`zh-TW utility count mismatch: ${file}/${key}`);
						values.forEach((value, i) => {
							if (value?.name != null && (value.name !== localized[key][i].name || value.source !== localized[key][i].source)) throw new Error(`zh-TW utility identity mismatch: ${file}/${key}/${i}`);
						});
					}
					return localized;
				})());
			}
			// Each caller gets a fresh object: deck reference expansion, table
			// conversion, and generator state must not mutate the cached locale.
			return this._merge(data, JSON.parse(JSON.stringify(await this._cache.get(file))));
		}
		static _merge (raw, localized) {
			if (Array.isArray(localized)) return localized.map((value, i) => this._merge(raw?.[i], value));
			if (!localized || typeof localized !== "object") return localized;
			return Object.fromEntries(Object.entries({...raw, ...localized}).map(([key, value]) => [key, key in localized ? this._merge(raw?.[key], localized[key]) : value]));
		}
		static trapType (type) {
			const names = {MECH: "機械陷阱", MAG: "魔法陷阱", SMPL: "簡單陷阱", CMPX: "複雜陷阱", HAZ: "危害", WTH: "天氣", ENV: "環境危害", WLD: "荒野危害", GEN: "通用", EST: "異能風暴", TRP: "陷阱", HAUNT: "靈異陷阱"};
			return names[type] ? `${names[type]}（${Parser.TRAP_HAZARD_TYPE_TO_FULL[type]}）` : Parser._parse_aToB(Parser.TRAP_HAZARD_TYPE_TO_FULL, type);
		}
		static name (entity) { return globalThis.I18nZhTwContent?.getBilingualName(entity) || entity?._displayName || entity?.name || ""; }
		static t (text) { return globalThis.I18nZhTwUtilityMessages?.[text] ?? text; }
		static field (entity, key) { return entity?.[`_display${key[0].toUpperCase()}${key.slice(1)}`] ?? entity?.[key] ?? ""; }
		static tableName (entity) {
			const base = this.field(entity, "caption") || [entity.captionPrefix, this.name(entity), entity.captionSuffix, this.field(entity, "option")].filter(Boolean).join("：");
			return `${base}${entity.minlvl != null && entity.maxlvl != null ? `（等級 ${entity.minlvl}–${entity.maxlvl}）` : ""}`;
		}
	}
	globalThis.I18nZhTwUtilities = I18nZhTwUtilities;
})();
