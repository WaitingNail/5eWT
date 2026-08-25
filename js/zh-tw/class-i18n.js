export class I18nZhTwClass {
	static _locale = null;

	static async pLoad () {
		this._locale = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/zh-TW/class.json`);
		return this._locale;
	}

	static t (english) {
		return this._locale?.ui?.[english] || english;
	}

	static getCanonicalName (entity) {
		return entity?.ENG_name || entity?.name;
	}

	static getCanonicalShortName (entity) {
		return entity?.ENG_shortName || entity?.shortName || this.getCanonicalName(entity);
	}

	static applyToData (data) {
		if (!this._locale || !data || typeof data !== "object") return data;
		(data.class || []).forEach(entity => this._applyEntity(entity, "class"));
		(data.subclass || []).forEach(entity => this._applyEntity(entity, "subclass"));
		(data.classFeature || []).forEach(entity => this._applyEntity(entity, "classFeature"));
		(data.subclassFeature || []).forEach(entity => this._applyEntity(entity, "subclassFeature"));
		return data;
	}

	static _applyEntity (entity, categoryHint = null) {
		if (Array.isArray(entity)) {
			entity.forEach(child => this._applyEntity(child, categoryHint));
			return;
		}
		if (!entity || typeof entity !== "object") return;

		const category = categoryHint || this._getCategory(entity);
		if (typeof entity.name === "string") {
			const translated = this._locale.terms?.[category]?.[entity.name]
				|| this._locale.terms?.namedRuleBlock?.[entity.name];
			if (translated && translated !== entity.name) {
				entity.ENG_name ||= entity.name;
				entity.name = translated;
			}
		}

		if (category === "subclass" && typeof entity.shortName === "string") {
			const translated = this._locale.terms?.subclass?.[entity.shortName];
			if (translated && translated !== entity.shortName) {
				entity.ENG_shortName ||= entity.shortName;
				entity.shortName = translated;
			}
		}

		for (const [key, child] of Object.entries(entity)) {
			if (["ENG_name", "ENG_shortName"].includes(key)) continue;
			const childCategory = key === "classFeatures"
				? "classFeature"
				: key === "subclassFeatures"
					? "subclassFeature"
					: null;
			this._applyEntity(child, childCategory);
		}
	}

	static _getCategory (entity) {
		if (entity.subclassShortName && entity.level != null) return "subclassFeature";
		if (entity.className && entity.level != null) return "classFeature";
		if (entity.subclassFeatures || (entity.className && entity.shortName)) return "subclass";
		if (entity.classFeatures || entity.hd) return "class";
		return "namedRuleBlock";
	}
}
