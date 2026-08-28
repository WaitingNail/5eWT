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
			str: "力量",
			dex: "敏捷",
			con: "體質",
			int: "智力",
			wis: "感知",
			cha: "魅力",
			strength: "力量",
			dexterity: "敏捷",
			constitution: "體質",
			intelligence: "智力",
			wisdom: "感知",
			charisma: "魅力",
		};

		static _SKILLS = {
			acrobatics: "特技",
			"animal handling": "馴獸",
			arcana: "奧秘",
			athletics: "運動",
			deception: "欺瞞",
			history: "歷史",
			insight: "洞悉",
			intimidation: "威嚇",
			investigation: "調查",
			medicine: "醫藥",
			nature: "自然",
			perception: "察覺",
			performance: "表演",
			persuasion: "遊說",
			religion: "宗教",
			"sleight of hand": "巧手",
			stealth: "隱匿",
			survival: "求生",
		};

		static _LANGUAGES = {
			abyssal: "深淵語",
			celestial: "天界語",
			choose: "自選",
			common: "通用語",
			"deep speech": "地底深語",
			draconic: "龍語",
			dwarvish: "矮人語",
			elvish: "精靈語",
			giant: "巨人語",
			gnomish: "侏儒語",
			goblin: "地精語",
			halfling: "半身人語",
			infernal: "煉獄語",
			orc: "獸人語",
			other: "其他",
			primordial: "原初語",
			sylvan: "木族語",
			undercommon: "地底通用語",
			anystandard: "任一標準語言",
			anyexotic: "任一奇異語言",
			anyrare: "任一稀有語言",
			anylanguage: "任一語言",
		};

		static _SIZES_FULL = {
			F: "極微型",
			D: "微型",
			T: "微型",
			S: "小型",
			M: "中型",
			L: "大型",
			H: "巨型",
			G: "超巨型",
			C: "超巨型",
			V: "不定",
		};

		static _SIZES_SHORT = {
			F: "極微",
			D: "微",
			T: "微",
			S: "小",
			M: "中",
			L: "大",
			H: "巨",
			G: "超巨",
			C: "超巨",
			V: "不定",
		};

		static _FEAT_CATEGORIES = {
			D: "龍紋",
			DG: "黑暗恩賜",
			G: "一般",
			O: "起源",
			FS: "戰鬥風格",
			"FS:P": "戰鬥風格替換（聖武士）",
			"FS:R": "戰鬥風格替換（遊俠）",
			EB: "傳奇恩賜",
			Other: "其他",
		};

		static _OPTIONAL_FEATURE_TYPES = {
			AI: "奇械師注法",
			ED: "元素宗派",
			EI: "魔能祈喚",
			MM: "超魔法",
			MV: "戰技",
			"MV:B": "戰技（戰鬥大師）",
			"MV:C2-UA": "戰技（騎士 V2，UA）",
			"AS:V1-UA": "奧術射擊 V1（UA）",
			"AS:V2-UA": "奧術射擊 V2（UA）",
			AS: "奧術射擊",
			OTH: "其他",
			"FS:F": "戰鬥風格（戰士）",
			"FS:B": "戰鬥風格（吟遊詩人）",
			"FS:P": "戰鬥風格（聖武士）",
			"FS:R": "戰鬥風格（遊俠）",
			PB: "契約恩賜",
			OR: "命名術共鳴",
			RN: "符文騎士符文",
			AF: "煉金配方",
			TT: "旅者訣竅",
			RP: "聲望福利",
		};

		static _FILTER_LABELS = {
			"Ability": "屬性",
			"Ability Bonus": "屬性加值",
			"Ability Scores": "屬性值",
			"Ability Scores (Including Subspecies)": "屬性值（含亞種）",
			"Additional Spells": "額外法術",
			"Adult Age": "成年年齡",
			"Amphibious": "兩棲",
			"Any": "任意",
			"Any From Category": "該類別任一項",
			"Armor Proficiencies": "護甲熟練",
			"Armor Proficiency": "護甲訓練",
			"Base Species": "基礎種族",
			"Benefits": "增益",
			"Blindsight": "盲視",
			"Category": "類別",
			"Choose": "自選",
			"Climb": "攀爬",
			"Condition Immunity": "狀態免疫",
			"Creature Type": "生物類型",
			"Damage": "傷害",
			"Damage Immunity": "傷害免疫",
			"Damage Resistance": "傷害抗性",
			"Darkvision": "黑暗視覺",
			"Dragonmark": "龍紋",
			"Feat": "專長",
			"Feats": "專長",
			"Feature": "特性",
			"Feature Type": "特性類型",
			"Fly": "飛行",
			"Grants Additional Spells": "賦予額外法術",
			"Has Images": "有圖片",
			"Has Info": "有資訊",
			"Improved Resting": "強化休息",
			"Key Species": "主要種族",
			"Language Proficiency": "語言熟練",
			"Language Proficiencies": "語言熟練項",
			"Languages": "語言",
			"Legacy": "舊版",
			"Level": "等級",
			"Lineage": "血統",
			"Miscellaneous": "雜項",
			"Modified Copy": "修改版複本",
			"Monstrous Race": "怪物種族",
			"Monstrous Species": "怪物種族",
			"Natural Armor": "天生護甲",
			"Natural Weapon": "天生武器",
			"None": "無",
			"Not Repeatable": "不可重複選擇",
			"NPC Race": "NPC 種族",
			"NPC Species": "NPC 種族",
			"Other": "其他",
			"Other Benefits": "其他增益",
			"Otherworldly Patron": "異界宗主",
			"Pact Boon": "契約恩賜",
			"Powerful Build": "強力體格",
			"Prerequisite": "先決條件",
			"Proficiency": "熟練",
			"Psionics": "靈能",
			"Reprinted": "已重印",
			"Repeatable": "可重複選擇",
			"Size": "體型",
			"Skill Proficiencies": "技能熟練項",
			"Skill Proficiency": "技能熟練",
			"Special": "特殊",
			"Speed": "速度",
			"Spell": "法術",
			"Spellcasting": "施法",
			"Superior Darkvision": "高等黑暗視覺",
			"Sunlight Sensitivity": "陽光敏感",
			"Swim": "游泳",
			"Tool Proficiencies": "工具熟練項",
			"Tool Proficiency": "工具熟練",
			"Traits": "特質",
			"Uncommon Race": "罕見種族",
			"Uncommon Species": "罕見種族",
			"Vulnerability": "易傷",
			"Resistance": "抗性",
			"Immunity": "免疫",
			"Walk": "步行",
			"Walk (Fast)": "步行（快速）",
			"Walk (Slow)": "步行（緩慢）",
			"Weapon Proficiencies": "武器熟練",
			"Weapon Proficiency": "武器熟練",
		};

		static _DAMAGE_TYPES = {
			A: "強酸",
			B: "鈍擊",
			C: "寒冷",
			F: "火焰",
			L: "閃電",
			N: "暗蝕",
			P: "穿刺",
			S: "揮砍",
			T: "雷鳴",
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

		static _ITEM_RARITIES = {
			none: "無稀有度",
			common: "普通",
			uncommon: "非普通",
			rare: "稀有",
			"very rare": "極稀有",
			legendary: "傳奇",
			artifact: "神器",
			varies: "不定",
			"unknown (magic)": "未知（魔法）",
			unknown: "未知",
		};

		static _ITEM_RARITIES_SHORT = {
			common: "普通",
			uncommon: "非普",
			rare: "稀有",
			"very rare": "極稀",
			legendary: "傳奇",
			artifact: "神器",
			varies: "不定",
		};

		static _ITEM_TIERS = {
			none: "無",
			minor: "次要",
			major: "主要",
		};

		static _ITEM_WEAPON_CATEGORIES = {
			simple: "簡易武器",
			martial: "軍用武器",
		};

		static _ITEM_POISON_TYPES = {
			contact: "接觸型",
			ingested: "攝入型",
			inhaled: "吸入型",
			injury: "傷口型",
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
			["race", "character-options"],
			["subrace", "character-options"],
			["raceFluff", "character-options"],
			["background", "character-options"],
			["backgroundFluff", "character-options"],
			["feat", "character-options"],
			["featFluff", "character-options"],
			["optionalfeature", "character-options"],
			["optionalfeatureFluff", "character-options"],
			["item", "items"],
			["itemGroup", "items"],
			["baseitem", "items"],
			["itemProperty", "items"],
			["itemType", "items"],
			["itemTypeAdditionalEntries", "items"],
			["itemEntry", "items"],
			["itemMastery", "items"],
			["magicvariant", "items"],
			["itemFluff", "items"],
			["monster", "bestiary"],
			["monsterFluff", "bestiary"],
			["legendaryGroup", "bestiary"],
		]);

		static _FILE_TO_PROPS = new Map([
			["races.json", ["race", "subrace"]],
			["fluff-races.json", ["raceFluff"]],
			["backgrounds.json", ["background"]],
			["fluff-backgrounds.json", ["backgroundFluff"]],
			["feats.json", ["feat"]],
			["fluff-feats.json", ["featFluff"]],
			["optionalfeatures.json", ["optionalfeature"]],
			["fluff-optionalfeatures.json", ["optionalfeatureFluff"]],
			["items.json", ["item", "itemGroup"]],
			["items-base.json", ["baseitem", "itemProperty", "itemType", "itemTypeAdditionalEntries", "itemEntry", "itemMastery"]],
			["magicvariants.json", ["magicvariant"]],
			["fluff-items.json", ["itemFluff"]],
			["bestiary/legendarygroups.json", ["legendaryGroup"]],
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

		static _getEntityKey ({prop, entity}) {
			if (!prop || !entity || typeof entity !== "object") return null;
			const name = (() => {
				switch (prop) {
					case "itemProperty":
					case "itemType": return entity.abbreviation ?? entity.ENG_name ?? entity.name ?? "";
					default: return entity.ENG_name ?? entity.name ?? "";
				}
			})();
			if (typeof name !== "string") return null;
			const source = entity.source ?? (prop === "magicvariant" ? entity.inherits?.source : null);
			if (typeof source !== "string") return null;
			const parts = [prop, name, source];
			if (prop === "subrace") parts.push(entity.raceName || "", entity.raceSource || "");
			return parts.map(it => `${it}`.trim().toLowerCase()).join("\u0000");
		}

		static async _pFetchJson (url) {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
			return response.json();
		}

		static _mergeSidecars (sidecars) {
			const out = {};
			for (const sidecar of sidecars) {
				if (!sidecar || typeof sidecar !== "object") continue;
				if (!out._meta && sidecar._meta) out._meta = this._copy(sidecar._meta);
				for (const [prop, entities] of Object.entries(sidecar)) {
					if (prop === "_meta" || !Array.isArray(entities)) continue;
					(out[prop] ||= []).push(...entities);
				}
			}
			return out;
		}

		static async _pLoadFile ({folder, file, fnLoad = null}) {
			const fileClean = folder === "bestiary" ? file.split("/").at(-1) : file;
			const cacheKey = `${folder}/${fileClean}`;
			const url = `${this._getBaseUrl()}data/zh-TW/${cacheKey}`;
			if (fnLoad) return fnLoad({folder, file: fileClean, url});

			if (!this._pFileCache.has(cacheKey)) {
				this._pFileCache.set(cacheKey, (async () => {
					try {
						if (folder === "items" && file === "items.json") {
							const index = await this._pFetchJson(`${this._getBaseUrl()}data/zh-TW/items/index.json`);
							const chunkFiles = index?.fileChunks?.[file];
							if (!Array.isArray(chunkFiles) || !chunkFiles.length) throw new Error("Missing items.json chunk manifest");
							const sidecars = await Promise.all(chunkFiles.map(chunkFile => this._pFetchJson(`${this._getBaseUrl()}data/zh-TW/items/${chunkFile}`)));
							return this._mergeSidecars(sidecars);
						}
						return await this._pFetchJson(url);
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
				const key = this._getEntityKey({prop, entity});
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

		static _getLocalizedEntity ({prop, canonical, localized}) {
			const out = this._copy(canonical);
			if (typeof localized.name === "string" && localized.name !== canonical.name) out._displayName = localized.name;

			if (prop === "monster") {
				for (const key of [
					"trait",
					"action",
					"bonus",
					"reaction",
					"legendary",
					"mythic",
					"variant",
					"spellcasting",
					"resource",
					"legendaryHeader",
					"mythicHeader",
				]) {
					if (!(key in canonical) || !(key in localized)) continue;
					out[key] = this._copy(localized[key]);
				}

				for (const [key, displayKey] of [
					["ac", "_displayAc"],
					["hp", "_displayHp"],
					["speed", "_displaySpeed"],
					["languages", "_displayLanguages"],
					["vulnerable", "_displayVulnerable"],
					["resist", "_displayResist"],
					["immune", "_displayImmune"],
					["conditionImmune", "_displayConditionImmune"],
				]) {
					if (!(key in canonical) || !(key in localized)) continue;
					out[displayKey] = this._copy(localized[key]);
				}

				if (canonical._copy && localized._copy) out._copy = this._copy(localized._copy);

				if (out.legendary?.length && !out.legendaryHeader) {
					const uses = out.legendaryActions || 3;
					const usesLair = out.legendaryActionsLair || uses;
					const name = out._displayName || out.name;
					out.legendaryHeader = [
						`${name}可以採取${uses}次傳奇動作${usesLair !== uses ? `（位於巢穴中時為${usesLair}次）` : ""}，並從下列選項中選擇。一次只能使用一個傳奇動作，且只能在另一個生物的回合結束時使用。${name}會在自己回合開始時恢復已消耗的傳奇動作次數。`,
					];
				}
			}

			if (prop === "legendaryGroup") {
				for (const key of ["lairActions", "regionalEffects", "mythicEncounter", "additionalEntries"]) {
					if (!(key in canonical) || !(key in localized)) continue;
					out[key] = this._copy(localized[key]);
				}
			}

			for (const key of ["entries", "entriesHigherLevel", "additionalEntries", "entriesTemplate"]) {
				if (!(key in canonical) || !(key in localized)) continue;
				out[key] = this._overlayContentValue({canonical: canonical[key], localized: localized[key]});
			}

			for (const [key, displayKey] of [
				["reqAttune", "_displayReqAttune"],
				["reqAttuneAlt", "_displayReqAttuneAlt"],
				["detail1", "_displayDetail1"],
			]) {
				if (typeof canonical[key] === "string" && typeof localized[key] === "string") out[displayKey] = localized[key];
			}

			if (prop === "itemProperty" && typeof canonical.template === "string" && typeof localized.template === "string") {
				out.template = localized.template;
			}

			if (prop === "magicvariant" && canonical.inherits && localized.inherits) {
				out.inherits = this._copy(canonical.inherits);
				for (const key of ["entries", "additionalEntries", "entriesTemplate"]) {
					if (!(key in canonical.inherits) || !(key in localized.inherits)) continue;
					out.inherits[key] = this._overlayContentValue({canonical: canonical.inherits[key], localized: localized.inherits[key]});
				}
				out._i18nDisplayInherits = {};
				for (const key of ["namePrefix", "nameSuffix", "nameRemove", "reqAttune", "detail1"]) {
					if (typeof localized.inherits[key] !== "string") continue;
					out._i18nDisplayInherits[key] = localized.inherits[key];
				}
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
				const key = this._getEntityKey({prop, entity: canonical});
				const localized = key ? localizedIndex.get(key) : null;
				return localized ? this._getLocalizedEntity({prop, canonical, localized}) : this._copy(canonical);
			});
		}

		static async pApplyDataFile ({file, data, fnLoad = null}) {
			const props = this._FILE_TO_PROPS.get(file);
			if (!props || !data || typeof data !== "object") return data;

			const folder = props.map(prop => this._PROP_TO_FOLDER.get(prop)).find(Boolean);
			if (!folder) return this._copy(data);
			const sidecar = await this._pLoadFile({folder, file, fnLoad});
			if (!sidecar) return this._copy(data);

			const out = this._copy(data);
			for (const prop of props) {
				if (!Array.isArray(data[prop])) continue;
				out[prop] = await this.pApplyEntities({
					prop,
					file,
					entities: data[prop],
					fnLoad: async () => sidecar,
				});
			}

			if (file === "items.json" && out.item?.length && out.itemGroup?.length) {
				const byName = new Map();
				for (const item of out.item) {
					const nameKey = `${item.name || ""}`.trim().toLowerCase();
					if (!byName.has(nameKey)) byName.set(nameKey, []);
					byName.get(nameKey).push(item);
				}
				for (const group of out.itemGroup) {
					if (!Array.isArray(group.items)) continue;
					group._displayItems = group.items.map(ref => {
						const rawName = typeof ref === "string" ? ref.split("|")[0] : ref?.name;
						const rawSource = typeof ref === "string" ? ref.split("|")[1] : ref?.source;
						const candidates = byName.get(`${rawName || ""}`.trim().toLowerCase()) || [];
						const match = rawSource
							? candidates.find(it => `${it.source || ""}`.toLowerCase() === rawSource.toLowerCase())
							: candidates.find(it => it.source === "DMG") || candidates[0];
						return match?._displayName || rawName || "";
					});
				}
			}

			if (file === "fluff-races.json" && data.raceFluffMeta && sidecar.raceFluffMeta) {
				out.raceFluffMeta = this._copy(data.raceFluffMeta);
				for (const [key, canonical] of Object.entries(data.raceFluffMeta)) {
					if (!(key in sidecar.raceFluffMeta)) continue;
					out.raceFluffMeta[key] = this._overlayContentValue({canonical, localized: sidecar.raceFluffMeta[key]});
				}
			}

			return out;
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
			return this._ABILITIES[`${ability || ""}`.toLowerCase()] || ability || "";
		}

		static getSkill (skill) {
			return this._SKILLS[`${skill || ""}`.split("|")[0].toLowerCase()] || `${skill || ""}`.split("|")[0];
		}

		static getLanguage (language) {
			return this._LANGUAGES[`${language || ""}`.split("|")[0].replaceAll(" ", "").toLowerCase()]
				|| this._LANGUAGES[`${language || ""}`.split("|")[0].toLowerCase()]
				|| `${language || ""}`.split("|")[0];
		}

		static getSizeFull (size) {
			return this._SIZES_FULL[size] || size || "";
		}

		static getSizeShort (size) {
			return this._SIZES_SHORT[size] || size || "";
		}

		static getFeatCategory (category) {
			return this._FEAT_CATEGORIES[category] || category || "其他";
		}

		static getOptionalFeatureType (type) {
			return this._OPTIONAL_FEATURE_TYPES[type] || type || "其他";
		}

		static getFilterLabel (label) {
			return this._FILTER_LABELS[label] || label || "";
		}

		static _replaceVisibleText (text, replacements) {
			const replacePart = part => replacements.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), part);
			if (!text.includes("<")) return replacePart(text);
			return text
				.split(/(<[^>]*>)/g)
				.map(part => part.startsWith("<") ? part : replacePart(part))
				.join("");
		}

		static localizeAbilityText (text) {
			if (typeof text !== "string") return text;
			const replacements = [
				[/Ability Scores?/gi, "屬性值"],
				[/Choose one of:/gi, "選擇其一："],
				[/Any Other/gi, "任一其他屬性"],
				[/Origin\s*\(Any\)/gi, "出身（任意）"],
				[/Any(?=\s*[+−-]\s*\d)/gi, "任一屬性"],
				[/Origin/gi, "出身"],
				[/Lineage/gi, "血統"],
				[/None/gi, "無"],
				[/Strength|\bStr\b/gi, "力量"],
				[/Dexterity|\bDex\b/gi, "敏捷"],
				[/Constitution|\bCon\b/gi, "體質"],
				[/Intelligence|\bInt\b/gi, "智力"],
				[/Wisdom|\bWis\b/gi, "感知"],
				[/Charisma|\bCha\b/gi, "魅力"],
			];
			return this._replaceVisibleText(text, replacements);
		}

		static localizeSkillText (text) {
			if (typeof text !== "string") return text;
			const replacements = Object.entries(this._SKILLS)
				.sort(([a], [b]) => b.length - a.length)
				.map(([english, translated]) => [new RegExp(`\\b${english.replaceAll(" ", "\\s+")}\\b`, "gi"), translated]);
			replacements.unshift(
				[/Choose\s+(one|two|three|four)\s*:\s*/gi, (_, count) => `自選${({one: "一", two: "二", three: "三", four: "四"})[count.toLowerCase()] || count}項：`],
				[/Any Skill/gi, "任一技能"],
				[/Any/gi, "任意"],
				[/None/gi, "無"],
			);
			return this._replaceVisibleText(text, replacements);
		}

		static localizeSpeedText (text) {
			if (typeof text !== "string") return text;
			return this._replaceVisibleText(text, [
				[/\bwalk(?:ing)?\b/gi, "步行"],
				[/\bclimb(?:ing)?\b/gi, "攀爬"],
				[/\bfly(?:ing)?\b/gi, "飛行"],
				[/\bswim(?:ming)?\b/gi, "游泳"],
				[/\bburrow(?:ing)?\b/gi, "掘穴"],
				[/\bhover\b/gi, "懸浮"],
				[/\bft\.(?=\s|[;,]|$)|\bft\b/gi, "尺"],
				[/\bfeet\b/gi, "尺"],
			]);
		}

		static localizeCreatureTypeText (text) {
			if (typeof text !== "string") return text;
			const replacements = Object.entries(this._CREATURE_TYPES)
				.sort(([a], [b]) => b.length - a.length)
				.map(([english, translated]) => [new RegExp(`\\b${english}s?\\b`, "gi"), translated]);
			replacements.push([/\bor\b/gi, "或"]);
			return this._replaceVisibleText(text, replacements);
		}

		static localizeMonsterMetaText (text) {
			if (typeof text !== "string") return text;
			const replacements = [
				[/\bgargantuan\b/gi, "超巨型"],
				[/\bhuge\b/gi, "巨型"],
				[/\blarge\b/gi, "大型"],
				[/\bmedium\b/gi, "中型"],
				[/\bsmall\b/gi, "小型"],
				[/\btiny\b/gi, "微型"],
				[/\btypically\b/gi, "通常"],
				[/\bany alignment\b/gi, "任意陣營"],
				[/\bunaligned\b/gi, "無陣營"],
				[/\blawful good\b/gi, "守序善良"],
				[/\bneutral good\b/gi, "中立善良"],
				[/\bchaotic good\b/gi, "混亂善良"],
				[/\blawful neutral\b/gi, "守序中立"],
				[/\bneutral evil\b/gi, "中立邪惡"],
				[/\bchaotic neutral\b/gi, "混亂中立"],
				[/\blawful evil\b/gi, "守序邪惡"],
				[/\bchaotic evil\b/gi, "混亂邪惡"],
				[/\bneutral\b/gi, "絕對中立"],
				[/\bnatural armor\b/gi, "天生護甲"],
				[/\bshield\b/gi, "盾牌"],
				[/\bpassive Perception\b/gi, "被動察覺"],
				[/\bblindsight\b/gi, "盲視"],
				[/\bdarkvision\b/gi, "黑暗視覺"],
				[/\btremorsense\b/gi, "震顫感知"],
				[/\btruesight\b/gi, "真實視覺"],
				[/\btelepathy\b/gi, "心靈感應"],
				[/\bft\.(?=\s|[;,]|$)|\bft\b/gi, "尺"],
				[/\band\b/gi, "與"],
				[/\bor\b/gi, "或"],
			];
			for (const [english, translated] of Object.entries({...this._CREATURE_TYPES, ...this._DAMAGE_TYPES, ...this._CONDITIONS})) {
				// The damage table also contains one-letter canonical rule codes (for
				// example, `A` for acid). Those codes are data identifiers, not visible
				// English, and replacing them case-insensitively would corrupt ordinary
				// prose such as the article "a".
				if (english.length < 3 || english !== english.toLowerCase()) continue;
				replacements.push([new RegExp(`\\b${english}s?\\b`, "gi"), translated]);
			}
			for (const [english, translated] of Object.entries({...this._ABILITIES, ...this._SKILLS, ...this._LANGUAGES})) {
				if (english.length < 3) continue;
				replacements.push([new RegExp(`\\b${english.replaceAll(" ", "\\s+")}\\b`, "gi"), translated]);
			}
			return this.localizeSpeedText(this._replaceVisibleText(text, replacements));
		}

		static localizeRulesText (text) {
			if (typeof text !== "string") return text;
			const replacements = [
				[/Prerequisites?:/gi, "先決條件："],
				[/\bLvl\s+(\d+)/gi, "$1級"],
				[/\bLevel\s+(\d+)\+/gi, "$1級以上"],
				[/\bLevel\s+(\d+)/gi, "$1級"],
				[/\(No Class\)/gi, "（無職業）"],
				[/Pact of the Blade/gi, "魔刃魔契"],
				[/Pact of the Chain/gi, "鎖鏈魔契"],
				[/Pact of the Talisman/gi, "護符魔契"],
				[/Pact of the Tome/gi, "魔典魔契"],
				[/Any Dragonmark Feat/gi, "任一龍紋專長"],
				[/Any Dark Gift Feat/gi, "任一黑暗恩賜專長"],
				[/Any General Feat/gi, "任一一般專長"],
				[/Any Origin Feat/gi, "任一起源專長"],
				[/Any Fighting Style Feat/gi, "任一戰鬥風格專長"],
				[/Any Epic Boon Feat/gi, "任一傳奇恩賜專長"],
				[/The ability to cast at least one spell/gi, "能夠施展至少一個法術"],
				[/Spellcasting or Pact Magic Feature/gi, "施法或契約魔法特性"],
				[/Spellcasting Feature/gi, "施法特性"],
				[/Psionic Talent feature or Wild Talent feat/gi, "靈能天賦特性或荒野天賦專長"],
				[/ or higher/gi, "以上"],
				[/Spellcasting Focus/gi, "施法法器"],
				[/Spellcasting/gi, "施法"],
				[/Psionics/gi, "靈能"],
				[/Proficiency/gi, "熟練"],
				[/Special/gi, "特殊"],
			];
			return this.localizeAbilityText(this._replaceVisibleText(text, replacements));
		}

		static getDamageType (type) {
			return this._DAMAGE_TYPES[type] || type || "";
		}

		static getItemRarity (rarity) {
			return this._ITEM_RARITIES[rarity] || rarity || "";
		}

		static getItemRarityShort (rarity) {
			return this._ITEM_RARITIES_SHORT[rarity] || this.getItemRarity(rarity);
		}

		static getItemTier (tier) {
			return this._ITEM_TIERS[tier] || tier || "";
		}

		static getItemWeaponCategory (category) {
			return this._ITEM_WEAPON_CATEGORIES[`${category || ""}`.toLowerCase()] || `${category || ""}`;
		}

		static getItemPoisonType (type) {
			return this._ITEM_POISON_TYPES[`${type || ""}`.toLowerCase()] || `${type || ""}`;
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
