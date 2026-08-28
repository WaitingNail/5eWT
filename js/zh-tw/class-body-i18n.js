const _ORIGINAL_BODY = Symbol("zhTwClassBodyOriginal");

/**
 * Applies translated Class-page body content without changing any entity identity
 * fields. Sidecar records are keyed by the canonical 5etools UID for their type.
 *
 * Supported sidecar shapes:
 *
 * {
 *   "classFeature": [
 *     {"uid": "Fighting Style|Fighter||1", "entries": ["..."]}
 *   ]
 * }
 *
 * Guarded JSON-pointer records are also supported. This is the preferred shape
 * for generated/legacy translations, as every write is checked against the exact
 * English text from the pinned upstream version:
 *
 * {
 *   "classFeature": [{
 *     "match": {"canonicalName": "Fighting Style", "className": "Fighter", "classSource": "PHB", "level": 1, "source": "PHB"},
 *     "patches": [{"path": "/entries/0", "expectedEnglish": "...", "translation": "..."}]
 *   }]
 * }
 *
 * or:
 *
 * {
 *   "entities": {
 *     "classFeature": {
 *       "Fighting Style|Fighter||1": {"entries": ["..."]}
 *     }
 *   }
 * }
 *
 * The applier intentionally accepts only visible text-bearing fields. In
 * particular, `name`, `source`, class/subclass ownership, level, and feature UID
 * reference arrays are never written by this module.
 */
export class I18nZhTwClassBody {
	static _sidecar = null;

	static _compiledCache = new WeakMap();

	static _BODY_CATEGORIES = ["class", "subclass", "classFeature", "subclassFeature"];

	static _FLUFF_CATEGORIES = ["classFluff", "subclassFluff"];

	static _ALL_CATEGORIES = [...this._BODY_CATEGORIES, ...this._FLUFF_CATEGORIES];

	static _VISIBLE_ENTRY_KEYS = new Set(["by", "caption", "entry", "name", "text", "title"]);

	static async pLoad ({url = null} = {}) {
		url ||= `${Renderer.get().baseUrl}data/zh-TW/class/index.json`;
		const loaded = await DataUtil.loadJSON(url);
		if (!Array.isArray(loaded?.files)) {
			this._sidecar = loaded;
			return this._sidecar;
		}

		const baseUrl = url.slice(0, url.lastIndexOf("/") + 1);
		const files = await Promise.all(loaded.files.map(file => DataUtil.loadJSON(`${baseUrl}${file}`)));
		this._sidecar = this._mergeSidecars(files, loaded._meta);
		return this._sidecar;
	}

	static setSidecar (sidecar) {
		this._sidecar = sidecar;
		if (sidecar && typeof sidecar === "object") this._compiledCache.delete(sidecar);
		return this._sidecar;
	}

	static _mergeSidecars (sidecars, meta = null) {
		const out = {_meta: meta || {}};
		this._ALL_CATEGORIES.forEach(category => out[category] = []);
		for (const sidecar of sidecars) {
			this._ALL_CATEGORIES.forEach(category => out[category].push(...(sidecar?.[category] || [])));
		}
		return out;
	}

	/**
	 * Mutates `data` in place and returns a QA-friendly application report.
	 * Apply this before `I18nZhTwClass.applyToData`, so the non-enumerable English
	 * backups remain a pristine copy of the upstream body.
	 */
	static applyToData (data, {sidecar = this._sidecar, isStrict = false} = {}) {
		const report = this._getReport();
		if (!data || typeof data !== "object") {
			report.invalidData = true;
			if (isStrict) throw new Error("Could not apply zh-TW Class body: invalid Class data.");
			return report;
		}

		const compiled = this._getCompiledSidecar(sidecar, report);
		if (!compiled) {
			if (isStrict) throw new Error("Could not apply zh-TW Class body: invalid or missing sidecar.");
			return report;
		}

		const seenObjects = new WeakSet();
		this._BODY_CATEGORIES.forEach(category => {
			(data[category] || []).forEach(entity => this._walkEntity({entity, categoryHint: category, compiled, report, seenObjects}));
		});

		this._BODY_CATEGORIES.forEach(category => {
			for (const [uidNormalized, recordMeta] of compiled.byCategory[category]) {
				if (compiled.matchedByCategory[category].has(uidNormalized)) continue;
				report.missingEntityUids.push(`${category}:${recordMeta.uid}`);
			}
		});

		report.matchedRecords = this._BODY_CATEGORIES
			.map(category => compiled.matchedByCategory[category].size)
			.reduce((a, b) => a + b, 0);

		if (isStrict && (
			report.invalidRecords.length
			|| report.duplicateUids.length
			|| report.missingEntityUids.length
			|| report.skippedFields.length
		)) throw new Error(`Could not safely apply zh-TW Class body: ${JSON.stringify(report)}`);

		return report;
	}

	/** Apply the loaded `classFluff`/`subclassFluff` sidecar to one fetched fluff object. */
	static applyToFluff (fluff, {entity, category = null, sidecar = this._sidecar, isStrict = false} = {}) {
		const report = this._getReport();
		if (!fluff || typeof fluff !== "object" || !entity || typeof entity !== "object") {
			report.invalidData = true;
			if (isStrict) throw new Error("Could not apply zh-TW Class fluff: invalid fluff or owning entity.");
			return report;
		}

		category ||= entity.__prop === "subclass" || ((entity.shortName || entity.ENG_shortName) && entity.className)
			? "subclassFluff"
			: "classFluff";
		if (!this._FLUFF_CATEGORIES.includes(category)) {
			report.invalidData = true;
			if (isStrict) throw new Error(`Could not apply zh-TW Class fluff: invalid category "${category}".`);
			return report;
		}

		const compiled = this._getCompiledSidecar(sidecar, report);
		if (!compiled) {
			if (isStrict) throw new Error("Could not apply zh-TW Class fluff: invalid or missing sidecar.");
			return report;
		}

		const identityCategory = category === "classFluff" ? "class" : "subclass";
		const uid = this.getCanonicalUid(entity, identityCategory);
		const uidNormalized = this.normalizeUid(uid, category);
		const recordMeta = uidNormalized ? compiled.byCategory[category].get(uidNormalized) : null;
		if (!recordMeta) {
			report.missingEntityUids.push(`${category}:${uid || "unknown"}`);
			if (isStrict) throw new Error(`Could not apply zh-TW Class fluff: missing sidecar record for "${uid || "unknown"}".`);
			return report;
		}

		report.matchedRecords = 1;
		report.matchedEntities = 1;
		if (recordMeta.patches) this._applyPointerPatches({entity: fluff, category, uid: recordMeta.uid, patches: recordMeta.patches, report});
		if (recordMeta.fields) this._applyFields({entity: fluff, category, uid: recordMeta.uid, fields: recordMeta.fields, report});
		if (isStrict && (report.invalidRecords.length || report.duplicateUids.length || report.skippedFields.length)) {
			throw new Error(`Could not safely apply zh-TW Class fluff: ${JSON.stringify(report)}`);
		}
		return report;
	}

	/** Return a defensive copy of the exact pre-translation value at `path`. */
	static getEnglishBackup (entity, path = "/entries") {
		const value = entity?.[_ORIGINAL_BODY]?.get(path);
		return value === undefined ? undefined : this._copy(value);
	}

	/** Restore all fields previously changed on one entity. */
	static restoreEntity (entity, {isClearBackup = false} = {}) {
		const originals = entity?.[_ORIGINAL_BODY];
		if (!originals) return 0;

		let count = 0;
		for (const [path, value] of originals) {
			if (!this._setExistingPath(entity, this._pathToParts(path), this._copy(value))) continue;
			count++;
		}

		if (isClearBackup) delete entity[_ORIGINAL_BODY];
		return count;
	}

	static getCanonicalUid (entity, category) {
		if (!entity || typeof entity !== "object") return null;

		switch (category) {
			case "classFluff":
			case "class": return this._packClassUid({
				name: entity.ENG_name || entity.name,
				source: entity.source,
			});

			case "subclassFluff":
			case "subclass": return this._packSubclassUid({
				shortName: entity.ENG_shortName || entity.shortName || entity.ENG_name || entity.name,
				className: entity.className,
				classSource: entity.classSource,
				source: entity.source,
			});

			case "classFeature": return this._packClassFeatureUid({
				name: entity.ENG_name || entity.name,
				className: entity.className,
				classSource: entity.classSource,
				level: entity.level,
				source: entity.source,
			});

			case "subclassFeature": return this._packSubclassFeatureUid({
				name: entity.ENG_name || entity.name,
				className: entity.className,
				classSource: entity.classSource,
				subclassShortName: entity.ENG_subclassShortName || entity.subclassShortName,
				subclassSource: entity.subclassSource,
				level: entity.level,
				source: entity.source,
			});

			default: return null;
		}
	}

	static normalizeUid (uid, category) {
		if (typeof uid !== "string") return null;
		const parts = uid.split("|").map(it => it.trim());

		let packed;
		switch (category) {
			case "classFluff":
			case "class": {
				const [name, source] = parts;
				packed = this._packClassUid({name, source});
				break;
			}

			case "subclassFluff":
			case "subclass": {
				const [shortName, className, classSource, source] = parts;
				packed = this._packSubclassUid({shortName, className, classSource, source});
				break;
			}

			case "classFeature": {
				const [name, className, classSource, level, source] = parts;
				packed = this._packClassFeatureUid({name, className, classSource, level, source});
				break;
			}

			case "subclassFeature": {
				const [name, className, classSource, subclassShortName, subclassSource, level, source] = parts;
				packed = this._packSubclassFeatureUid({name, className, classSource, subclassShortName, subclassSource, level, source});
				break;
			}

			default: return null;
		}

		return packed == null ? null : this._normalize(packed);
	}

	static _walkEntity ({entity, categoryHint, compiled, report, seenObjects}) {
		if (Array.isArray(entity)) {
			entity.forEach(child => this._walkEntity({entity: child, categoryHint, compiled, report, seenObjects}));
			return;
		}
		if (!entity || typeof entity !== "object" || seenObjects.has(entity)) return;
		seenObjects.add(entity);

		const category = categoryHint || this._getCategory(entity);
		if (category) this._applyEntity({entity, category, compiled, report});

		[
			["classFeatures", "classFeature"],
			["subclassFeatures", "subclassFeature"],
			["subclasses", "subclass"],
		].forEach(([key, childCategory]) => {
			if (entity[key] == null) return;
			this._walkEntity({entity: entity[key], categoryHint: childCategory, compiled, report, seenObjects});
		});
	}

	static _getCategory (entity) {
		if (entity.subclassShortName && entity.className && entity.level != null && entity.source) return "subclassFeature";
		if (entity.className && entity.level != null && entity.source) return "classFeature";
		if ((entity.shortName || entity.ENG_shortName) && entity.className && entity.subclassFeatures && entity.source) return "subclass";
		if ((entity.classFeatures || entity.hd) && entity.source && (entity.name || entity.ENG_name)) return "class";
		return null;
	}

	static _applyEntity ({entity, category, compiled, report}) {
		this._ensureNestedFluffIdentityBackups(entity, category);
		const uid = this.getCanonicalUid(entity, category);
		const uidNormalized = this.normalizeUid(uid, category);
		if (!uidNormalized) return;

		const recordMeta = compiled.byCategory[category].get(uidNormalized);
		if (!recordMeta) return;

		compiled.matchedByCategory[category].add(uidNormalized);
		report.matchedEntities++;
		if (recordMeta.patches) this._applyPointerPatches({entity, category, uid: recordMeta.uid, patches: recordMeta.patches, report});
		if (recordMeta.fields) this._applyFields({entity, category, uid: recordMeta.uid, fields: recordMeta.fields, report});
	}

	static _ensureNestedFluffIdentityBackups (entity, category) {
		if (category !== "subclass") return;
		const fluffRef = entity.fluff?._subclassFluff;
		if (!fluffRef || typeof fluffRef !== "object") return;
		if (typeof fluffRef.name === "string") fluffRef.ENG_name ||= fluffRef.name;
		if (typeof fluffRef.shortName === "string") fluffRef.ENG_shortName ||= fluffRef.shortName;
	}

	static _applyPointerPatches ({entity, category, uid, patches, report}) {
		patches.forEach((patch, ix) => {
			if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
				this._addSkipped({category, uid, path: `#patch-${ix}`, reason: "invalid-patch", report});
				return;
			}

			const {path, expectedEnglish, translation} = patch;
			if (typeof path !== "string" || !path.startsWith("/") || typeof expectedEnglish !== "string" || typeof translation !== "string") {
				this._addSkipped({category, uid, path: typeof path === "string" ? path : `#patch-${ix}`, reason: "invalid-patch", report});
				return;
			}

			const pathParts = this._pathToParts(path);
			const current = this._getExistingPath(entity, pathParts);
			if (typeof current !== "string") {
				this._addSkipped({category, uid, path, reason: "missing-string-target", report});
				return;
			}

			if (!this._isAllowedVisiblePointer({entity, category, pathParts})) {
				this._addSkipped({category, uid, path, reason: "field-not-allowed", report});
				return;
			}

			if (current === translation) {
				report.alreadyAppliedFields++;
				return;
			}

			if (current !== expectedEnglish) {
				this._addSkipped({category, uid, path, reason: "expected-english-mismatch", report});
				return;
			}

			const translationValidationError = this._getTranslationValidationError({expectedEnglish, translation});
			if (translationValidationError) {
				this._addSkipped({category, uid, path, reason: translationValidationError, report});
				return;
			}

			this._replace({entity, pathParts, value: translation, original: current, category, uid, report});
		});
	}

	static _isAllowedVisiblePointer ({entity, category, pathParts}) {
		if (!pathParts.length || pathParts[0] === "name") return false;

		const parent = this._getExistingPath(entity, pathParts.slice(0, -1));
		const isVisibleEntryLeaf = () => Array.isArray(parent) || this._VISIBLE_ENTRY_KEYS.has(pathParts.at(-1));

		if (["classFeature", "subclassFeature", "classFluff", "subclassFluff"].includes(category)) {
			return pathParts[0] === "entries" && isVisibleEntryLeaf();
		}

		if (pathParts[0] === "entries") return isVisibleEntryLeaf();

		if (category === "class") {
			if (pathParts.length === 1 && pathParts[0] === "subclassTitle") return true;
			if (["optionalfeatureProgression", "featProgression"].includes(pathParts[0]) && pathParts.at(-1) === "name") return true;
			if (pathParts[0] === "startingProficiencies") return ["weapons", "tools"].includes(pathParts[1]) && Array.isArray(parent);
			if (pathParts[0] === "multiclassing") {
				if (["requirementsSpecial", "entries"].includes(pathParts[1])) return isVisibleEntryLeaf();
				return pathParts[1] === "proficienciesGained" && ["weapons", "tools"].includes(pathParts[2]) && Array.isArray(parent);
			}
			if (pathParts[0] === "startingEquipment") {
				if (pathParts.length === 2 && pathParts[1] === "goldAlternative") return true;
				return ["default", "entries"].includes(pathParts[1]) && Array.isArray(parent);
			}
			if (pathParts[0] === "classTableGroups") return isVisibleEntryLeaf();
		}

		if (category === "subclass") {
			if (["optionalfeatureProgression", "featProgression"].includes(pathParts[0]) && pathParts.at(-1) === "name") return true;
			if (pathParts[0] === "subclassTableGroups") return isVisibleEntryLeaf();
		}

		return false;
	}

	static _getTranslationValidationError ({expectedEnglish, translation}) {
		const expectedTags = this._getInlineTags(expectedEnglish);
		const translatedTags = this._getInlineTags(translation);
		if (expectedTags == null || translatedTags == null) return "inline-tag-parse-failure";
		if (JSON.stringify(expectedTags.map(it => it.raw)) !== JSON.stringify(translatedTags.map(it => it.raw))) return "inline-tag-mismatch";

		const expectedNumbers = this._getVisibleNumberSignature(expectedEnglish, expectedTags);
		const translatedNumbers = this._getVisibleNumberSignature(translation, translatedTags);
		if (JSON.stringify(expectedNumbers) !== JSON.stringify(translatedNumbers)) return "visible-number-signature-mismatch";
		return null;
	}

	static _getInlineTags (text) {
		const out = [];
		for (let i = 0; i < text.length - 1; ++i) {
			if (text[i] !== "{" || text[i + 1] !== "@") continue;
			const start = i;
			let depth = 1;
			i += 2;
			for (; i < text.length && depth; ++i) {
				if (text[i] === "{" && text[i + 1] === "@") {
					++depth;
					++i;
					continue;
				}
				if (text[i] === "}") --depth;
			}
			if (depth) return null;
			out.push({start, end: i, raw: text.slice(start, i)});
			--i;
		}
		return out;
	}

	static _getVisibleNumberSignature (text, tags) {
		let withoutTags = "";
		let cursor = 0;
		for (const tag of tags) {
			withoutTags += text.slice(cursor, tag.start);
			cursor = tag.end;
		}
		withoutTags += text.slice(cursor);
		return [...withoutTags.matchAll(/[-+]?\d+(?:[.,]\d+)*(?:st|nd|rd|th)?(?:%|％)?/giu)]
			.map(match => match[0].replace(/(st|nd|rd|th)(?=%|％|$)/iu, ""));
	}

	static _applyFields ({entity, category, uid, fields, report}) {
		for (const [field, value] of Object.entries(fields)) {
			switch (field) {
				case "entries":
					this._replaceArray({entity, pathParts: ["entries"], value, category, uid, report});
					break;

				case "subclassTitle":
					if (category !== "class") this._addSkipped({category, uid, path: "/subclassTitle", reason: "field-not-allowed", report});
					else this._replaceString({entity, pathParts: ["subclassTitle"], value, category, uid, report});
					break;

				case "startingEquipment":
					if (category !== "class") this._addSkipped({category, uid, path: "/startingEquipment", reason: "field-not-allowed", report});
					else this._applyStartingEquipment({entity, value, category, uid, report});
					break;

				case "startingProficiencies":
					if (category !== "class") this._addSkipped({category, uid, path: "/startingProficiencies", reason: "field-not-allowed", report});
					else this._applyProficiencies({entity, value, pathPartsBase: ["startingProficiencies"], category, uid, report});
					break;

				case "multiclassing":
					if (category !== "class") this._addSkipped({category, uid, path: "/multiclassing", reason: "field-not-allowed", report});
					else this._applyMulticlassing({entity, value, category, uid, report});
					break;

				case "classTableGroups":
					if (category !== "class") this._addSkipped({category, uid, path: "/classTableGroups", reason: "field-not-allowed", report});
					else this._applyIndexedVisibleObjects({entity, key: field, value, allowedFields: ["title", "colLabels"], category, uid, report});
					break;

				case "subclassTableGroups":
					if (category !== "subclass") this._addSkipped({category, uid, path: "/subclassTableGroups", reason: "field-not-allowed", report});
					else this._applyIndexedVisibleObjects({entity, key: field, value, allowedFields: ["title", "colLabels"], category, uid, report});
					break;

				case "optionalfeatureProgression":
				case "featProgression":
					if (!["class", "subclass"].includes(category)) this._addSkipped({category, uid, path: `/${field}`, reason: "field-not-allowed", report});
					else this._applyIndexedVisibleObjects({entity, key: field, value, allowedFields: ["name"], category, uid, report});
					break;

				default:
					this._addSkipped({category, uid, path: `/${field}`, reason: "field-not-allowed", report});
			}
		}
	}

	static _applyStartingEquipment ({entity, value, category, uid, report}) {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			this._addSkipped({category, uid, path: "/startingEquipment", reason: "invalid-value", report});
			return;
		}

		for (const [field, fieldValue] of Object.entries(value)) {
			const pathParts = ["startingEquipment", field];
			switch (field) {
				case "entries":
				case "default":
					this._replaceArray({entity, pathParts, value: fieldValue, category, uid, report});
					break;

				case "goldAlternative":
					this._replaceString({entity, pathParts, value: fieldValue, category, uid, report});
					break;

				default:
					this._addSkipped({category, uid, path: this._partsToPath(pathParts), reason: "field-not-allowed", report});
			}
		}
	}

	static _applyProficiencies ({entity, value, pathPartsBase, category, uid, report}) {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			this._addSkipped({category, uid, path: this._partsToPath(pathPartsBase), reason: "invalid-value", report});
			return;
		}

		for (const [field, fieldValue] of Object.entries(value)) {
			const pathParts = [...pathPartsBase, field];
			if (!["weapons", "tools"].includes(field)) {
				this._addSkipped({category, uid, path: this._partsToPath(pathParts), reason: "field-not-allowed", report});
				continue;
			}
			this._replaceArray({entity, pathParts, value: fieldValue, category, uid, report});
		}
	}

	static _applyMulticlassing ({entity, value, category, uid, report}) {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			this._addSkipped({category, uid, path: "/multiclassing", reason: "invalid-value", report});
			return;
		}

		for (const [field, fieldValue] of Object.entries(value)) {
			const pathParts = ["multiclassing", field];
			switch (field) {
				case "entries": this._replaceArray({entity, pathParts, value: fieldValue, category, uid, report}); break;
				case "requirementsSpecial": this._replaceString({entity, pathParts, value: fieldValue, category, uid, report}); break;
				case "proficienciesGained": this._applyProficiencies({entity, value: fieldValue, pathPartsBase: pathParts, category, uid, report}); break;
				default: this._addSkipped({category, uid, path: this._partsToPath(pathParts), reason: "field-not-allowed", report});
			}
		}
	}

	static _applyIndexedVisibleObjects ({entity, key, value, allowedFields, category, uid, report}) {
		if (!Array.isArray(value) && (!value || typeof value !== "object")) {
			this._addSkipped({category, uid, path: `/${key}`, reason: "invalid-value", report});
			return;
		}

		for (const [ixRaw, patch] of Object.entries(value)) {
			const ix = Number(ixRaw);
			if (!Number.isInteger(ix) || ix < 0 || !patch || typeof patch !== "object" || Array.isArray(patch)) {
				this._addSkipped({category, uid, path: `/${key}/${ixRaw}`, reason: "invalid-indexed-patch", report});
				continue;
			}

			for (const [field, fieldValue] of Object.entries(patch)) {
				const pathParts = [key, ix, field];
				if (!allowedFields.includes(field)) {
					this._addSkipped({category, uid, path: this._partsToPath(pathParts), reason: "field-not-allowed", report});
					continue;
				}

				if (field === "colLabels") this._replaceArray({entity, pathParts, value: fieldValue, category, uid, report});
				else this._replaceString({entity, pathParts, value: fieldValue, category, uid, report});
			}
		}
	}

	static _replaceArray (meta) {
		if (!Array.isArray(meta.value)) {
			this._addSkipped({...meta, path: this._partsToPath(meta.pathParts), reason: "expected-array"});
			return;
		}

		const original = this._getExistingPath(meta.entity, meta.pathParts);
		if (!Array.isArray(original)) {
			this._addSkipped({...meta, path: this._partsToPath(meta.pathParts), reason: "missing-array-target"});
			return;
		}

		if (original.length !== meta.value.length) {
			this._addSkipped({...meta, path: this._partsToPath(meta.pathParts), reason: "array-length-mismatch"});
			return;
		}

		this._replace({...meta, original});
	}

	static _replaceString (meta) {
		if (typeof meta.value !== "string") {
			this._addSkipped({...meta, path: this._partsToPath(meta.pathParts), reason: "expected-string"});
			return;
		}

		const original = this._getExistingPath(meta.entity, meta.pathParts);
		if (typeof original !== "string") {
			this._addSkipped({...meta, path: this._partsToPath(meta.pathParts), reason: "missing-string-target"});
			return;
		}

		this._replace({...meta, original});
	}

	static _replace ({entity, pathParts, value, original, category, uid, report}) {
		const path = this._partsToPath(pathParts);
		const originals = this._getOrCreateOriginals(entity);
		if (!originals.has(path)) originals.set(path, this._copy(original));

		if (!this._setExistingPath(entity, pathParts, this._copy(value))) {
			this._addSkipped({category, uid, path, reason: "missing-target", report});
			return;
		}

		report.appliedFields++;
		report.appliedPaths.push(`${category}:${uid}${path}`);
	}

	static _getOrCreateOriginals (entity) {
		if (entity[_ORIGINAL_BODY]) return entity[_ORIGINAL_BODY];
		Object.defineProperty(entity, _ORIGINAL_BODY, {
			value: new Map(),
			configurable: true,
		});
		return entity[_ORIGINAL_BODY];
	}

	static _getExistingPath (entity, parts) {
		let current = entity;
		for (const part of parts) {
			if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
			current = current[part];
		}
		return current;
	}

	static _setExistingPath (entity, parts, value) {
		let current = entity;
		for (let i = 0; i < parts.length - 1; ++i) {
			const part = parts[i];
			if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) return false;
			current = current[part];
		}

		const finalPart = parts.at(-1);
		if (current == null || !Object.prototype.hasOwnProperty.call(current, finalPart)) return false;
		current[finalPart] = value;
		return true;
	}

	static _compileSidecar (sidecar, report) {
		if (!sidecar || typeof sidecar !== "object") return null;
		const source = sidecar.entities && typeof sidecar.entities === "object" ? sidecar.entities : sidecar;
		const out = {
			byCategory: Object.fromEntries(this._ALL_CATEGORIES.map(category => [category, new Map()])),
			matchedByCategory: Object.fromEntries(this._ALL_CATEGORIES.map(category => [category, new Set()])),
		};

		this._ALL_CATEGORIES.forEach(category => {
			const categoryRecords = source[category];
			if (categoryRecords == null) return;

			if (Array.isArray(categoryRecords)) {
				categoryRecords.forEach((record, ix) => this._compileRecord({category, uidFromKey: null, record, location: `${category}[${ix}]`, out, report}));
				return;
			}

			if (typeof categoryRecords === "object") {
				Object.entries(categoryRecords).forEach(([uid, record]) => this._compileRecord({category, uidFromKey: uid, record, location: `${category}.${uid}`, out, report}));
				return;
			}

			report.invalidRecords.push({location: category, reason: "category-must-be-array-or-object"});
		});

		return out;
	}

	static _getCompiledSidecar (sidecar, report) {
		if (!sidecar || typeof sidecar !== "object") return null;
		const cached = this._compiledCache.get(sidecar);
		if (cached) {
			report.records += cached.records;
			report.duplicateUids.push(...cached.duplicateUids);
			report.invalidRecords.push(...cached.invalidRecords);
			return {
				byCategory: cached.byCategory,
				matchedByCategory: Object.fromEntries(this._ALL_CATEGORIES.map(category => [category, new Set()])),
			};
		}

		const compileReport = this._getReport();
		const compiled = this._compileSidecar(sidecar, compileReport);
		if (!compiled) return null;
		this._compiledCache.set(sidecar, {
			byCategory: compiled.byCategory,
			records: compileReport.records,
			duplicateUids: compileReport.duplicateUids,
			invalidRecords: compileReport.invalidRecords,
		});
		report.records += compileReport.records;
		report.duplicateUids.push(...compileReport.duplicateUids);
		report.invalidRecords.push(...compileReport.invalidRecords);
		return compiled;
	}

	static _compileRecord ({category, uidFromKey, record, location, out, report}) {
		report.records++;
		if (!record || typeof record !== "object" || Array.isArray(record)) {
			report.invalidRecords.push({location, reason: "record-must-be-object"});
			return;
		}

		const isLocalizedEntity = !!record.ENG_name && !record.uid && !record.canonicalUid && !record.match && !record.patches && !record.fields;
		const uid = uidFromKey
			|| record.uid
			|| record.canonicalUid
			|| this._getUidFromMatch(record.match, category)
			|| (isLocalizedEntity ? this.getCanonicalUid(record, category) : null);
		const uidNormalized = this.normalizeUid(uid, category);
		if (!uidNormalized) {
			report.invalidRecords.push({location, reason: "invalid-uid"});
			return;
		}

		if (out.byCategory[category].has(uidNormalized)) {
			report.duplicateUids.push(`${category}:${uid}`);
			return;
		}

		if (record.patches != null && !Array.isArray(record.patches)) {
			report.invalidRecords.push({location, reason: "patches-must-be-array"});
			return;
		}

		const isPointerRecord = Array.isArray(record.patches);
		const fieldsRaw = record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
			? record.fields
			: record;
		const fields = isPointerRecord
			? null
			: isLocalizedEntity
				? this._getFieldsFromLocalizedEntity(record, category)
				: Object.fromEntries(Object.entries(fieldsRaw).filter(([key]) => !["uid", "canonicalUid", "fields", "match", "patches", "_meta", "note", "status"].includes(key)));
		out.byCategory[category].set(uidNormalized, {
			uid,
			fields,
			patches: isPointerRecord ? record.patches : null,
		});
	}

	static _getFieldsFromLocalizedEntity (entity, category) {
		const out = {};
		if (Array.isArray(entity.entries)) out.entries = entity.entries;

		if (category === "class") {
			if (typeof entity.subclassTitle === "string") out.subclassTitle = entity.subclassTitle;
			if (entity.startingProficiencies && typeof entity.startingProficiencies === "object") {
				out.startingProficiencies = Object.fromEntries(
					["weapons", "tools"]
						.filter(key => Array.isArray(entity.startingProficiencies[key]))
						.map(key => [key, entity.startingProficiencies[key]]),
				);
			}
			if (entity.multiclassing && typeof entity.multiclassing === "object") {
				out.multiclassing = Object.fromEntries([
					...(["requirementsSpecial", "entries"]
						.filter(key => entity.multiclassing[key] != null)
						.map(key => [key, entity.multiclassing[key]])),
					...(entity.multiclassing.proficienciesGained && typeof entity.multiclassing.proficienciesGained === "object"
						? [["proficienciesGained", Object.fromEntries(
							["weapons", "tools"]
								.filter(key => Array.isArray(entity.multiclassing.proficienciesGained[key]))
								.map(key => [key, entity.multiclassing.proficienciesGained[key]]),
						)]]
						: []),
				]);
			}
			if (entity.startingEquipment && typeof entity.startingEquipment === "object") {
				out.startingEquipment = Object.fromEntries(
					["entries", "default", "goldAlternative"]
						.filter(key => entity.startingEquipment[key] != null)
						.map(key => [key, entity.startingEquipment[key]]),
				);
			}
			if (Array.isArray(entity.classTableGroups)) out.classTableGroups = this._getLocalizedIndexedFields(entity.classTableGroups, ["title", "colLabels"]);
		}

		if (category === "subclass" && Array.isArray(entity.subclassTableGroups)) {
			out.subclassTableGroups = this._getLocalizedIndexedFields(entity.subclassTableGroups, ["title", "colLabels"]);
		}

		if (["class", "subclass"].includes(category)) {
			["optionalfeatureProgression", "featProgression"].forEach(key => {
				if (!Array.isArray(entity[key])) return;
				out[key] = this._getLocalizedIndexedFields(entity[key], ["name"]);
			});
		}

		return out;
	}

	static _getLocalizedIndexedFields (values, allowedFields) {
		return Object.fromEntries(values.map((value, ix) => [
			ix,
			Object.fromEntries(allowedFields.filter(key => value?.[key] != null).map(key => [key, value[key]])),
		]));
	}

	static _getUidFromMatch (match, category) {
		if (!match || typeof match !== "object" || Array.isArray(match)) return null;
		const name = match.canonicalName || match.name;
		switch (category) {
			case "classFluff":
			case "class": return this._packClassUid({name, source: match.source});
			case "subclassFluff":
			case "subclass": return this._packSubclassUid({
				shortName: match.subclassShortName || match.shortName || name,
				className: match.className,
				classSource: match.classSource,
				source: match.source || match.subclassSource,
			});
			case "classFeature": return this._packClassFeatureUid({
				name,
				className: match.className,
				classSource: match.classSource,
				level: match.level,
				source: match.source,
			});
			case "subclassFeature": return this._packSubclassFeatureUid({
				name,
				className: match.className,
				classSource: match.classSource,
				subclassShortName: match.subclassShortName,
				subclassSource: match.subclassSource,
				level: match.level,
				source: match.source,
			});
			default: return null;
		}
	}

	static _packClassUid ({name, source}) {
		if (!name) return null;
		return [name, source || "PHB"].join("|");
	}

	static _packSubclassUid ({shortName, className, classSource, source}) {
		if (!shortName || !className) return null;
		classSource ||= "PHB";
		source ||= "PHB";
		return [
			shortName,
			className,
			classSource.toUpperCase() === "PHB" ? "" : classSource,
			source.toUpperCase() === "PHB" ? "" : source,
		].join("|").replace(/\|+$/, "");
	}

	static _packClassFeatureUid ({name, className, classSource, level, source}) {
		if (!name || !className || level == null || Number.isNaN(Number(level))) return null;
		classSource ||= "PHB";
		source ||= classSource;
		return [
			name,
			className,
			classSource.toUpperCase() === "PHB" ? "" : classSource,
			level,
			source.toUpperCase() === classSource.toUpperCase() ? "" : source,
		].join("|").replace(/\|+$/, "");
	}

	static _packSubclassFeatureUid ({name, className, classSource, subclassShortName, subclassSource, level, source}) {
		if (!name || !className || !subclassShortName || level == null || Number.isNaN(Number(level))) return null;
		classSource ||= "PHB";
		subclassSource ||= "PHB";
		source ||= subclassSource;
		return [
			name,
			className,
			classSource.toUpperCase() === "PHB" ? "" : classSource,
			subclassShortName,
			subclassSource.toUpperCase() === "PHB" ? "" : subclassSource,
			level,
			source.toUpperCase() === subclassSource.toUpperCase() ? "" : source,
		].join("|").replace(/\|+$/, "");
	}

	static _normalize (value) {
		return value.normalize("NFKC").trim().toLowerCase();
	}

	static _copy (value) {
		if (globalThis.structuredClone) return globalThis.structuredClone(value);
		return JSON.parse(JSON.stringify(value));
	}

	static _partsToPath (parts) {
		return `/${parts.map(it => `${it}`.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
	}

	static _pathToParts (path) {
		return path.split("/").slice(1).map(it => it.replace(/~1/g, "/").replace(/~0/g, "~"));
	}

	static _addSkipped ({category, uid, path, reason, report}) {
		report.skippedFields.push({category, uid, path, reason});
	}

	static _getReport () {
		return {
			records: 0,
			matchedRecords: 0,
			matchedEntities: 0,
			appliedFields: 0,
			alreadyAppliedFields: 0,
			appliedPaths: [],
			missingEntityUids: [],
			duplicateUids: [],
			invalidRecords: [],
			skippedFields: [],
			invalidData: false,
		};
	}
}
