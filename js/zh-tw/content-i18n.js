/* Guarded zh-TW entity-content overlay. This is intentionally a classic script. */
"use strict";

(() => {
	const root = globalThis;

	class I18nZhTwContent {
		static _SPELL_SCHOOLS = {
			A: "防護",
			C: "咒法",
			D: "預言",
			E: "惑控",
			I: "幻術",
			N: "死靈",
			P: "心靈",
			T: "變化",
			V: "塑能",
		};

		static _SPELL_TIME_UNITS = {
			action: "動作",
			bonus: "附贈動作",
			reaction: "反應",
			round: "輪",
			minute: "分鐘",
			hour: "小時",
			special: "特殊",
			ritual: "儀式",
		};

		static _SPELL_DURATION_UNITS = {
			turn: "回合",
			round: "輪",
			minute: "分鐘",
			hour: "小時",
			day: "天",
			week: "週",
			month: "個月",
			year: "年",
		};

		static _SPELL_RANGE_TYPES = {
			special: "特殊",
			point: "點",
			line: "直線",
			cube: "立方",
			cone: "錐狀",
			emanation: "光環",
			radius: "半徑",
			sphere: "球形",
			hemisphere: "半球",
			cylinder: "柱狀",
			self: "自身",
			sight: "視線",
			unlimited: "無限",
			plane: "同一位面內無限",
			touch: "觸及",
		};

		static _SPELL_DISTANCE_UNITS = {
			inches: "吋",
			feet: "尺",
			yards: "碼",
			miles: "哩",
		};

		static _ABILITIES = {
			strength: "力量",
			dexterity: "敏捷",
			constitution: "體質",
			intelligence: "智力",
			wisdom: "感知",
			charisma: "魅力",
		};

		static _DAMAGE_TYPES = {
			acid: "強酸",
			bludgeoning: "鈍擊",
			cold: "寒冷",
			fire: "火焰",
			force: "力場",
			lightning: "閃電",
			necrotic: "暗蝕",
			piercing: "穿刺",
			poison: "毒素",
			psychic: "心靈",
			radiant: "光耀",
			slashing: "揮砍",
			thunder: "雷鳴",
		};

		static _CONDITIONS = {
			blinded: "目盲",
			charmed: "魅惑",
			deafened: "耳聾",
			exhaustion: "力竭",
			frightened: "恐懼",
			grappled: "被擒",
			incapacitated: "無力",
			invisible: "隱形",
			paralyzed: "麻痺",
			petrified: "石化",
			poisoned: "中毒",
			prone: "伏地",
			restrained: "束縛",
			stunned: "震懾",
			unconscious: "昏迷",
		};

		static _CREATURE_TYPES = {
			aberration: "異怪",
			beast: "野獸",
			celestial: "天界生物",
			construct: "構裝生物",
			dragon: "龍",
			elemental: "元素生物",
			fey: "精類",
			fiend: "邪魔",
			giant: "巨人",
			humanoid: "類人生物",
			monstrosity: "怪獸",
			ooze: "泥怪",
			plant: "植物",
			undead: "不死生物",
		};

		static _SPELL_AREA_TYPES = {
			ST: "單一目標",
			MT: "多個目標",
			C: "立方",
			N: "錐狀",
			Y: "柱狀",
			S: "球形",
			R: "圓形",
			Q: "方形",
			L: "直線",
			H: "半球",
			W: "牆",
			E: "光環",
		};

		static _SPELL_MISC_TAGS = {
			HL: "治療",
			THP: "賦予臨時生命值",
			SGT: "需要視線",
			PRM: "永久效應",
			SCL: "隨環階提升效應",
			SCT: "隨環階增加目標",
			SMN: "召喚生物",
			MAC: "調整護甲等級",
			TP: "傳送",
			FMV: "強制移動",
			RO: "可擲骰效應",
			LGTS: "創造陽光",
			LGT: "創造光照",
			UBA: "使用附贈動作",
			PS: "位面轉移",
			OBS: "遮蔽視線",
			DFT: "困難地形",
			AAD: "額外攻擊傷害",
			OBJ: "影響物件",
			ADV: "賦予優勢",
			PIR: "重複施展後永久生效",
		};

		static _SPELL_FILTER_LABELS = {
			Concentration: "專注",
			Verbal: "言語",
			Somatic: "姿勢",
			Material: "材料",
			Royalty: "權利金",
			"Material with Cost": "有價格的材料",
			"Material is Consumed": "材料會被消耗",
			"Material is Optionally Consumed": "材料可選擇消耗",
			Ritual: "儀式",
			Legacy: "舊版",
			Reprinted: "已重印",
			"Has Images": "有圖片",
			"Has Token": "有標記",
			Point: "點",
			"Self (Area)": "自身（範圍）",
			Self: "自身",
			Touch: "觸及",
			Special: "特殊",
			Instant: "立即",
			"1 Round": "1輪",
			"1 Minute": "1分鐘",
			"10 Minutes": "10分鐘",
			"1 Hour": "1小時",
			"8 Hours": "8小時",
			"24+ Hours": "24小時以上",
			Permanent: "永久",
		};

		static _PROP_TO_FOLDER = new Map([
			["spell", "spells"],
			["spellFluff", "spells"],
		]);

		static _CONTENT_KEYS = new Set([
			"name",
			"shortName",
			"caption",
			"title",
			"label",
			"by",
			"text",
			"quote",
			"author",
			"entries",
			"entry",
			"items",
			"footnotes",
			"headerEntries",
			"footerEntries",
			"colLabels",
			"rowLabels",
			"rows",
			"row",
			"tables",
			"default",
			"columns",
		]);

		static _pFileCache = new Map();

		static _copy (value) {
			if (root.structuredClone) return structuredClone(value);
			return JSON.parse(JSON.stringify(value));
		}

		static _getBaseUrl () {
			return root.Renderer?.get?.().baseUrl || "";
		}

		static _getEntityKey ({prop, name, source}) {
			if (!prop || typeof name !== "string" || typeof source !== "string") return null;
			return `${prop}\u0000${name.trim().toLowerCase()}\u0000${source.trim().toLowerCase()}`;
		}

		static async _pLoadFile ({folder, file, fnLoad = null}) {
			const cacheKey = `${folder}/${file}`;
			const url = `${this._getBaseUrl()}data/zh-TW/${cacheKey}`;
			if (fnLoad) return fnLoad({folder, file, url});

			if (!this._pFileCache.has(cacheKey)) {
				this._pFileCache.set(cacheKey, (async () => {
					try {
						const response = await fetch(url);
						if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
						return await response.json();
					} catch (error) {
						console.warn(`[zh-TW content] Could not load ${url}; using canonical English data.`, error);
						return null;
					}
				})());
			}
			return this._pFileCache.get(cacheKey);
		}

		static _getLocalizedIndex ({prop, sidecar}) {
			const out = new Map();
			for (const entity of sidecar?.[prop] || []) {
				const key = this._getEntityKey({prop, name: entity?.ENG_name, source: entity?.source});
				if (!key || out.has(key)) continue;
				out.set(key, entity);
			}
			return out;
		}

		static _overlayContentValue ({canonical, localized}) {
			if (typeof canonical === "string") return typeof localized === "string" ? localized : canonical;
			if (canonical == null || typeof canonical !== "object") return canonical;

			if (Array.isArray(canonical)) {
				if (!Array.isArray(localized) || canonical.length !== localized.length) return this._copy(canonical);
				return canonical.map((child, ix) => this._overlayContentValue({canonical: child, localized: localized[ix]}));
			}

			if (!localized || typeof localized !== "object" || Array.isArray(localized)) return this._copy(canonical);
			const out = {...canonical};
			for (const key of this._CONTENT_KEYS) {
				if (!(key in canonical) || !(key in localized)) continue;
				out[key] = this._overlayContentValue({canonical: canonical[key], localized: localized[key]});
			}
			return out;
		}

		static _overlayMaterial ({canonical, localized}) {
			if (typeof canonical === "string") return typeof localized === "string" ? localized : canonical;
			if (!canonical || typeof canonical !== "object" || Array.isArray(canonical)) return this._copy(canonical);
			if (!localized || typeof localized !== "object" || Array.isArray(localized)) return this._copy(canonical);
			const out = {...canonical};
			if (typeof canonical.text === "string" && typeof localized.text === "string") out.text = localized.text;
			return out;
		}

		static _overlayLabelTree ({canonical, localized}) {
			if (Array.isArray(canonical)) {
				if (!Array.isArray(localized) || canonical.length !== localized.length) return this._copy(canonical);
				return canonical.map((child, ix) => this._overlayLabelTree({canonical: child, localized: localized[ix]}));
			}
			if (!canonical || typeof canonical !== "object") return canonical;
			if (!localized || typeof localized !== "object" || Array.isArray(localized)) return this._copy(canonical);
			const out = {...canonical};
			for (const key of Object.keys(canonical)) {
				if (key === "label" && typeof canonical[key] === "string" && typeof localized[key] === "string") {
					out[key] = localized[key];
					continue;
				}
				if (canonical[key] && typeof canonical[key] === "object") {
					out[key] = this._overlayLabelTree({canonical: canonical[key], localized: localized[key]});
				}
			}
			return out;
		}

		static _overlayTimes ({canonical, localized}) {
			if (!Array.isArray(canonical) || !Array.isArray(localized) || canonical.length !== localized.length) return this._copy(canonical);
			return canonical.map((time, ix) => {
				const translated = localized[ix];
				if (!time || typeof time !== "object" || !translated || typeof translated !== "object") return this._copy(time);
				const out = {...time};
				for (const key of ["condition", "note"]) {
					if (typeof time[key] === "string" && typeof translated[key] === "string") out[key] = translated[key];
				}
				return out;
			});
		}

		static _getLocalizedEntity ({canonical, localized}) {
			const out = this._copy(canonical);
			if (typeof localized.name === "string" && localized.name !== canonical.name) out._displayName = localized.name;

			for (const key of ["entries", "entriesHigherLevel"]) {
				if (!(key in canonical) || !(key in localized)) continue;
				out[key] = this._overlayContentValue({canonical: canonical[key], localized: localized[key]});
			}

			if (canonical.components && localized.components) {
				out.components = this._copy(canonical.components);
				if ("m" in canonical.components && "m" in localized.components) {
					out.components.m = this._overlayMaterial({canonical: canonical.components.m, localized: localized.components.m});
				}
			}

			if (canonical.scalingLevelDice && localized.scalingLevelDice) {
				out.scalingLevelDice = this._overlayLabelTree({canonical: canonical.scalingLevelDice, localized: localized.scalingLevelDice});
			}

			if (canonical.time && localized.time) out.time = this._overlayTimes({canonical: canonical.time, localized: localized.time});

			Object.defineProperty(out, "_i18nCanonical", {
				value: canonical,
				configurable: false,
				enumerable: false,
				writable: false,
			});
			return out;
		}

		static async pApplyEntities ({prop, file, entities, fnLoad = null}) {
			if (!Array.isArray(entities)) return entities;
			const folder = this._PROP_TO_FOLDER.get(prop);
			if (!folder || typeof file !== "string") return this._copy(entities);

			const sidecar = await this._pLoadFile({folder, file, fnLoad});
			const localizedIndex = this._getLocalizedIndex({prop, sidecar});
			if (!localizedIndex.size) return this._copy(entities);

			return entities.map(entity => {
				const canonical = this.getCanonicalEntity(entity);
				const key = this._getEntityKey({prop, name: canonical?.name, source: canonical?.source});
				const localized = key ? localizedIndex.get(key) : null;
				return localized ? this._getLocalizedEntity({canonical, localized}) : this._copy(canonical);
			});
		}

		static getCanonicalEntity (entity) {
			return entity?._i18nCanonical || entity;
		}

		static getCanonicalName (entity) {
			return this.getCanonicalEntity(entity)?.name || "";
		}

		static getDisplayName (entity) {
			return entity?._displayName || entity?.name || "";
		}

		static _renderSpellText (text, {isPlainText = false} = {}) {
			if (typeof text !== "string") return "";
			if (isPlainText) return root.Renderer?.stripTags ? root.Renderer.stripTags(text) : text;
			return root.Renderer?.get ? root.Renderer.get().render(text) : text;
		}

		static _joinOr (parts) {
			return parts.filter(Boolean).join("或");
		}

		static getSpellSchool (school) {
			return this._SPELL_SCHOOLS[school] || school || "未知學派";
		}

		static getSpellSchoolAndSubschools (school, subschools) {
			const base = this.getSpellSchool(school);
			if (!subschools?.length) return base;
			return `${base}（${subschools.map(it => this.getSpellSchool(it)).join("、")}）`;
		}

		static getSpellLevel (level, {isIncludeWord = false} = {}) {
			if (level === 0) return "戲法";
			return `${level}環${isIncludeWord ? "法術" : ""}`;
		}

		static getSpellLevelSchoolMeta (spell, {styleHint = "classic"} = {}) {
			const partsMeta = [];
			if (styleHint === "classic" && spell.meta?.ritual) partsMeta.push("儀式");
			if (spell.meta?.technomagic) partsMeta.push("科技魔法");
			const subschools = spell.subschools?.length ? `；${spell.subschools.map(it => this.getSpellSchool(it)).join("、")}` : "";
			return `${this.getSpellLevel(spell.level)}${this.getSpellSchool(spell.school)}系${subschools}${partsMeta.length ? `（${partsMeta.join("；")}）` : ""}`;
		}

		static getSpellTimeUnit (unit) {
			return this._SPELL_TIME_UNITS[unit] || unit || "特殊";
		}

		static getSpellTime (time, {isShort = false, isPlainText = false} = {}) {
			if (!time) return "特殊";
			const unit = this.getSpellTimeUnit(time.unit);
			const base = isShort && time.number === 1 && ["action", "bonus", "reaction", "round"].includes(time.unit)
				? unit
				: `${time.number || ""}${time.number ? "個" : ""}${unit}`;
			const condition = time.condition ? `，${this._renderSpellText(time.condition, {isPlainText})}` : "";
			const note = time.note ? `（${this._renderSpellText(time.note, {isPlainText})}）` : "";
			return `${base}${condition}${note}`;
		}

		static getSpellTimeList (times, meta, {styleHint = "classic", isPlainText = false} = {}) {
			const out = (times || []).map(time => this.getSpellTime(time, {isPlainText}));
			if (styleHint !== "classic" && meta?.ritual) out.push("儀式");
			return this._joinOr(out);
		}

		static getSpellRangeType (type) {
			return this._SPELL_RANGE_TYPES[type] || type || "特殊";
		}

		static getSpellDistanceUnit (type) {
			return this._SPELL_DISTANCE_UNITS[type] || type || "";
		}

		static _getSpellRangePoint (distance) {
			if (!distance) return "特殊";
			if (this._SPELL_RANGE_TYPES[distance.type]) return this.getSpellRangeType(distance.type);
			return `${distance.amount ?? ""}${this.getSpellDistanceUnit(distance.type)}` || "特殊";
		}

		static getSpellRange (range, {styleHint = "classic", isDisplaySelfArea = false} = {}) {
			if (!range) return "特殊";
			if (range.type === "special") return "特殊";
			if (range.type === "point") return this._getSpellRangePoint(range.distance);
			if (styleHint !== "classic" && !isDisplaySelfArea) return "自身";

			const distance = range.distance || {};
			const size = `${distance.amount ?? ""}${this.getSpellDistanceUnit(distance.type)}`;
			const shape = {
				line: "直線",
				cube: "立方",
				cone: "錐狀",
				emanation: "光環",
				radius: "半徑",
				sphere: "半徑球形",
				hemisphere: "半徑半球",
				cylinder: "半徑柱狀",
			}[range.type] || this.getSpellRangeType(range.type);
			const height = range.type === "cylinder" && distance.amountSecondary != null
				? `、高${distance.amountSecondary}${this.getSpellDistanceUnit(distance.typeSecondary)}`
				: "";
			return `自身（${size}${shape}${height}）`;
		}

		static getSpellComponents (components, level, {isPlainText = false} = {}) {
			if (!components) return "無";
			const out = [];
			if (components.v) out.push("V");
			if (components.s) out.push("S");
			if (components.m != null) {
				const material = components.m?.text != null ? components.m.text : components.m;
				out.push(`M${material === true ? "" : `（${this._renderSpellText(material, {isPlainText})}）`}`);
			}
			if (components.r) out.push(`R（${level} gp）`);
			return out.join("、") || "無";
		}

		static getSpellDuration (durations, {isPlainText = false} = {}) {
			let hasNestedOr = false;
			const parts = (durations || []).map(duration => {
				const condition = duration.condition ? `（${this._renderSpellText(duration.condition, {isPlainText})}）` : "";
				switch (duration.type) {
					case "special": return `${duration.concentration ? "專注" : "特殊"}${condition}`;
					case "instant": return `立即${condition}`;
					case "timed": {
						const amount = duration.duration?.amount ?? "";
						const unit = this._SPELL_DURATION_UNITS[duration.duration?.type] || duration.duration?.type || "";
						const upTo = duration.concentration || duration.duration?.upTo ? "至多" : "";
						return `${duration.concentration ? "專注，" : ""}${upTo}${amount}${unit}${condition}`;
					}
					case "permanent": {
						if (!duration.ends?.length) return `永久${condition}`;
						const ends = duration.ends.map(it => ({dispel: "被解除", trigger: "被觸發", discharge: "被釋放"}[it] || it));
						hasNestedOr = hasNestedOr || ends.length > 1;
						return `直到${this._joinOr(ends)}${condition}`;
					}
					default: return `特殊${condition}`;
				}
			});
			const separator = hasNestedOr ? "；或" : "或";
			return `${parts.filter(Boolean).join(separator)}${parts.length > 1 ? "（詳見下文）" : ""}`;
		}

		static getAbility (ability) {
			return this._ABILITIES[ability] || ability || "";
		}

		static getDamageType (type) {
			return this._DAMAGE_TYPES[type] || type || "";
		}

		static getCondition (condition) {
			return this._CONDITIONS[`${condition || ""}`.split("|")[0].toLowerCase()] || `${condition || ""}`.split("|")[0];
		}

		static getCreatureType (type) {
			return this._CREATURE_TYPES[type] || type || "";
		}

		static getSpellAttackType (type) {
			return ({M: "近戰", R: "遠端", O: "其他／未知"})[type] || type;
		}

		static getSpellAreaType (type) {
			return this._SPELL_AREA_TYPES[type] || type;
		}

		static getSpellMiscTag (type) {
			return this._SPELL_MISC_TAGS[type] || this.getSpellFilterLabel(type);
		}

		static getSpellFilterLabel (label) {
			return this._SPELL_FILTER_LABELS[label] || label;
		}
	}

	root.I18nZhTwContent = I18nZhTwContent;
})();
