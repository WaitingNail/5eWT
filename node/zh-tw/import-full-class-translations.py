#!/usr/bin/env python3
"""Build safe zh-TW Class sidecars from a structurally matching translated 5etools tree.

The translated source mutates display names and reference fields. This importer always
starts from the pinned English v2.33.3 entity, copies only user-visible text, converts
Simplified Chinese with OpenCC ``s2twp``, and reconstructs inline reference tags with
their original English canonical keys.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import urllib.request
from collections import defaultdict
from copy import deepcopy
from pathlib import Path

try:
	from opencc import OpenCC
except ImportError as exc:  # pragma: no cover - dependency error is user-facing
	raise SystemExit(
		"Missing opencc-python-reimplemented. Install with: "
		"python -m pip install opencc-python-reimplemented"
	) from exc


ROOT = Path(__file__).resolve().parents[2]
UPSTREAM_DIR = ROOT / "data" / "class"
OUTPUT_DIR = ROOT / "data" / "zh-TW" / "class"
CACHE_DIR = ROOT / "translation" / "zh-TW" / "classes" / ".cache" / "shuaishuaidnd"
TERMS_PATH = ROOT / "translation" / "zh-TW" / "classes" / "generated" / "class-terms.csv"
MEMORY_PATH = ROOT / "translation" / "zh-TW" / "classes" / "translation-memory.csv"
FULL_GLOSSARY_PATH = ROOT / "translation" / "zh-TW" / "classes" / "generated" / "class-terms-full.csv"
REPORT_PATH = ROOT / "translation" / "zh-TW" / "classes" / "generated" / "full-class-import-report.json"
CORRECTIONS_DIR = ROOT / "translation" / "zh-TW" / "classes" / "manual-corrections"
SOURCE_BASE_URL = "https://shuaishuaidnd.cn/data/class"

TOP_LEVEL_PROPS = (
	"class",
	"subclass",
	"classFeature",
	"subclassFeature",
	"classFluff",
	"subclassFluff",
)

DIRECT_VISIBLE_KEYS = {
	"name",
	"shortName",
	"subclassTitle",
	"caption",
	"title",
	"label",
	"by",
	"goldAlternative",
}
CONTENT_CONTAINER_KEYS = {
	"entries",
	"entry",
	"items",
	"footnotes",
	"headerEntries",
	"footerEntries",
	"default",
	"colLabels",
	"rowLabels",
	"rows",
	"tables",
}
NAMED_STRUCTURE_KEYS = {
	"classTableGroups",
	"subclassTableGroups",
	"optionalfeatureProgression",
	"featProgression",
	"additionalSpells",
	"fluff",
}
CANONICAL_KEYS = {
	"type",
	"source",
	"page",
	"className",
	"classSource",
	"subclassShortName",
	"subclassSource",
	"classFeature",
	"subclassFeature",
	"classFeatures",
	"subclassFeatures",
	"optionalfeature",
	"item",
	"spell",
	"feat",
	"background",
	"race",
	"creature",
	"condition",
	"variantrule",
	"reprintedAs",
	"defaultData",
	"featureType",
	"colStyles",
	"rowStyles",
	"style",
	"href",
	"path",
	"url",
}

REFERENCE_TAGS = {
	"action",
	"background",
	"boon",
	"charoption",
	"class",
	"condition",
	"creature",
	"creatureFluff",
	"cult",
	"deck",
	"deity",
	"disease",
	"facility",
	"feat",
	"hazard",
	"item",
	"itemMastery",
	"itemProperty",
	"language",
	"legroup",
	"object",
	"optfeature",
	"optionalfeature",
	"psionic",
	"race",
	"raceFluff",
	"recipe",
	"reward",
	"sense",
	"skill",
	"spell",
	"status",
	"table",
	"trap",
	"variantrule",
	"vehicle",
	"vehupgrade",
}
SPECIAL_REFERENCE_TAG_DISPLAY_INDEX = {
	"deity": 3,
	"subclass": 4,
	"classFeature": 5,
	"subclassFeature": 7,
	"quickref": 4,
}
ADVANCED_REFERENCE_TAGS = {"subclass", "classFeature", "subclassFeature", "quickref"}
DISPLAY_FIRST_TAGS = {"filter", "5etools", "book", "adventure"}
TAG_RE = re.compile(r"\{@([A-Za-z0-9]+) ([^{}]*)}")
ASCII_WORD_RE = re.compile(r"[A-Za-z]{3,}")
HAN_RE = re.compile(r"[\u3400-\u9fff]")
ORDINAL_RE = re.compile(r"^(\d+)(?:st|nd|rd|th)$", re.IGNORECASE)
EXACT_VISIBLE_TRANSLATIONS = {
	"No": "否",
	"Yes": "是",
	"Varies": "視物品而定",
	"None": "無",
}

# The translated source contains a small number of prose fragments where a
# translated label is immediately followed by the original English label, or
# where a translated 5etools filter leaks its query text into the display. Keep
# these as exact, auditable substitutions rather than broad English-word
# removal, since English canonical keys inside inline tags must remain intact.
PROSE_CLEANUP_REPLACEMENTS = (
	("魔契師", "契術師"),
	("飛簷走壁", "疾步如風"),
	("飛檐走壁", "疾步如風"),
	("裡數", "英里數"),
	("6裡", "6英里"),
	("1裡", "1英里"),
	("一里", "1英里"),
	(" 偉力推動Mighty Impel 特性", "「偉力推動」特性"),
	(" 元素戰刃元素戰刃（Elemental Cleaver） 特性", "「元素戰刃」特性"),
	("鷹hawk或禿鷲vulture代替雕eagle", "鷹或禿鷲代替雕"),
	(" 魯莽攻擊魯莽攻擊（Reckless Attack） ", "「魯莽攻擊」"),
	(" 觸及Reach 屬性", "「觸及」屬性"),
	("野獸之形Form of Beast 特性", "「野獸之形」特性"),
	(" 精魂之盾精神之盾（Spirit Shield） ", "「精魂之盾」"),
	(" 炎熱Extreme Heat 的效應", "極端炎熱的效應"),
	(" 嚴寒Extreme Cold 的效應", "極端寒冷的效應"),
	(" 風暴靈光Storm Aura 特性", "「風暴靈光」特性"),
	(" 風暴靈光Storm Aura ", "「風暴靈光」"),
	(" 風暴之魂 Storm Soul 特性", "「風暴之魂」特性"),
	(" 坦帕斯Tempus ", "坦帕斯"),
	(" 海克斯託Hextor ", "海克斯託"),
	(" 厄瑞斯努Erythnul ", "厄瑞斯努"),
	("（Tale of the Clever Animal）", ""),
	("（Tale of the Renowned Duelist）", ""),
	("（Tale of the Beloved Friends）", "。"),
	("（Tale of the Runaway）", ""),
	("（Tale of the Avenger）", ""),
	("（Tale of theTraveler）", ""),
	("（Tale of the Phantom）", "。"),
	("（Tale of the Brute）", ""),
	("（Tale of the Dragon）", ""),
	("（Tale of the Mind-Bender）", ""),
	(" 刃鋒blades ", "「刃鋒」"),
	("（Beloved）", ""),
	("（Sharpshooter）", ""),
	("（Avenger）", ""),
	("（Renegade）", ""),
	("（Fortune Teller）", ""),
	("（Wayfarer）", ""),
	("（Trickster）", ""),
	("（Shade）", ""),
	("（Arsonist）", ""),
	("（Coward）", ""),
	("（Brute）", ""),
	("（Priest）", ""),
	("class=吟遊詩人中的法術", "{@filter 吟遊詩人法術列表|spells|class=Bard}中的法術"),
	("匹裡麻斯Pyremius", "匹裡麻斯"),
	("冥界underworld", "冥界"),
	(" 夏之王庭Summer Court ", "「夏之王庭」"),
	(" 暮之王庭Gloaming Court ", "「暮之王庭」"),
	(" 精魂圖騰Spirit Totem ", "「精魂圖騰」"),
	("type=簡易武器或type=軍用武器", "{@filter 簡易武器|items|type=simple weapon}或{@filter 軍用武器|items|type=martial weapon}"),
	("type=簡易武器;軍用武器", "{@filter 武器|items|type=simple weapon;martial weapon}"),
	("運用dunamis的技藝", "運用潛能的技藝"),
	(" 迴音顯現 顯化回聲（Manifest Echo） 特性", "「迴音顯現」特性"),
	(" 釋放化身 釋放化身（Unleash Incarnation） 特性", "「釋放化身」特性"),
	(" 回氣Second Wind 特性", "「回氣」特性"),
	(" 旗將Banneret", "「旗將」"),
	(" 動作如潮Action Surge 特性", "「動作如潮」特性"),
	(" 不屈Indomitable 特性", "「不屈」特性"),
	("（kalashtar）", ""),
	("（雙截棍nunchaku）", "（雙截棍）"),
	("（單鐮kama）", "（單鐮）"),
	(" 疾風連擊Flurry of Blows ", "「疾風連擊」"),
	(" 武藝Martial Arts 一列", "「武藝」一欄"),
	("\"吸血鬼伯爵施特拉德·馮·扎洛維奇吸血鬼伯爵斯特拉德·馮·扎洛維奇（Vampire Count Strahd von Zarovich）\"", "「吸血鬼伯爵斯特拉德·馮·扎洛維奇」"),
	("聖騎兵cavaliers、白騎士white knights或是聖戰士holy warriors", "聖騎士、白騎士或聖戰士"),
	("神聖誓言Sacred Oath 特性", "「神聖誓言」特性"),
	(" 神聖誓言Sacred Oath 特性", "「神聖誓言」特性"),
	("極地arctic、海岸coast、荒漠desert、叢林forest、草原grassland、山地mountain、沼澤swamp或幽暗地域Underdark", "極地、海岸、荒漠、森林、草原、山地、沼澤或幽暗地域"),
	("\"多重攻擊Multiattack\"動作項", "「多重攻擊」動作"),
	("塞爾Thay（被遺忘的國度）", "塞爾（被遺忘的國度）"),
	("坎納斯Karrnath（艾伯倫）", "坎納斯（艾伯倫）"),
	(" 偷襲偷襲（Sneak Attack）", "「偷襲」"),
	("魔術師（mage），治療者（healer）或奇才（prodigy）", "法師、治療者或奇才"),
	("克萊恩Krynn", "克萊恩"),
	("託瑞爾Toril世界", "託瑞爾世界"),
	("塞倫涅Selne", "塞倫涅"),
	("艾伯倫Eberron", "艾伯倫"),
	("巨龍預言Draconic Prophecy", "巨龍預言"),
	("滿月Full Moon、朔月New Moon，或新月Crescent Moon", "滿月、朔月或新月"),
	("綿羊sheep", "綿羊"),
	("機械境Machanus", "機械境"),
	(" 神聖魔法Divine Magic 特性", "「神聖魔法」特性"),
	(" 大暴雨Great Rain", "「大暴雨」"),
	("至高妖精Archfey、邪魔Fiend、舊日支配者Great Old One", "至高妖精、邪魔、舊日支配者"),
	("霜凍親王霜之王子（Prince of Frost）", "霜之王子"),
	("\"薄暮議會暮曦宮廷（Gloaming Court）\"的統治者空暗女王空氣與黑暗女王（Queen of Air and Darkness）", "「暮曦宮廷」的統治者「空氣與黑暗女王」"),
	("\"仲夏議會夏日宮廷（Summer Court）\"的泰坦尼婭提塔尼亞（Titania）和她的丈夫\"蒼翠之王Green Lord\"奧伯龍Oberon", "「夏日宮廷」的提塔尼亞和她的丈夫「蒼翠之王」奧伯龍"),
	("\"愚者親王Prince of Fools\"希爾薩姆赫爾薩姆（Hyrsam）", "「愚者親王」赫爾薩姆"),
	("狄摩高根Demogorgon、奧喀斯Orcus、弗拉茲厄魯Fraz-Urb'luu和巴弗滅Baphomet", "狄摩高根、奧喀斯、弗拉茲厄魯和巴弗滅"),
	("阿斯蒙蒂斯Asmodeus、迪斯帕特Dispater、墨菲斯托費利斯Mephistopheles和貝利亞Belial", "阿斯蒙蒂斯、迪斯帕特、墨菲斯托費利斯和貝利亞"),
	("這類存在包括被稱作\"潛伏者潛伏者（That Which Lurks）\"的關納德高納達爾（Ghaunadar）、\"受縛之神鎖鏈之神（Chained God）\"薩瑞茲頓薩里茲頓（Tharizdun）、\"暗夜巨蛇夜蛇（Night Serpent）\"丹達爾登達爾（Dendar）、\"歸來者歸還者（Returner）\"扎貢扎爾貢（Zargon）、\"偉大克蘇魯偉大克蘇魯（Great Cthulhu）\"，以及其他一些不可名狀之存在。", "這類存在包括被稱作「潛伏者」的高納達爾、「鎖鏈之神」薩里茲頓、「夜蛇」登達爾、「歸還者」扎爾貢、偉大克蘇魯，以及其他不可名狀的存在。"),
	("這類存在包括：維克那Vecna，手與眼之主Lord of the Hand and the Eye；恐懼者·埃烏茲the dread Iuz；巫妖女王·沃爾the lich-queen Vol；艾倫諾的不朽王庭the 不死宮廷（Undying Court） of 艾雷納爾（Aerenal）；維拉基斯Vlaakith，吉斯洋基人的巫妖女王lich-queen of the githyanki；以及不死法師·費斯坦但提勒斯the deathless wizard 非斯坦達那魯斯（Fistandantalus）。", "這類存在包括維克那，手與眼之主；恐懼者埃烏茲；巫妖女王沃爾；艾雷納爾的不死宮廷；吉斯洋基人的巫妖女王維拉基斯；以及不死法師費斯坦但提勒斯。"),
	("在國度，不朽者宗主包括：陰影之王·拉洛克Larloch the 暗影之王（Shadow King），魔契師之墓的傳奇大師legendary master of 魔契師之穴（Warlock's Crypt），以及吉爾金Gilgeam，恩瑟的黃金王the God-King of 溫瑟（Unther）。", "在國度中，不朽者宗主包括陰影之王拉洛克——魔契師之墓的傳奇主人——以及恩瑟的神王吉爾金。"),
	(" 不朽者Undying ", "「不朽者」"),
	(" 艾伐黑觸手Evard's Black tentacles時", "此法術時"),
	("土巨靈dao、氣巨靈djinni、火巨靈eferrti、或水巨靈marid", "土巨靈、氣巨靈、火巨靈或水巨靈"),
	("瓶中小憩Bottled Respite特性", "「瓶中小憩」特性"),
	(" 黑刃Blackrazor ", "「黑刃」"),
	(" 鴉後Raven Queen ", "鴉后"),
	(" 法師之筆Wizard Quill", "「法師之筆」"),
	(" 奧術偏斜奧術偏斜（Arcane Deflection） ", "「奧術偏斜」"),
	("迷斯卓諾神話之德拉諾（Myth Drannor）", "迷斯卓諾"),
	("銀月聯邦銀色邊境（Silver Marches）", "銀月聯邦"),
	("蘭檀島Lantan", "蘭檀島"),
	("上古誓約Old Faith", "上古誓約"),
	("古代盟約Old Faith", "古代盟約"),
	("榿樹alder、白蠟樹ash、樺樹birch、接骨木elder、榛樹hazel、冬青樹holly、杜松juniper、槲寄生mistletoe、橡樹oak、花楸樹rowan、柳樹willow還有紫杉yew", "榿樹、白蠟樹、樺樹、接骨木、榛樹、冬青樹、杜松、槲寄生、橡樹、花楸樹、柳樹與紫杉"),
	("絲蘭樹yucca甚至仙人掌cactus", "絲蘭甚至仙人掌"),
	("\"奧斯母親Oerth Mother\"貝歐瑞Beory，以及歐拜?亥Obad-Hai、艾羅娜Ehlonna、尤拉Ulaa", "「奧斯母親」貝歐瑞，以及歐拜·亥、艾羅娜、尤拉"),
	("西凡那斯Silvanus，梅麗凱Mielikki，埃達絲El-dath，裳緹亞Chauntea", "西凡那斯、梅麗凱、埃達絲、裳緹亞"),
	("塔洛斯Talos，瑪拉Malar，歐呂爾Auril和安博裡Umberlee", "塔洛斯、瑪拉、歐呂爾和安博裡"),
	("\"第一結社First Circle\"", "「第一結社」"),
	("\"天命諸神Sovereign Host\"\"黑暗六邪神Dark Six\"", "「天命諸神」與「黑暗六邪神」"),
	("\"灰燼誓約Ashbound\"", "「灰燼誓約」"),
	("\"嚴冬之子Children of Winter\"", "「嚴冬之子」"),
	("\"護門者Gatekeepers\"", "「護門者」"),
	("託姆Torm，提爾Tyr，海若尼斯Heironeous，帕拉丁Paladine，奇力·裘理斯Kiri-Jolith，杜·哈拉Dol Arrah，銀焰the Silver Flame，巴哈姆特Bahamut，雅典娜Athena，拉赫拉克提Re-Horakhty，以及海姆達爾Heimdall", "託姆、提爾、海若尼斯、帕拉丁、奇力·裘理斯、杜·哈拉、銀焰、巴哈姆特、雅典娜、拉赫拉克提與海姆達爾"),
	(" 斯爾嘉Sylgar ", "斯爾嘉"),
	("Boom！", "砰！"),
	("畢格比Bigby，塔莎Tasha，魔鄧肯Mordenkainen和悠蘭德Yolande", "畢格比、塔莎、魔鄧肯與悠蘭德"),
)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser()
	parser.add_argument("--refresh", action="store_true", help="redownload the translated source files")
	parser.add_argument("--source-dir", type=Path, help="use an existing translated class directory")
	parser.add_argument("--skip-corrections", action="store_true", help="emit an uncorrected baseline for guard maintenance")
	return parser.parse_args()


def load_csv(path: Path) -> list[dict[str, str]]:
	with path.open(encoding="utf-8", newline="") as handle:
		return list(csv.DictReader(handle))


def get_source_files() -> list[str]:
	return sorted(
		path.name
		for path in UPSTREAM_DIR.iterdir()
		if re.fullmatch(r"(?:fluff-)?class-[a-z0-9-]+\.json", path.name)
	)


def prepare_source_dir(args: argparse.Namespace, files: list[str]) -> Path:
	if args.source_dir:
		missing = [name for name in files if not (args.source_dir / name).is_file()]
		if missing:
			raise SystemExit(f"Translated source directory is missing: {', '.join(missing)}")
		return args.source_dir

	CACHE_DIR.mkdir(parents=True, exist_ok=True)
	for name in files:
		target = CACHE_DIR / name
		if target.is_file() and not args.refresh:
			continue
		with urllib.request.urlopen(f"{SOURCE_BASE_URL}/{name}") as response:  # noqa: S310
			target.write_bytes(response.read())
	return CACHE_DIR


def build_memory() -> tuple[dict[str, dict[str, str]], dict[str, str]]:
	by_category: dict[str, dict[str, str]] = defaultdict(dict)
	generic_candidates: dict[str, set[str]] = defaultdict(set)
	for row in load_csv(MEMORY_PATH):
		if row.get("lock", "").lower() != "true" or not row.get("zh_tw"):
			continue
		by_category[row["category"]][row["english"]] = row["zh_tw"]
		generic_candidates[row["english"]].add(row["zh_tw"])
	generic = {
		english: next(iter(values))
		for english, values in generic_candidates.items()
		if len(values) == 1
	}
	return dict(by_category), generic


def get_category(prop: str, is_nested: bool = False) -> str:
	if is_nested:
		return "namedRuleBlock"
	return {
		"class": "class",
		"subclass": "subclass",
		"classFeature": "classFeature",
		"subclassFeature": "subclassFeature",
		"classFluff": "class",
		"subclassFluff": "subclass",
	}[prop]


def get_identity(entity: dict, prop: str) -> tuple:
	name = entity.get("ENG_name") or entity.get("name")
	base = (name, entity.get("source"), entity.get("level"))
	if prop in {"class", "classFluff"}:
		return base
	if prop in {"subclass", "subclassFluff"}:
		return (*base, entity.get("classSource"), entity.get("shortName"))
	if prop == "classFeature":
		return (*base, entity.get("classSource"))
	return (*base, entity.get("classSource"), entity.get("subclassSource"))


def pair_entities(english: list[dict], translated: list[dict], prop: str, report: dict) -> list[tuple[dict, dict | None]]:
	remaining = set(range(len(translated)))
	pairs: list[tuple[dict, dict | None]] = []
	for english_ix, entity in enumerate(english):
		candidates = [
			ix
			for ix in remaining
			if (translated[ix].get("ENG_name") or translated[ix].get("name")) == entity.get("name")
			and translated[ix].get("source") == entity.get("source")
			and translated[ix].get("level") == entity.get("level")
		]
		if not candidates:
			# Sources occasionally correct a feature's level without changing its text/name.
			candidates = [
				ix
				for ix in remaining
				if (translated[ix].get("ENG_name") or translated[ix].get("name")) == entity.get("name")
				and translated[ix].get("source") == entity.get("source")
			]
		if candidates:
			chosen = min(candidates, key=lambda ix: abs(ix - english_ix))
			remaining.remove(chosen)
			pairs.append((entity, translated[chosen]))
		else:
			pairs.append((entity, None))
			report["unmatchedEnglishEntities"].append({"prop": prop, "identity": get_identity(entity, prop)})
	for ix in sorted(remaining):
		report["unmatchedTranslatedEntities"].append({"prop": prop, "identity": get_identity(translated[ix], prop)})
	return pairs


class Localizer:
	def __init__(self, by_category: dict[str, dict[str, str]], generic_memory: dict[str, str]):
		self.converter = OpenCC("s2twp")
		self.by_category = by_category
		self.generic_memory = generic_memory
		self.source_name_translations: dict[str, set[str]] = defaultdict(set)
		self.tag_translations: dict[tuple[str, str, str], set[str]] = defaultdict(set)
		self.report = {
			"unmatchedEnglishEntities": [],
			"unmatchedTranslatedEntities": [],
			"arrayShapeMismatches": [],
			"tagShapeMismatches": [],
			"unmatchedTranslatedTags": [],
			"untranslatedVisibleStrings": [],
		}

	def register_source_names(self, value) -> None:
		if isinstance(value, list):
			for child in value:
				self.register_source_names(child)
			return
		if not isinstance(value, dict):
			return
		english = value.get("ENG_name")
		translated = value.get("name")
		if english and isinstance(translated, str):
			converted = self.converter.convert(translated)
			self.source_name_translations[english].add(converted)
		for child in value.values():
			self.register_source_names(child)

	def register_tag_translations(self, english, translated) -> None:
		"""Learn canonical-tag display translations from structurally aligned strings.

		The external translation tree often translates a tag's lookup key. Learning the
		display text from unambiguous pairs lets mismatched strings be repaired by meaning,
		rather than by the unsafe "nth tag of this type" heuristic.
		"""
		if isinstance(english, str) and isinstance(translated, str):
			en_matches = list(TAG_RE.finditer(english))
			zh_matches = list(TAG_RE.finditer(self.converter.convert(translated)))
			if len(en_matches) != len(zh_matches):
				return
			if [match.group(1) for match in en_matches] != [match.group(1) for match in zh_matches]:
				return
			for en_match, zh_match in zip(en_matches, zh_matches):
				tag_type, en_parts = self._tag_parts(en_match)
				_, zh_parts = self._tag_parts(zh_match)
				if tag_type not in REFERENCE_TAGS | ADVANCED_REFERENCE_TAGS:
					continue
				if not en_parts or not zh_parts:
					continue
				source = en_parts[1] if len(en_parts) > 1 else ""
				display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
				display = zh_parts[display_ix] if len(zh_parts) > display_ix and zh_parts[display_ix] else zh_parts[0]
				if display:
					self.tag_translations[(tag_type, en_parts[0], source)].add(display)
			return
		if isinstance(english, list) and isinstance(translated, list):
			if len(english) != len(translated):
				return
			for english_child, translated_child in zip(english, translated):
				self.register_tag_translations(english_child, translated_child)
			return
		if isinstance(english, dict) and isinstance(translated, dict):
			for key in english.keys() & translated.keys():
				self.register_tag_translations(english[key], translated[key])

	def normalize_text(self, value: str) -> str:
		if value in EXACT_VISIBLE_TRANSLATIONS:
			return EXACT_VISIBLE_TRANSLATIONS[value]
		value = self.converter.convert(value)
		for source, replacement in PROSE_CLEANUP_REPLACEMENTS:
			value = value.replace(source, replacement)
		if ordinal_match := ORDINAL_RE.fullmatch(value.strip()):
			return f"{ordinal_match.group(1)}級"
		return value

	def translate_name(self, english: str, translated: str, category: str) -> str:
		return (
			self.by_category.get(category, {}).get(english)
			or self.generic_memory.get(english)
			or self.normalize_text(translated)
		)

	@staticmethod
	def _tag_parts(match: re.Match) -> tuple[str, list[str]]:
		return match.group(1), match.group(2).split("|")

	def _tag_token_key(self, value: str) -> str:
		return re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", self.converter.convert(value).casefold())

	def _get_tag_match_score(self, tag_type: str, en_parts: list[str], zh_parts: list[str]) -> int:
		if not en_parts or not zh_parts:
			return 0
		if tag_type in DISPLAY_FIRST_TAGS:
			return 100 if zh_parts[1:] == en_parts[1:] else 0

		display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
		zh_tokens = {zh_parts[0]}
		if len(zh_parts) > display_ix and zh_parts[display_ix]:
			zh_tokens.add(zh_parts[display_ix])
		zh_keys = {self._tag_token_key(token) for token in zh_tokens if token}
		if self._tag_token_key(en_parts[0]) in zh_keys:
			return 100

		source = en_parts[1] if len(en_parts) > 1 else ""
		known = set(self.tag_translations.get((tag_type, en_parts[0], source), set()))
		known.update(self.source_name_translations.get(en_parts[0], set()))
		if generic := self.generic_memory.get(en_parts[0]):
			known.add(generic)
		known_keys = {self._tag_token_key(value) for value in known if value}
		return 90 if zh_keys & known_keys else 0

	@staticmethod
	def _get_translated_tag_display(tag_type: str, parts: list[str]) -> str:
		display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
		if len(parts) > display_ix and parts[display_ix]:
			return parts[display_ix]
		return parts[0] if parts else ""

	def reconcile_tags(self, english: str, translated: str, context: str) -> str:
		en_matches = list(TAG_RE.finditer(english))
		zh_matches = list(TAG_RE.finditer(translated))
		if not en_matches and not zh_matches:
			return translated
		if len(en_matches) != len(zh_matches) or [m.group(1) for m in en_matches] != [m.group(1) for m in zh_matches]:
			self.report["tagShapeMismatches"].append({"context": context, "english": english, "translated": translated})

		available_by_type: dict[str, list[tuple[int, re.Match]]] = defaultdict(list)
		for en_ix, en_match in enumerate(en_matches):
			available_by_type[en_match.group(1)].append((en_ix, en_match))
		used_english: set[int] = set()
		is_exact_shape = len(en_matches) == len(zh_matches) and [m.group(1) for m in en_matches] == [m.group(1) for m in zh_matches]

		def replace(match: re.Match) -> str:
			tag_type = match.group(1)
			_, zh_parts = self._tag_parts(match)
			candidates = [item for item in available_by_type[tag_type] if item[0] not in used_english]
			scored = [
				(self._get_tag_match_score(tag_type, self._tag_parts(candidate)[1], zh_parts), en_ix, candidate)
				for en_ix, candidate in candidates
			]
			best_score = max((item[0] for item in scored), default=0)
			if best_score:
				_, en_ix, en_match = min(
					(item for item in scored if item[0] == best_score),
					key=lambda item: abs(item[2].start() / max(len(english), 1) - match.start() / max(len(translated), 1)),
				)
			elif is_exact_shape and candidates:
				en_ix, en_match = candidates[0]
			else:
				display = self._get_translated_tag_display(tag_type, zh_parts)
				if tag_type in REFERENCE_TAGS | ADVANCED_REFERENCE_TAGS | DISPLAY_FIRST_TAGS:
					self.report["unmatchedTranslatedTags"].append({"context": context, "tag": match.group(0)})
					return display
				return match.group(0)
			used_english.add(en_ix)
			en_type, en_parts = self._tag_parts(en_match)
			if en_type in REFERENCE_TAGS:
				display = self._get_translated_tag_display(en_type, zh_parts)
				display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(en_type, 2)
				base = en_parts[:display_ix]
				if display and display != en_parts[0]:
					while len(base) < display_ix:
						base.append("")
					base.append(display)
				return "{@" + en_type + " " + "|".join(base) + "}"
			if en_type in DISPLAY_FIRST_TAGS:
				display = zh_parts[0]
				if (
					en_type == "filter"
					and len(en_parts) > 2
					and en_parts[1].lower() == "spells"
					and ORDINAL_RE.fullmatch(display.strip())
					and (level_match := re.search(r"(?:^|;)level=(\d+)(?:;|$)", en_parts[2], re.IGNORECASE))
				):
					display = f"{level_match.group(1)}環"
				parts = [display, *en_parts[1:]]
				return "{@" + en_type + " " + "|".join(parts) + "}"
			if en_type in ADVANCED_REFERENCE_TAGS:
				display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX[en_type]
				display = self._get_translated_tag_display(en_type, zh_parts)
				parts = en_parts[:display_ix]
				while len(parts) < display_ix:
					parts.append("")
				if display and display != en_parts[0]:
					parts.append(display)
				return "{@" + en_type + " " + "|".join(parts) + "}"
			return match.group(0)

		return TAG_RE.sub(replace, translated)

	def localize_string(self, english: str, translated: str, context: str) -> str:
		out = self.normalize_text(translated)
		out = self.reconcile_tags(english, out, context)
		if ASCII_WORD_RE.search(english) and out == english:
			self.report["untranslatedVisibleStrings"].append({"context": context, "english": english})
		return out

	def localize_content(self, english, translated, context: str, category: str):
		if isinstance(english, str) and isinstance(translated, str):
			return self.localize_string(english, translated, context)
		if isinstance(english, list) and isinstance(translated, list):
			if len(english) != len(translated):
				self.report["arrayShapeMismatches"].append({"context": context, "englishLength": len(english), "translatedLength": len(translated)})
				out = deepcopy(english)
				translated_ix = 0
				for english_ix, english_child in enumerate(english):
					while translated_ix < len(translated) and type(translated[translated_ix]) is not type(english_child):
						translated_ix += 1
					if translated_ix >= len(translated):
						break
					translated_child = translated[translated_ix]
					# Reference objects are canonical metadata and are deliberately left untouched.
					if not (isinstance(english_child, dict) and english_child.get("type", "").startswith("ref")):
						out[english_ix] = self.localize_content(
							english_child,
							translated_child,
							f"{context}/{english_ix}",
							category,
						)
					translated_ix += 1
				return out
			return [self.localize_content(a, b, f"{context}/{ix}", category) for ix, (a, b) in enumerate(zip(english, translated))]
		if isinstance(english, dict) and isinstance(translated, dict):
			out = deepcopy(english)
			for key, english_value in english.items():
				if key not in translated:
					if key == "name" and isinstance(english_value, str):
						translated_name = self.translate_name(english_value, english_value, "namedRuleBlock")
						if translated_name != english_value:
							out["ENG_name"] = english_value
							out[key] = translated_name
					continue
				if key in CANONICAL_KEYS:
					continue
				translated_value = translated[key]
				if key == "name" and isinstance(english_value, str) and isinstance(translated_value, str):
					out["ENG_name"] = english_value
					out[key] = self.translate_name(english_value, translated_value, "namedRuleBlock")
				elif key in DIRECT_VISIBLE_KEYS or key in CONTENT_CONTAINER_KEYS:
					out[key] = self.localize_content(english_value, translated_value, f"{context}/{key}", category)
				elif key in NAMED_STRUCTURE_KEYS:
					out[key] = self.localize_named_structure(english_value, translated_value, f"{context}/{key}", category)
			return out
		return deepcopy(english)

	def localize_named_structure(self, english, translated, context: str, category: str):
		if isinstance(english, list) and isinstance(translated, list):
			if len(english) != len(translated):
				self.report["arrayShapeMismatches"].append({"context": context, "englishLength": len(english), "translatedLength": len(translated)})
				return deepcopy(english)
			return [self.localize_named_structure(a, b, f"{context}/{ix}", category) for ix, (a, b) in enumerate(zip(english, translated))]
		if isinstance(english, dict) and isinstance(translated, dict):
			out = deepcopy(english)
			for key, english_value in english.items():
				if key not in translated or key in CANONICAL_KEYS:
					continue
				translated_value = translated[key]
				if key == "name" and isinstance(english_value, str) and isinstance(translated_value, str):
					out["ENG_name"] = english_value
					out[key] = self.translate_name(english_value, translated_value, "namedRuleBlock")
				elif key in DIRECT_VISIBLE_KEYS or key in CONTENT_CONTAINER_KEYS:
					out[key] = self.localize_content(english_value, translated_value, f"{context}/{key}", category)
				elif isinstance(english_value, (dict, list)):
					out[key] = self.localize_named_structure(english_value, translated_value, f"{context}/{key}", category)
			return out
		return deepcopy(english)

	def localize_proficiencies(self, english, translated, context: str, category: str):
		"""Translate rendered proficiency strings while preserving mechanical codes."""
		if not isinstance(english, dict) or not isinstance(translated, dict):
			return deepcopy(english)
		out = deepcopy(english)
		for key in ("weapons", "tools"):
			english_values = english.get(key)
			translated_values = translated.get(key)
			if not isinstance(english_values, list) or not isinstance(translated_values, list):
				continue
			if len(english_values) != len(translated_values):
				self.report["arrayShapeMismatches"].append({
					"context": f"{context}/{key}",
					"englishLength": len(english_values),
					"translatedLength": len(translated_values),
				})
				continue
			out[key] = []
			for ix, (english_value, translated_value) in enumerate(zip(english_values, translated_values)):
				# These codes are interpreted by Renderer.class and must never be localized in data.
				if isinstance(english_value, str) and english_value in {"simple", "martial"}:
					out[key].append(english_value)
					continue
				if isinstance(english_value, str) and isinstance(translated_value, str):
					out[key].append(self.localize_string(english_value, translated_value, f"{context}/{key}/{ix}"))
					continue
				out[key].append(deepcopy(english_value))
		return out

	def localize_multiclassing(self, english, translated, context: str, category: str):
		if not isinstance(english, dict) or not isinstance(translated, dict):
			return deepcopy(english)
		out = deepcopy(english)
		for key in ("requirementsSpecial", "entries"):
			if key in english and key in translated:
				out[key] = self.localize_content(english[key], translated[key], f"{context}/{key}", category)
		if "proficienciesGained" in english and "proficienciesGained" in translated:
			out["proficienciesGained"] = self.localize_proficiencies(
				english["proficienciesGained"],
				translated["proficienciesGained"],
				f"{context}/proficienciesGained",
				category,
			)
		return out

	def localize_entity(self, english: dict, translated: dict, prop: str, context: str) -> dict:
		category = get_category(prop)
		out = deepcopy(english)
		if isinstance(english.get("name"), str) and isinstance(translated.get("name"), str):
			out["ENG_name"] = english["name"]
			out["name"] = self.translate_name(english["name"], translated["name"], category)
		if isinstance(english.get("shortName"), str) and isinstance(translated.get("shortName"), str):
			out["ENG_shortName"] = english["shortName"]
			out["shortName"] = self.translate_name(english["shortName"], translated["shortName"], category)

		for key, english_value in english.items():
			if key not in translated or key in {"name", "shortName"} or key in CANONICAL_KEYS:
				continue
			translated_value = translated[key]
			if key in DIRECT_VISIBLE_KEYS or key in CONTENT_CONTAINER_KEYS:
				out[key] = self.localize_content(english_value, translated_value, f"{context}/{key}", category)
			elif key in NAMED_STRUCTURE_KEYS or key == "startingEquipment":
				out[key] = self.localize_named_structure(english_value, translated_value, f"{context}/{key}", category)
			elif key == "startingProficiencies":
				out[key] = self.localize_proficiencies(english_value, translated_value, f"{context}/{key}", category)
			elif key == "multiclassing":
				out[key] = self.localize_multiclassing(english_value, translated_value, f"{context}/{key}", category)
		return out


def build_full_glossary(localizer: Localizer) -> None:
	rows = load_csv(TERMS_PATH)
	for row in rows:
		if row.get("proposed_zh_tw"):
			row["final_zh_tw"] = row["proposed_zh_tw"]
			row["final_source"] = row.get("translation_source", "")
			continue
		candidates = sorted(localizer.source_name_translations.get(row["english"], set()))
		row["final_zh_tw"] = candidates[0] if candidates else ""
		row["final_source"] = "shuaishuaidnd.cn + OpenCC s2twp" if candidates else ""
	fieldnames = list(rows[0]) + ["final_zh_tw", "final_source"]
	with FULL_GLOSSARY_PATH.open("w", encoding="utf-8", newline="") as handle:
		writer = csv.DictWriter(handle, fieldnames=fieldnames)
		writer.writeheader()
		writer.writerows(rows)


def apply_manual_corrections(output: dict, filename: str, report: dict) -> None:
	corrections_path = CORRECTIONS_DIR / filename
	if not corrections_path.is_file():
		return
	corrections_data = json.loads(corrections_path.read_text(encoding="utf-8"))
	for correction in corrections_data.get("corrections", []):
		pointer = correction["path"]
		segments = [segment.replace("~1", "/").replace("~0", "~") for segment in pointer.split("/")[1:]]
		parent = output
		for segment in segments[:-1]:
			parent = parent[int(segment)] if isinstance(parent, list) else parent[segment]
		last = segments[-1]
		key = int(last) if isinstance(parent, list) else last
		current = parent[key]
		if current != correction["expected"]:
			raise ValueError(f"Stale manual correction {filename}{pointer}: expected value no longer matches")
		parent[key] = correction["value"]
		report.setdefault("manualCorrectionsApplied", []).append({
			"file": filename,
			"path": pointer,
			"reason": correction.get("reason", ""),
		})


def main() -> None:
	args = parse_args()
	files = get_source_files()
	source_dir = prepare_source_dir(args, files)
	by_category, generic_memory = build_memory()
	localizer = Localizer(by_category, generic_memory)
	for name in files:
		english_data = json.loads((UPSTREAM_DIR / name).read_text(encoding="utf-8"))
		translated_data = json.loads((source_dir / name).read_text(encoding="utf-8"))
		localizer.register_source_names(translated_data)
		localizer.register_tag_translations(english_data, translated_data)
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
	manifest_files = []
	entity_counts = defaultdict(int)
	for name in files:
		english_data = json.loads((UPSTREAM_DIR / name).read_text(encoding="utf-8"))
		translated_data = json.loads((source_dir / name).read_text(encoding="utf-8"))
		output = {
			"_meta": {
				"locale": "zh-TW",
				"upstreamTag": "v2.33.3",
				"translationSource": SOURCE_BASE_URL,
				"conversion": "OpenCC s2twp plus locked project terminology",
			}
		}
		for prop in TOP_LEVEL_PROPS:
			english_entities = english_data.get(prop, [])
			translated_entities = translated_data.get(prop, [])
			if not english_entities:
				continue
			output[prop] = []
			for ix, (english, translated) in enumerate(pair_entities(english_entities, translated_entities, prop, localizer.report)):
				entity_counts[prop] += 1
				if translated is None:
					localized = deepcopy(english)
					localized["ENG_name"] = english.get("name")
					if isinstance(english.get("shortName"), str):
						localized["ENG_shortName"] = english["shortName"]
				else:
					localized = localizer.localize_entity(english, translated, prop, f"{name}/{prop}/{ix}")
				output[prop].append(localized)

		out_name = name
		if not args.skip_corrections:
			apply_manual_corrections(output, out_name, localizer.report)
		(OUTPUT_DIR / out_name).write_text(json.dumps(output, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
		manifest_files.append(out_name)

	build_full_glossary(localizer)
	manifest = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": "v2.33.3",
			"translationSource": SOURCE_BASE_URL,
			"sourceFilesSha256": {
				name: hashlib.sha256((source_dir / name).read_bytes()).hexdigest()
				for name in files
			},
		},
		"files": manifest_files,
		"entityCounts": dict(entity_counts),
	}
	(OUTPUT_DIR / "index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")

	report = {
		"source": SOURCE_BASE_URL,
		"files": len(files),
		"entityCounts": dict(entity_counts),
		"fullGlossary": {
			"total": len(load_csv(FULL_GLOSSARY_PATH)),
			"missing": sum(not row.get("final_zh_tw") for row in load_csv(FULL_GLOSSARY_PATH)),
		},
		"qa": localizer.report,
	}
	REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
	print(json.dumps({
		"files": len(files),
		"entityCounts": dict(entity_counts),
		"fullGlossaryMissing": report["fullGlossary"]["missing"],
		"arrayShapeMismatches": len(localizer.report["arrayShapeMismatches"]),
		"tagShapeMismatches": len(localizer.report["tagShapeMismatches"]),
		"untranslatedVisibleStrings": len(localizer.report["untranslatedVisibleStrings"]),
	}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
	main()
