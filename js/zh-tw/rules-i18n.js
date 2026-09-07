/**
 * Safe Traditional Chinese display overlay for core rules data.
 *
 * The English entity remains the canonical source of identity. In particular,
 * `name`, `source`, `page`, UIDs, hashes, references, and filter values are not
 * replaced. Localized names are exposed as `_displayName`, while localized
 * prose is applied to a clone which retains a non-enumerable pointer to its
 * canonical entity.
 */
export class I18nZhTwRules {
	static _FILE_TO_PROPS = new Map([
		["actions.json", new Set(["action"])],
		["conditionsdiseases.json", new Set(["condition", "disease", "status"])],
		["fluff-conditionsdiseases.json", new Set(["conditionFluff", "diseaseFluff", "statusFluff"])],
		["skills.json", new Set(["skill"])],
		["senses.json", new Set(["sense"])],
		["variantrules.json", new Set(["variantrule"])],
		["generated/gendata-variantrules.json", new Set(["variantrule"])],
	]);

	static _PROP_TO_FILES = (() => {
		const out = new Map();
		for (const [file, props] of this._FILE_TO_PROPS) {
			for (const prop of props) {
				if (!out.has(prop)) out.set(prop, []);
				out.get(prop).push(file);
			}
		}
		return out;
	})();

	static _DISPLAY_CONTAINER_KEYS = new Set([
		"entries",
		"entry",
		"items",
		"caption",
		"colLabels",
		"rows",
		"row",
		"footnotes",
		"columns",
		"name",
		"title",
		"by",
		"credit",
		"text",
	]);

	static _pFileCache = new Map();
	static _displayTypeByCanonical = new Map([
		["condition", "狀態"],
		["disease", "疾病"],
		["status", "其他狀態"],
		["Magical Contagion", "魔法傳染病"],
	]);

	static _RULE_TYPE_TO_DISPLAY = {
		C: "核心",
		O: "選用",
		P: "試玩",
		V: "變體",
		VO: "變體選用",
		VV: "變體規則",
		U: "未知",
	};

	static _ACTION_TIME_UNIT_TO_DISPLAY = {
		action: "動作",
		bonus: "附贈動作",
		reaction: "反應",
		round: "輪",
		minute: "分鐘",
		hour: "小時",
		special: "特殊",
		Free: "自由",
		Varies: "不定",
	};

	static _ABILITY_TO_DISPLAY = {
		str: "力量",
		dex: "敏捷",
		con: "體質",
		int: "智力",
		wis: "感知",
		cha: "魅力",
	};

	static _getBaseUrl () {
		return globalThis.Renderer?.get?.().baseUrl || "";
	}

	static _getSidecarUrl (file) {
		return `${this._getBaseUrl()}data/zh-TW/rules/${file}`;
	}

	static async _pLoadFile ({file, fnLoad = null}) {
		if (fnLoad) return fnLoad({file, url: this._getSidecarUrl(file)});

		if (!this._pFileCache.has(file)) {
			this._pFileCache.set(file, (async () => {
				const url = this._getSidecarUrl(file);
				try {
					const response = await fetch(url);
					if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
					return await response.json();
				} catch (e) {
					console.warn(`[zh-TW rules] Could not load ${url}; using canonical English data.`, e);
					return null;
				}
			})());
		}

		return this._pFileCache.get(file);
	}

	static _getFiles ({data, filenames = null}) {
		if (filenames?.length) return [...new Set(filenames.filter(file => this._FILE_TO_PROPS.has(file)))];

		return [...new Set(
			Object.keys(data || {})
				.flatMap(prop => this._PROP_TO_FILES.get(prop) || []),
		)];
	}

	static _getEntityKey ({prop, name, source}) {
		if (!prop || !name || !source) return null;
		return `${prop}\u0000${name.trim().toLowerCase()}\u0000${source.trim().toLowerCase()}`;
	}

	static _getLocalizedIndex (localeDatas) {
		const out = new Map();

		for (const localeData of localeDatas.filter(Boolean)) {
			for (const [prop, entities] of Object.entries(localeData)) {
				if (!Array.isArray(entities)) continue;

				for (const entity of entities) {
					const key = this._getEntityKey({
						prop,
						name: entity?.ENG_name,
						source: entity?.source,
					});
					if (!key || out.has(key)) continue;
					out.set(key, entity);
				}
			}
		}

		return out;
	}

	static _copy (value) {
		if (globalThis.structuredClone) return structuredClone(value);
		return JSON.parse(JSON.stringify(value));
	}

	static _getOverlayValue ({canonical, localized, key = null}) {
		if (typeof canonical === "string") return typeof localized === "string" ? localized : canonical;
		if (canonical == null || typeof canonical !== "object") return canonical;

		if (Array.isArray(canonical)) {
			if (!Array.isArray(localized) || canonical.length !== localized.length) return this._copy(canonical);
			return canonical.map((it, i) => this._getOverlayValue({canonical: it, localized: localized[i], key}));
		}

		if (!localized || typeof localized !== "object" || Array.isArray(localized)) return this._copy(canonical);

		const out = {...canonical};
		for (const childKey of this._DISPLAY_CONTAINER_KEYS) {
			if (!(childKey in canonical) || !(childKey in localized)) continue;
			out[childKey] = this._getOverlayValue({
				canonical: canonical[childKey],
				localized: localized[childKey],
				key: childKey,
			});
		}
		return out;
	}

	static _getLocalizedEntity ({canonical, localized}) {
		const out = this._copy(canonical);

		if (typeof localized.name === "string" && localized.name !== canonical.name) {
			out._displayName = localized.name;
		}

		if (typeof canonical.type === "string" && typeof localized.type === "string" && localized.type !== canonical.type) {
			out._displayType = localized.type;
			this._displayTypeByCanonical.set(canonical.type, localized.type);
		}

		for (const key of this._DISPLAY_CONTAINER_KEYS) {
			if (key === "name") continue;
			if (!(key in canonical) || !(key in localized)) continue;
			out[key] = this._getOverlayValue({canonical: canonical[key], localized: localized[key], key});
		}

		Object.defineProperty(out, "_i18nCanonical", {
			value: canonical,
			configurable: false,
			enumerable: false,
			writable: false,
		});

		return out;
	}

	/**
	 * Return a localized clone of a supported data object.
	 *
	 * @param data Canonical 5etools data object.
	 * @param [opts]
	 * @param [opts.filenames] Restrict lookup to one or more paths below `data/zh-TW/rules/`.
	 * @param [opts.fnLoad] Test/custom loader of the form `({file, url}) => data`.
	 */
	static async pApplyToData (data, {filenames = null, fnLoad = null} = {}) {
		if (!data || typeof data !== "object") return data;

		const files = this._getFiles({data, filenames});
		if (!files.length) return data;

		const localeDatas = await Promise.all(files.map(file => this._pLoadFile({file, fnLoad})));
		const localizedIndex = this._getLocalizedIndex(localeDatas);
		if (!localizedIndex.size) return this._copy(data);

		const out = this._copy(data);
		for (const [prop, entities] of Object.entries(data)) {
			if (!Array.isArray(entities) || !this._PROP_TO_FILES.has(prop)) continue;

			out[prop] = entities.map((entity, ix) => {
				const canonical = this.getCanonicalEntity(entity);
				const key = this._getEntityKey({prop, name: canonical?.name, source: canonical?.source});
				const localized = key ? localizedIndex.get(key) : null;
				return localized
					? this._getLocalizedEntity({canonical, localized})
					: out[prop][ix];
			});
		}

		return out;
	}

	static getCanonicalEntity (entity) {
		return entity?._i18nCanonical || entity;
	}

	static getCanonicalName (entity) {
		return this.getCanonicalEntity(entity)?.name || entity?.ENG_name || entity?.name || "";
	}

	static getDisplayName (entity) {
		return entity?._displayName || entity?.name || "";
	}

	static getBilingualName (entity) {
		const displayName = `${this.getDisplayName(entity)}`.trim();
		const canonicalName = `${this.getCanonicalName(entity)}`.trim();
		if (!displayName) return canonicalName;
		if (!canonicalName || displayName.toLowerCase() === canonicalName.toLowerCase()) return displayName;
		if (displayName.endsWith(`（${canonicalName}）`) || displayName.endsWith(` (${canonicalName})`)) return displayName;
		return `${displayName}（${canonicalName}）`;
	}

	static getNameSearchText (entity) {
		return [...new Set([this.getDisplayName(entity), this.getCanonicalName(entity)].filter(Boolean))].join(" ");
	}

	static getDisplayType (canonicalType) {
		if (!canonicalType) return canonicalType;
		return this._displayTypeByCanonical.get(canonicalType)
			|| globalThis.I18nZhTwSite?.tEnglish?.(canonicalType, canonicalType)
			|| canonicalType;
	}

	static getRuleTypeDisplay (ruleType) {
		return this._RULE_TYPE_TO_DISPLAY[ruleType] || ruleType;
	}

	static getActionTimeUnitDisplay (unit) {
		return this._ACTION_TIME_UNIT_TO_DISPLAY[unit] || unit;
	}

	static getActionTimeDisplay (time, fallback = null) {
		if (!time || typeof time !== "object") return fallback ?? time;
		const unit = this.getActionTimeUnitDisplay(time.unit);
		return `${time.number || ""}${time.number ? " " : ""}${unit}`;
	}

	static getAbilityDisplay (ability) {
		return this._ABILITY_TO_DISPLAY[ability] || ability;
	}

	static localizeSourceHtml (html) {
		return html
			.replaceAll("<b>Source:</b>", "<b>來源：</b>")
			.replace(/, page (\d+)/gu, "，第 $1 頁")
			.replaceAll("Additional information from", "其他資訊出自")
			.replaceAll("Also found in", "亦見於")
			.replaceAll("Referenced in", "引用於")
			.replaceAll("External sources:", "外部來源：")
			.replaceAll("Reprinted as", "再版為")
			.replaceAll("Available in ", "收錄於 ")
			.replaceAll("the Basic Rules", "《基礎規則》")
			.replaceAll("the <span", "<span")
			.replaceAll(" and ", "及")
			.replace(/\(as &quot;([^&]+)&quot;\)/gu, "（名稱為「$1」）")
			.replaceAll(" in <i", "，收錄於 <i")
			.replace(/ in ([A-Z][A-Z0-9]+)(?=;|\.|$)/gu, "，收錄於 $1");
	}

	static _resetForTests () {
		this._pFileCache.clear();
		this._displayTypeByCanonical = new Map([
			["condition", "狀態"],
			["disease", "疾病"],
			["status", "其他狀態"],
			["Magical Contagion", "魔法傳染病"],
		]);
	}
}

globalThis.I18nZhTwRules = I18nZhTwRules;
