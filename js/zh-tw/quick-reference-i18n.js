/**
 * Traditional Chinese display adapter for the 2014 Quick Reference.
 *
 * English names and ordering remain canonical, as they are part of the
 * Quick Reference hash/navigation contract. The translated file supplies
 * display text only. In particular, translated reference-header order is
 * intentionally ignored; body `ENG_name` values are used to map translated
 * section names onto the canonical English reference order.
 */
export class I18nZhTwQuickReference {
	static REFERENCE_ID = "bookref-quick";
	static DATA_URL = "data/zh-TW/rules/generated/bookref-quick.json";

	static _copy (value) {
		if (globalThis.structuredClone) return structuredClone(value);
		return JSON.parse(JSON.stringify(value));
	}

	static _getBaseUrl () {
		return globalThis.Renderer?.get?.().baseUrl || "";
	}

	static _getCleanName (name) {
		return `${name ?? ""}`.trim().toLowerCase();
	}

	static async pLoad ({fnLoad = null} = {}) {
		const url = `${this._getBaseUrl()}${this.DATA_URL}`;
		try {
			if (fnLoad) return await fnLoad({url});

			const response = await fetch(url);
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
			return response.json();
		} catch (e) {
			console.warn(`[zh-TW quick reference] Could not load ${url}; using canonical English data.`, e);
			return null;
		}
	}

	static _walk (value, fnObject) {
		if (Array.isArray(value)) {
			value.forEach(it => this._walk(it, fnObject));
			return;
		}
		if (!value || typeof value !== "object") return;

		fnObject(value);
		Object.values(value).forEach(it => this._walk(it, fnObject));
	}

	static _getObjectsWithStringProperty (value, property) {
		const out = [];
		this._walk(value, obj => {
			if (typeof obj[property] === "string") out.push(obj);
		});
		return out;
	}

	static _getFallbackView ({canonical, referenceId, report}) {
		const dataDocument = this._copy(canonical);
		const reference = dataDocument?.reference?.[referenceId];
		const canonicalData = dataDocument?.data?.[referenceId] || [];
		return {
			isLocalized: false,
			reference,
			dataDocument,
			adapter: this._getAdapter({canonicalData, displayByCanonical: new Map(), topCanonicalByDisplay: new Map()}),
			report,
		};
	}

	static _getAdapter ({canonicalData, displayByCanonical, topCanonicalByDisplay}) {
		const getDisplayHeaderText = text => {
			const meta = displayByCanonical.get(this._getCleanName(text));
			return meta?.display || text;
		};

		const getCanonicalHeaderText = text => {
			const clean = this._getCleanName(text);
			const fromDisplay = topCanonicalByDisplay.get(clean);
			if (fromDisplay) return fromDisplay;
			return displayByCanonical.get(clean)?.canonical || text;
		};

		return {
			searchDataAlternate: canonicalData,
			getDisplayHeaderText,
			getCanonicalHeaderText,
			localizeRenderedHeadings: ({root, trackedTitles}) => {
				if (!root?.querySelectorAll || !trackedTitles) return;

				root.querySelectorAll(`[data-title-index]`).forEach(eleTitle => {
					const titleIndex = eleTitle.getAttribute(`data-title-index`);
					const canonical = trackedTitles[titleIndex];
					if (!canonical) return;

					const display = getDisplayHeaderText(canonical);
					if (!display || display === canonical) return;

					const eleText = eleTitle.matches(`caption`)
						? eleTitle
						: eleTitle.querySelector(`.entry-title-inner`);
					if (!eleText) return;

					const current = eleText.textContent.trim();
					if (current === display || current === `${display}.`) return;

					const isRendererPeriod = current === `${canonical}.` && !canonical.endsWith(`.`);
					if (current !== canonical && !isRendererPeriod) return;
					eleText.textContent = `${display}${isRendererPeriod ? `.` : ""}`;
				});
			},
		};
	}

	/**
	 * Create the localized runtime view without mutating either input.
	 *
	 * @param canonical Canonical `data/generated/bookref-quick.json` data.
	 * @param localized Traditional Chinese fixed-source clone.
	 * @param [referenceId]
	 */
	static createLocalizedView ({canonical, localized, referenceId = this.REFERENCE_ID}) {
		const report = {
			isLocalized: false,
			translatedLabels: 0,
			translatedHeaders: 0,
			translatedCaptions: 0,
			missingSections: [],
			extraSections: [],
			conflictingNames: [],
			captionAlignmentMismatches: [],
		};

		const canonicalReference = canonical?.reference?.[referenceId];
		const canonicalData = canonical?.data?.[referenceId];
		if (!canonicalReference || !Array.isArray(canonicalData)) {
			throw new Error(`Canonical Quick Reference data is missing reference/data for "${referenceId}".`);
		}

		const localizedReference = localized?.reference?.[referenceId];
		const localizedData = localized?.data?.[referenceId];
		if (!localizedReference || !Array.isArray(localizedData)) {
			return this._getFallbackView({canonical, referenceId, report});
		}

		const displayByCanonical = new Map();
		const topCanonicalByDisplay = new Map();
		const registerDisplay = ({canonicalName, displayName}) => {
			if (typeof canonicalName !== "string" || typeof displayName !== "string") return;
			if (!canonicalName.trim() || !displayName.trim() || canonicalName === displayName) return;

			const key = this._getCleanName(canonicalName);
			const existing = displayByCanonical.get(key);
			if (existing && existing.display !== displayName) {
				report.conflictingNames.push({canonical: canonicalName, displays: [existing.display, displayName]});
				return;
			}

			if (!existing) {
				displayByCanonical.set(key, {canonical: canonicalName, display: displayName});
				report.translatedLabels++;
			}
		};

		this._walk(localizedData, obj => {
			if (typeof obj.ENG_name !== "string" || typeof obj.name !== "string") return;
			registerDisplay({canonicalName: obj.ENG_name, displayName: obj.name});
		});

		registerDisplay({canonicalName: canonicalReference.name, displayName: localizedReference.name});
		canonicalReference.contents?.forEach((chapter, ixChapter) => {
			registerDisplay({canonicalName: chapter.name, displayName: localizedReference.contents?.[ixChapter]?.name});
		});

		const normalizeNames = value => {
			if (Array.isArray(value)) return value.map(normalizeNames);
			if (!value || typeof value !== "object") return value;

			const out = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeNames(child)]));
			if (typeof value.ENG_name !== "string" || typeof value.name !== "string") return out;

			out._displayName = value.name;
			if (value.type === "item" || value.type === "itemSub") {
				out._canonicalName = value.ENG_name;
			} else {
				out.name = value.ENG_name;
			}
			return out;
		};

		const alignDisplayProperty = ({canonicalSection, localizedSection, property, displayProperty, reportKey}) => {
			const canonicalObjects = this._getObjectsWithStringProperty(canonicalSection, property);
			const localizedObjects = this._getObjectsWithStringProperty(localizedSection, property);
			if (canonicalObjects.length !== localizedObjects.length) {
				report.captionAlignmentMismatches.push({
					section: canonicalSection.name,
					property,
					canonical: canonicalObjects.length,
					localized: localizedObjects.length,
				});
			}

			for (let i = 0; i < Math.min(canonicalObjects.length, localizedObjects.length); ++i) {
				const canonicalValue = canonicalObjects[i][property];
				const localizedValue = localizedObjects[i][property];
				if (canonicalValue === localizedValue) continue;
				localizedObjects[i][displayProperty] = localizedValue;
				localizedObjects[i][property] = canonicalValue;
				registerDisplay({canonicalName: canonicalValue, displayName: localizedValue});
				report[reportKey]++;
			}
		};

		const outputGroups = canonicalData.map((canonicalGroup, ixGroup) => {
			const localizedGroup = localizedData[ixGroup];
			if (!localizedGroup || !Array.isArray(localizedGroup.entries) || !Array.isArray(canonicalGroup.entries)) {
				return this._copy(canonicalGroup);
			}

			const localizedSectionsByCanonical = new Map();
			localizedGroup.entries.forEach(section => {
				if (typeof section?.ENG_name !== "string") return;
				localizedSectionsByCanonical.set(this._getCleanName(section.ENG_name), section);
			});

			const canonicalSectionNames = new Set(canonicalGroup.entries.map(section => this._getCleanName(section.name)));
			localizedGroup.entries.forEach(section => {
				if (typeof section?.ENG_name !== "string") return;
				if (!canonicalSectionNames.has(this._getCleanName(section.ENG_name))) report.extraSections.push(section.ENG_name);
			});

			const outputGroup = this._copy(localizedGroup);
			outputGroup.entries = canonicalGroup.entries.map(canonicalSection => {
				const localizedSectionSource = localizedSectionsByCanonical.get(this._getCleanName(canonicalSection.name));
				if (!localizedSectionSource) {
					report.missingSections.push(canonicalSection.name);
					return this._copy(canonicalSection);
				}

				const localizedSection = this._copy(localizedSectionSource);
				alignDisplayProperty({
					canonicalSection,
					localizedSection,
					property: "caption",
					displayProperty: "_displayCaption",
					reportKey: "translatedCaptions",
				});
				return normalizeNames(localizedSection);
			});
			return outputGroup;
		});

		const reference = this._copy(canonicalReference);
		reference.name = localizedReference.name || reference.name;
		reference._canonicalName = canonicalReference.name;
		reference.contents = (canonicalReference.contents || []).map((canonicalChapter, ixChapter) => {
			const out = this._copy(canonicalChapter);
			out._canonicalName = canonicalChapter.name;
			out.name = localizedReference.contents?.[ixChapter]?.name || canonicalChapter.name;
			out.headers = (canonicalChapter.headers || []).map(header => {
				const canonicalHeader = typeof header === "string" ? header : header.header;
				const displayHeader = displayByCanonical.get(this._getCleanName(canonicalHeader))?.display || canonicalHeader;
				const outHeader = typeof header === "string" ? {header} : this._copy(header);
				outHeader.displayName = displayHeader;
				if (displayHeader !== canonicalHeader) report.translatedHeaders++;

				const displayKey = this._getCleanName(displayHeader);
				if (!topCanonicalByDisplay.has(displayKey)) topCanonicalByDisplay.set(displayKey, canonicalHeader);
				else if (topCanonicalByDisplay.get(displayKey) !== canonicalHeader) topCanonicalByDisplay.set(displayKey, null);
				return outHeader;
			});
			return out;
		});

		const dataDocument = {
			...this._copy(canonical),
			reference: {
				...this._copy(canonical.reference),
				[referenceId]: reference,
			},
			data: {
				...this._copy(canonical.data),
				[referenceId]: outputGroups,
			},
		};

		report.isLocalized = true;
		return {
			isLocalized: true,
			reference,
			dataDocument,
			adapter: this._getAdapter({canonicalData, displayByCanonical, topCanonicalByDisplay}),
			report,
		};
	}
}
