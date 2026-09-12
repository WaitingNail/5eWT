#!/usr/bin/env python3
"""Build Traditional Chinese sidecars for core rules and Quick Reference.

The importer is intentionally conservative: every output object starts as the
5etools v2.33.3 English object, and only user-visible text is replaced.  The
pinned Chinese source is paired by array kind, ``ENG_name``, and source.  This
keeps 2014 (PHB) and 2024 (XPHB) rules separate and prevents translated lookup
keys from breaking hashes, references, or inline tags.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import tempfile
import urllib.request
from collections import Counter, defaultdict, deque
from copy import deepcopy
from pathlib import Path

try:
	from opencc import OpenCC
except ImportError as exc:  # pragma: no cover - dependency error is user-facing
	raise SystemExit(
		"Missing opencc-python-reimplemented. Install with: "
		"python -m pip install -r requirements-zh-tw.txt"
	) from exc


ROOT = Path(__file__).resolve().parents[2]
UPSTREAM_ROOT = ROOT / "data"
OUTPUT_ROOT = ROOT / "data" / "zh-TW" / "rules"
TRANSLATION_ROOT = ROOT / "translation" / "zh-TW" / "rules"
REPORT_PATH = TRANSLATION_ROOT / "generated" / "core-rules-import-report.json"
CLASS_MEMORY_PATH = ROOT / "translation" / "zh-TW" / "classes" / "translation-memory.csv"
GLOSSARY_PATH = ROOT / "translation" / "zh-TW" / "glossary-proposed.csv"

SOURCE_REPOSITORY = "https://github.com/tjliqy/5etools-cn"
SOURCE_COMMIT = "46b15d04f548c23c526084deae078e3568500349"
SOURCE_RAW_BASE = f"https://raw.githubusercontent.com/tjliqy/5etools-cn/{SOURCE_COMMIT}"
UPSTREAM_TAG = "v2.33.3"
UPSTREAM_COMMIT = "e5f3e77b303a92df10487207857200245e71957c"

FILE_SPECS = (
	("actions.json", ("action",)),
	("conditionsdiseases.json", ("condition", "disease", "status")),
	("fluff-conditionsdiseases.json", ("conditionFluff",)),
	("skills.json", ("skill",)),
	("senses.json", ("sense",)),
	("variantrules.json", ("variantrule",)),
	("generated/bookref-quick.json", ()),
	("generated/gendata-variantrules.json", ("variantrule",)),
)

EXPECTED_COUNTS = {
	"action": 48,
	"condition": 30,
	"disease": 29,
	"status": 5,
	"conditionFluff": 13,
	"skill": 36,
	"sense": 8,
	"variantrule": 230,
	"generatedVariantrule": 13,
	"quickrefNamedObjects": 401,
}

# The generated Chinese file contains two historical ENG_name spellings which
# differ from the byte-guarded v2.33.3 English generator output.  These aliases
# are explicit and source-scoped; they must never become fuzzy global matches.
SOURCE_ENG_NAME_ALIASES = {
	("variantrule", "Weapon Mastery Properties", "XPHB"): "Mastery Properties",
	("variantrule", "Training to Gain Levels", "XDMG"): "Variant: Training to Gain Levels",
}

DIRECT_VISIBLE_KEYS = {
	"name",
	"shortName",
	"caption",
	"title",
	"label",
	"by",
	"text",
	"quote",
	"author",
}
CONTENT_CONTAINER_KEYS = {
	"entries",
	"entriesHigherLevel",
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
	"components",
	"m",
	"scalingLevelDice",
}

# These keys are rendered or interpreted as identifiers/mechanics.  They are
# copied from English even when the translated source mutates them.
CANONICAL_KEYS = {
	"type",
	"source",
	"page",
	"id",
	"uid",
	"hash",
	"href",
	"path",
	"url",
	"ability",
	"time",
	"unit",
	"ruleType",
	"fromVariant",
	"reprintedAs",
	"otherSources",
	"additionalSources",
	"srd",
	"srd52",
	"basicRules",
	"basicRules2024",
	"freeRules2024",
	"hasFluff",
	"hasFluffImages",
	"data",
	"images",
	"alias",
	"style",
	"colStyles",
	"rowStyles",
	"roll",
	"formula",
	"attributes",
	"tag",
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
ADVANCED_REFERENCE_TAGS = {"subclass", "classFeature", "subclassFeature", "quickref"}
DISPLAY_FIRST_TAGS = {"filter", "5etools", "book", "adventure"}
MECHANICAL_TAGS = {"dc", "dice", "damage", "scaledice", "scaledamage", "hit", "chance", "d20", "recharge"}
SPECIAL_REFERENCE_TAG_DISPLAY_INDEX = {
	"deity": 3,
	"subclass": 4,
	"classFeature": 5,
	"subclassFeature": 7,
	"quickref": 4,
}
TAG_CATEGORY_ALIASES = {
	"optionalfeature": "namedRuleBlock",
	"optfeature": "namedRuleBlock",
	"variantrule": "variantrule",
	"condition": "condition",
	"disease": "disease",
	"status": "status",
	"skill": "skill",
	"sense": "sense",
	"action": "action",
}

TAG_RE = re.compile(r"\{@([A-Za-z0-9]+) ([^{}]*)}")
ASCII_WORD_RE = re.compile(r"[A-Za-z]{3,}")
DIGIT_RE = re.compile(r"\d+(?:[,.]\d+)*")
DIE_TYPE_RE = re.compile(r"(?<![A-Za-z])d\d+", re.IGNORECASE)

EXACT_VISIBLE_TRANSLATIONS = {
	"No": "否",
	"Yes": "是",
	"None": "無",
	"Any": "任意",
	"Varies": "依情況而定",
}

PROJECT_TERM_REPLACEMENTS = (
	("護手令會（Order of the Gauntlet）", "鐵手套教團"),
	("臂鎧教團Order of the Gauntlet", "鐵手套教團"),
	("The Order of the Gauntlet", "鐵手套教團"),
	("Order of the Gauntlet", "鐵手套教團"),
	("臂鎧騎士團", "鐵手套教團"),
	("臂鎧教團", "鐵手套教團"),
	("護手令會", "鐵手套教團"),
)

# Small, source-specific repairs for omissions or ambiguous notation in the
# pinned translation.  They run after canonical tag reconciliation and are
# guarded by the exact context path, making each change auditable.
POST_RECONCILE_REPLACEMENTS: dict[str, tuple[tuple[str, str], ...]] = {
	"generated/gendata-variantrules.json/variantrule/7/entries/5/entries/0": (
		("區域內的每個生物", "{@variantrule Sphere [Area of Effect]|XPHB|球形}範圍內的每個生物"),
	),
	"generated/gendata-variantrules.json/variantrule/7/entries/6/entries/0": (
		("區域被煙霧籠罩", "{@variantrule Sphere [Area of Effect]|XPHB|球形}範圍被煙霧籠罩"),
	),
	"generated/gendata-variantrules.json/variantrule/9/entries/4/entries/0": (
		("船員們便會變為敵對", "船員們便會變為{@variantrule Hostile [Attitude]|XPHB|敵對}"),
	),
	"variantrules.json/variantrule/59/entries/1": (
		("玩家骰一次的d100", "玩家擲一次百分骰"),
	),
	"variantrules.json/variantrule/66/entries/1/entries/0": (
		("至少100gp", "至少10 gp"),
	),
	"variantrules.json/variantrule/83/entries/3/entries/1/rows/5/1": (
		("這讓你30天內", "這讓你在接下來投入此活動的六個工作週內"),
	),
	"variantrules.json/variantrule/86/entries/2/entries/1/entries/2/rows/3/1": (
		("3 修改成功", "修改成功"),
	),
	"variantrules.json/variantrule/91/entries/1/entries/2/entries/1/rows/1/1": (
		("2 資訊來源", "資訊來源"),
	),
	"variantrules.json/variantrule/91/entries/1/entries/2/entries/1/rows/2/1": (
		("3 資訊來源", "資訊來源"),
	),
	"variantrules.json/variantrule/99/entries/0": (
		("請忽略第5章的\"{@book 第五章|PHB|5|Armor and Shields}\"中所述的力量欄", "請忽略{@book 第五章|PHB|5|Armor and Shields}所述的力量欄"),
	),
	"generated/bookref-quick.json/data/bookref-quick/0/entries/2/entries/5/entries/1": (
		("有10d10的生命骰", "有十顆 d10 生命骰"),
		("有五粒d10生命骰和五粒d8生命骰", "有五顆 d10 生命骰和五顆 d8 生命骰"),
	),
	"generated/bookref-quick.json/data/bookref-quick/0/entries/0/entries/3": (
		("布魯諾作為戰士從第7級提升到第8級時", "布魯諾的戰士等級達到第8級時"),
	),
	"generated/bookref-quick.json/data/bookref-quick/1/entries/0/entries/2/entries/0/entries/15/entries/0": (
		("德魯伊可以將此類物品用作其法器（見第10章）", "德魯伊（見《玩家手冊》第3章）可以將此類物品用作其法器（見第10章）"),
	),
	"generated/bookref-quick.json/data/bookref-quick/1/entries/0/entries/2/entries/0/entries/18/entries/0": (
		("牧師與聖武士能將聖徽用作法器（見第10章）", "牧師與聖武士能將聖徽用作法器（見第三部分：「魔法規則」）"),
	),
	"generated/bookref-quick.json/data/bookref-quick/1/entries/0/entries/2/entries/0/entries/20/entries/0": (
		("否則受到1d4點穿刺傷害，並且速度降至0，直至他的下一回合開始", "否則受到1d4點穿刺傷害，並且停止移動"),
		("力量（運動）檢定", "力量檢定"),
	),
	"generated/bookref-quick.json/data/bookref-quick/1/entries/3/entries/2/entries/2/entries/1": (
		("你可以在休整時間內進行專業實踐活動", "你可以在休整時間內進行專業實踐活動（如第8章所述）"),
	),
	"generated/bookref-quick.json/data/bookref-quick/1/entries/9/entries/4/entries/1/entries/3/entries/0": (
		("十分適合用來進行雙持武器戰鬥。", "十分適合用來進行雙持武器戰鬥（見第9章的相關規則）。"),
	),
	"generated/bookref-quick.json/data/bookref-quick/2/entries/3/entries/1": (
		("{@book 第十一章|PHB|11}第11章裡", "{@book 第十一章|PHB|11}裡"),
	),
	"generated/bookref-quick.json/data/bookref-quick/2/entries/7/entries/3/entries/0": (
		("其他生物的被動感知（{@skill Perception||感知}）值作對抗，同時", "其他生物的被動感知（{@skill Perception||感知}）值作對抗；該數值等於10＋該生物的感知調整值，同時"),
	),
	"generated/bookref-quick.json/data/bookref-quick/2/entries/18/entries/2/entries/5/entries/3/entries/0": (
		("其他生物的被動感知（{@skill Perception||感知}）值作對抗，同時", "其他生物的被動感知（{@skill Perception||感知}）值作對抗；該數值等於10＋該生物的感知調整值，同時"),
	),
	"generated/bookref-quick.json/data/bookref-quick/2/entries/8/entries/7/entries/2": (
		("你需要投兩枚不同的10面骰來生成1到100之間的一個值", "你需要投兩枚不同的十面骰（骰面分別標示0到9）來生成1到100之間的一個值"),
	),
	"generated/bookref-quick.json/data/bookref-quick/3/entries/2/entries/2/entries/0": (
		("而在具有減值時，傷害值可能降為0但不會存在負數。", ""),
	),
	"generated/bookref-quick.json/data/bookref-quick/3/entries/2/entries/4/entries/0": (
		("休息可以恢復生物的生命值，魔法手段如法術療傷術cure wounds或者治療藥水potion of healing等", "休息可以恢復生物的生命值（如第8章所述），魔法手段如法術「治療傷勢」或「治療藥水」等"),
	),
	"generated/gendata-variantrules.json/variantrule/0/entries/4/entries/9/rows/1/1": (
		("2 向他/她", "向他／她"),
	),
	"generated/gendata-variantrules.json/variantrule/0/entries/4/entries/11/rows/3/1": (
		("1 一加侖", "一加侖"),
	),
}

ENGLISH_WRITTEN_NUMBERS = {
	"0": ("zero",),
	"1": ("one", "once", "first", "single"),
	"2": ("two", "twice", "second", "both", "double"),
	"3": ("three", "third", "triple"),
	"4": ("four", "fourth"),
	"5": ("five", "fifth"),
	"6": ("six", "sixth"),
	"7": ("seven", "seventh"),
	"8": ("eight", "eighth"),
	"9": ("nine", "ninth"),
	"10": ("ten", "tenth"),
	"11": ("eleven", "eleventh"),
	"12": ("twelve", "twelfth"),
	"13": ("thirteen", "thirteenth"),
	"14": ("fourteen", "fourteenth"),
	"15": ("fifteen", "fifteenth"),
	"16": ("sixteen", "sixteenth"),
	"17": ("seventeen", "seventeenth"),
	"18": ("eighteen", "eighteenth"),
	"19": ("nineteen", "nineteenth"),
	"20": ("twenty", "twentieth"),
	"30": ("thirty", "thirtieth"),
	"40": ("forty", "fortieth"),
	"50": ("fifty", "fiftieth"),
	"60": ("sixty", "sixtieth"),
	"100": ("hundred", "hundredth"),
	"0.5": ("half", "one-half"),
	"1.5": ("one and a half",),
}


def to_chinese_integer(value: int) -> str | None:
	if value < 0 or value > 9999:
		return None
	if value == 0:
		return "零"
	digits = "零一二三四五六七八九"
	units = ((1000, "千"), (100, "百"), (10, "十"))
	remaining = value
	out = ""
	needs_zero = False
	for unit_value, label in units:
		digit = remaining // unit_value
		remaining %= unit_value
		if digit:
			if needs_zero:
				out += "零"
			if not (unit_value == 10 and digit == 1 and not out):
				out += digits[digit]
			out += label
			needs_zero = bool(remaining and remaining < unit_value // 10)
		elif out and remaining:
			needs_zero = True
	if remaining:
		if needs_zero:
			out += "零"
		out += digits[remaining]
	return out


def strip_inline_tags(value: str) -> str:
	return TAG_RE.sub("", value)


def extract_numeric_values(value: str) -> list[str]:
	value = strip_inline_tags(value)
	value = re.sub(
		r"(\d+)½",
		lambda match: f"{int(match.group(1)) + 0.5:g}",
		value,
	)
	value = value.replace("½", "0.5")
	value = re.sub(
		r"(?<!\d)(\d+)\s*/\s*(\d+)(?!\d)",
		lambda match: f"{int(match.group(1)) / int(match.group(2)):g}",
		value,
	)
	out = []
	for match in DIGIT_RE.finditer(value):
		token = match.group(0).replace(",", "")
		if token.startswith("+"):
			token = token[1:]
		start = match.start()
		if start and value[start - 1] in "-−":
			before_sign = value[start - 2] if start > 1 else ""
			# A dash after an ASCII word/number is a range/ordinal separator;
			# otherwise it is a negative sign (including Chinese prose "為-1").
			if not (before_sign.isascii() and before_sign.isalnum()):
				token = f"-{token}"
		out.append(token)
	return out


def localized_has_written_number(number: str, value: str) -> bool:
	is_negative = number.startswith("-")
	normalized = number.removeprefix("-")
	if "." in normalized:
		candidates = {
			"0.5": ("半", "一半", "零點五"),
			"1.5": ("一點五", "一又二分之一"),
		}.get(normalized, ())
	else:
		candidate = to_chinese_integer(int(normalized))
		candidates = (candidate,) if candidate else ()
		if normalized == "1":
			candidates += ("壹", "首")
		elif normalized == "2":
			candidates += ("兩", "雙", "貳")
	prefixes = ("負", "負的") if is_negative else ("",)
	return any(f"{prefix}{candidate}" in value for prefix in prefixes for candidate in candidates)


def english_has_written_number(number: str, value: str) -> bool:
	normalized = number.removeprefix("-")
	return any(
		re.search(rf"\b{re.escape(candidate)}\b", value, re.IGNORECASE)
		for candidate in ENGLISH_WRITTEN_NUMBERS.get(normalized, ())
	)


def classify_numeric_difference(item: dict) -> tuple[bool, str]:
	english_values = set(extract_numeric_values(item["english"]))
	localized_values = set(extract_numeric_values(item["localized"]))
	missing = {
		value
		for value in english_values - localized_values
		if not localized_has_written_number(value, item["localized"])
	}
	extra = {
		value
		for value in localized_values - english_values
		if not english_has_written_number(value, item["english"])
	}
	if extra == {"0"} and re.search(r"\b(?:below 1|stop(?:s|ped)? moving|no (?:damage|movement))\b", item["english"], re.IGNORECASE):
		extra.clear()
	if extra == {"1"} and re.search(r"\b(?:a|an|each|per)\b", item["english"], re.IGNORECASE):
		extra.clear()
	if (
		len(missing) == 1
		and len(extra) == 1
		and next(iter(extra)).startswith("-")
		and next(iter(extra)).removeprefix("-") == next(iter(missing))
		and re.search(r"\b(?:decreases?|reduced?|penalty|subtract)\b", item["english"], re.IGNORECASE)
	):
		missing.clear()
		extra.clear()
	if missing or extra:
		return False, f"missing={sorted(missing)}; extra={sorted(extra)}"
	if english_values == localized_values:
		return True, "same numeric value set; repetition/formatting only"
	return True, "Arabic and written-number/fraction forms are equivalent"


def is_intentional_untranslated(item: dict) -> bool:
	visible = strip_inline_tags(item.get("localized", item["english"]))
	return bool(re.fullmatch(r"[\d\s.,+×()½/−-]*(?:(?:gp|mph|lb|ft|sp|cp|pp|xp))?", visible, re.IGNORECASE))


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser()
	parser.add_argument(
		"--source-dir",
		type=Path,
		help="directory containing pinned data/ and data-bak/ trees",
	)
	parser.add_argument("--refresh", action="store_true", help="redownload the pinned source")
	return parser.parse_args()


def read_json(path: Path):
	return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(value, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
	return hashlib.sha256(path.read_bytes()).hexdigest()


def load_csv(path: Path) -> list[dict[str, str]]:
	with path.open(encoding="utf-8", newline="") as handle:
		return list(csv.DictReader(handle))


def prepare_source(args: argparse.Namespace) -> Path:
	if args.source_dir:
		base = args.source_dir.resolve()
	else:
		base = Path(tempfile.gettempdir()) / "5etools-zh-tw-core-rules" / SOURCE_COMMIT

	for root_name in ("data", "data-bak"):
		for relative, _ in FILE_SPECS:
			target = base / root_name / relative
			if target.is_file() and not args.refresh:
				continue
			target.parent.mkdir(parents=True, exist_ok=True)
			url = f"{SOURCE_RAW_BASE}/{root_name}/{relative}"
			try:
				with urllib.request.urlopen(url) as response:  # noqa: S310 - URL is pinned above
					target.write_bytes(response.read())
			except Exception as exc:  # pragma: no cover - network failure is user-facing
				raise SystemExit(f"Could not download pinned source {url}: {exc}") from exc
	return base


class TermMemory:
	def __init__(self) -> None:
		self.class_by_category: dict[str, dict[str, str]] = defaultdict(dict)
		self.class_generic: dict[str, str] = {}
		self.glossary_by_category: dict[str, dict[str, str]] = defaultdict(dict)
		self.glossary_generic: dict[str, str] = {}
		self._load()

	@staticmethod
	def _get_unambiguous(candidates: dict[str, set[str]]) -> dict[str, str]:
		return {
			english: next(iter(values))
			for english, values in candidates.items()
			if len(values) == 1
		}

	def _load(self) -> None:
		class_candidates: dict[str, set[str]] = defaultdict(set)
		for row in load_csv(CLASS_MEMORY_PATH):
			if row.get("lock", "").casefold() != "true" or not row.get("zh_tw"):
				continue
			self.class_by_category[row["category"]][row["english"]] = row["zh_tw"]
			class_candidates[row["english"]].add(row["zh_tw"])
		self.class_generic = self._get_unambiguous(class_candidates)

		glossary_candidates: dict[str, set[str]] = defaultdict(set)
		for row in load_csv(GLOSSARY_PATH):
			if not row.get("proposed_zh_tw"):
				continue
			# The user explicitly approved the first proposed candidate, including
			# rows marked conflict, pending later manual correction.
			self.glossary_by_category[row["category"]][row["english"]] = row["proposed_zh_tw"]
			glossary_candidates[row["english"]].add(row["proposed_zh_tw"])
		self.glossary_generic = self._get_unambiguous(glossary_candidates)

	def get(self, english: str, category: str) -> str | None:
		# Locked Class memory takes precedence over every external translation.
		return (
			self.class_by_category.get(category, {}).get(english)
			or self.class_by_category.get("namedRuleBlock", {}).get(english)
			or self.class_generic.get(english)
			or self.glossary_by_category.get(category, {}).get(english)
			or self.glossary_generic.get(english)
		)


class QuickRefMatcher:
	"""Resolve Quick Reference objects after the Chinese source reordered sections."""

	def __init__(self, translated_root) -> None:
		self.by_exact: dict[tuple, deque[dict]] = defaultdict(deque)
		self.by_loose: dict[tuple, deque[dict]] = defaultdict(deque)
		self.total = 0
		self.used_ids: set[int] = set()
		self.unmatched_english: list[dict] = []
		self._register(translated_root)

	@staticmethod
	def exact_key_from_english(value: dict) -> tuple:
		return (value.get("name"), value.get("source"), value.get("type"), value.get("page"))

	@staticmethod
	def exact_key_from_translated(value: dict) -> tuple:
		return (value.get("ENG_name"), value.get("source"), value.get("type"), value.get("page"))

	@staticmethod
	def loose_key_from_english(value: dict) -> tuple:
		return (value.get("name"), value.get("source"))

	@staticmethod
	def loose_key_from_translated(value: dict) -> tuple:
		return (value.get("ENG_name"), value.get("source"))

	def _register(self, value) -> None:
		if isinstance(value, list):
			for child in value:
				self._register(child)
			return
		if not isinstance(value, dict):
			return
		if value.get("ENG_name"):
			self.by_exact[self.exact_key_from_translated(value)].append(value)
			self.by_loose[self.loose_key_from_translated(value)].append(value)
			self.total += 1
		for child in value.values():
			self._register(child)

	@staticmethod
	def _pop_unused(queue: deque[dict], used_ids: set[int]) -> dict | None:
		while queue:
			candidate = queue.popleft()
			if id(candidate) not in used_ids:
				return candidate
		return None

	def resolve(self, english: dict, context: str) -> dict | None:
		candidate = self._pop_unused(self.by_exact[self.exact_key_from_english(english)], self.used_ids)
		if candidate is None:
			candidate = self._pop_unused(self.by_loose[self.loose_key_from_english(english)], self.used_ids)
		if candidate is None:
			self.unmatched_english.append({"context": context, "name": english.get("name"), "source": english.get("source")})
			return None
		self.used_ids.add(id(candidate))
		return candidate

	@property
	def unmatched_translated(self) -> int:
		return self.total - len(self.used_ids)


class Localizer:
	def __init__(self) -> None:
		self.converter = OpenCC("s2twp")
		self.memory = TermMemory()
		self.source_name_translations: dict[str, set[str]] = defaultdict(set)
		self.tag_translations: dict[tuple[str, str, str], set[str]] = defaultdict(set)
		self.report = {
			"unmatchedEnglishEntities": [],
			"unmatchedTranslatedEntities": [],
			"arrayShapeMismatches": [],
			"typeShapeMismatches": [],
			"tagShapeMismatches": [],
			"unmatchedTranslatedTags": [],
			"tagCanonicalDifferences": [],
			"diceDifferences": [],
			"numericDifferences": [],
			"untranslatedVisibleStrings": [],
			"sourceRepairsApplied": [],
		}

	def normalize_text(self, value: str) -> str:
		if value in EXACT_VISIBLE_TRANSLATIONS:
			return EXACT_VISIBLE_TRANSLATIONS[value]
		return self.converter.convert(value)

	def register_source_names(self, value) -> None:
		if isinstance(value, list):
			for child in value:
				self.register_source_names(child)
			return
		if not isinstance(value, dict):
			return
		if value.get("ENG_name") and isinstance(value.get("name"), str):
			self.source_name_translations[value["ENG_name"]].add(self.normalize_text(value["name"]))
		for child in value.values():
			self.register_source_names(child)

	@staticmethod
	def _tag_parts(match: re.Match) -> tuple[str, list[str]]:
		return match.group(1), match.group(2).split("|")

	def register_tag_translations(self, english, translated) -> None:
		if isinstance(english, str) and isinstance(translated, str):
			en_matches = list(TAG_RE.finditer(english))
			zh_matches = list(TAG_RE.finditer(self.normalize_text(translated)))
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
			for english_child, translated_child in zip(english, translated):
				self.register_tag_translations(english_child, translated_child)
			return
		if isinstance(english, dict) and isinstance(translated, dict):
			for key in english.keys() & translated.keys():
				self.register_tag_translations(english[key], translated[key])

	def translate_name(self, english: str, translated: str, category: str) -> str:
		return self.memory.get(english, category) or self.normalize_text(translated)

	def _tag_token_key(self, value: str) -> str:
		return re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", self.normalize_text(value).casefold())

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
		if memory_value := self.memory.get(en_parts[0], TAG_CATEGORY_ALIASES.get(tag_type, tag_type)):
			known.add(memory_value)
		known_keys = {self._tag_token_key(value) for value in known if value}
		return 90 if zh_keys & known_keys else 0

	@staticmethod
	def _get_translated_tag_display(tag_type: str, parts: list[str]) -> str:
		display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
		if len(parts) > display_ix and parts[display_ix]:
			return parts[display_ix]
		return parts[0] if parts else ""

	def _get_locked_tag_display(self, tag_type: str, en_parts: list[str], zh_parts: list[str]) -> str:
		source_display = self._get_translated_tag_display(tag_type, zh_parts)
		if not en_parts:
			return source_display
		return self.memory.get(en_parts[0], TAG_CATEGORY_ALIASES.get(tag_type, tag_type)) or source_display

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
			elif candidates and len(available_by_type[tag_type]) == sum(
				zh_match.group(1) == tag_type
				for zh_match in zh_matches
			):
				# The translated prose may reorder tags (e.g. "roll on table" ->
				# "on table roll").  If both sides contain the same number of a
				# given tag type, preserve the canonical tags in their relative
				# type-local order instead of degrading them to plain text.
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
				display = self._get_locked_tag_display(en_type, en_parts, zh_parts)
				display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(en_type, 2)
				parts = en_parts[:display_ix]
				if display and display != en_parts[0]:
					while len(parts) < display_ix:
						parts.append("")
					parts.append(display)
				return "{@" + en_type + " " + "|".join(parts) + "}"
			if en_type in DISPLAY_FIRST_TAGS:
				return "{@" + en_type + " " + "|".join([zh_parts[0], *en_parts[1:]]) + "}"
			if en_type in ADVANCED_REFERENCE_TAGS:
				display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX[en_type]
				display = self._get_locked_tag_display(en_type, en_parts, zh_parts)
				parts = en_parts[:display_ix]
				while len(parts) < display_ix:
					parts.append("")
				if display and display != en_parts[0]:
					parts.append(display)
				return "{@" + en_type + " " + "|".join(parts) + "}"
			if en_type in MECHANICAL_TAGS:
				# The first field is the roll/DC formula.  Remaining fields are
				# renderer-facing display labels and may be localized.
				parts = [en_parts[0], *zh_parts[1:]]
				return "{@" + en_type + " " + "|".join(parts) + "}"
			return match.group(0)

		return TAG_RE.sub(replace, translated)

	@staticmethod
	def _canonical_tag_signature(value: str) -> Counter[str]:
		out = []
		for match in TAG_RE.finditer(value):
			tag_type, body = match.group(1), match.group(2)
			parts = body.split("|")
			if tag_type in REFERENCE_TAGS | ADVANCED_REFERENCE_TAGS:
				display_ix = SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
				canonical = [parts[ix] if ix < len(parts) else "" for ix in range(display_ix)]
				out.append(json.dumps([tag_type, *canonical], ensure_ascii=False))
			elif tag_type in DISPLAY_FIRST_TAGS:
				out.append(json.dumps([tag_type, *parts[1:]], ensure_ascii=False))
			elif tag_type in MECHANICAL_TAGS:
				out.append(json.dumps([tag_type, parts[0] if parts else ""], ensure_ascii=False))
		return Counter(out)

	@staticmethod
	def _number_signature(value: str) -> list[str]:
		return sorted(extract_numeric_values(value))

	@staticmethod
	def _dice_signature(value: str) -> list[str]:
		# Compare die types everywhere and rely on canonical @dice/@damage tag
		# signatures for exact formulas.  This accepts faithful prose such as
		# "ten d10 Hit Dice" -> "10d10 生命骰" without treating it as a rule change.
		without_tags = TAG_RE.sub("", value)
		return sorted(match.group(0).casefold() for match in DIE_TYPE_RE.finditer(without_tags))

	def localize_string(self, english: str, translated: str, context: str) -> str:
		self.register_tag_translations(english, translated)
		out = self.reconcile_tags(english, self.normalize_text(translated), context)
		for source, replacement in PROJECT_TERM_REPLACEMENTS:
			out = out.replace(source, replacement)
		for source, replacement in POST_RECONCILE_REPLACEMENTS.get(context, ()):
			if source not in out:
				raise ValueError(f"Stale core-rules source repair at {context}: {source!r} not found")
			out = out.replace(source, replacement)
			self.report["sourceRepairsApplied"].append({"context": context, "from": source, "to": replacement})
		if self._canonical_tag_signature(english) != self._canonical_tag_signature(out):
			self.report["tagCanonicalDifferences"].append({
				"context": context,
				"english": english,
				"localized": out,
			})
		if self._dice_signature(english) != self._dice_signature(out):
			self.report["diceDifferences"].append({"context": context, "english": english, "localized": out})
		if self._number_signature(english) != self._number_signature(out):
			self.report["numericDifferences"].append({"context": context, "english": english, "localized": out})
		if ASCII_WORD_RE.search(english) and out == english:
			self.report["untranslatedVisibleStrings"].append({"context": context, "english": english})
		return out

	@staticmethod
	def _is_named(value) -> bool:
		return isinstance(value, dict) and isinstance(value.get("name"), str)

	def localize_node(
		self,
		english,
		translated,
		context: str,
		category: str,
		matcher: QuickRefMatcher | None = None,
	):
		if matcher and self._is_named(english):
			translated = matcher.resolve(english, context)

		if isinstance(english, str):
			if not isinstance(translated, str):
				self.report["typeShapeMismatches"].append({"context": context, "englishType": "str", "translatedType": type(translated).__name__})
				return english
			return self.localize_string(english, translated, context)

		if isinstance(english, list):
			if not isinstance(translated, list):
				self.report["typeShapeMismatches"].append({"context": context, "englishType": "list", "translatedType": type(translated).__name__})
				return deepcopy(english)
			if not matcher:
				if len(english) != len(translated):
					self.report["arrayShapeMismatches"].append({"context": context, "englishLength": len(english), "translatedLength": len(translated)})
				return [
					self.localize_node(child, translated[ix] if ix < len(translated) else None, f"{context}/{ix}", category)
					for ix, child in enumerate(english)
				]

			# Quick Reference named blocks were reordered.  Resolve each named
			# block globally and align only the remaining anonymous values locally.
			anonymous_translated = deque(child for child in translated if not (isinstance(child, dict) and child.get("ENG_name")))
			out = []
			for ix, child in enumerate(english):
				if self._is_named(child):
					out.append(self.localize_node(child, None, f"{context}/{ix}", category, matcher))
					continue
				translated_child = anonymous_translated.popleft() if anonymous_translated else None
				out.append(self.localize_node(child, translated_child, f"{context}/{ix}", category, matcher))
			return out

		if isinstance(english, dict):
			if not isinstance(translated, dict):
				self.report["typeShapeMismatches"].append({"context": context, "englishType": "dict", "translatedType": type(translated).__name__})
				return deepcopy(english)
			out = deepcopy(english)
			if isinstance(english.get("name"), str) and isinstance(translated.get("name"), str):
				out["ENG_name"] = english["name"]
				name_out = self.translate_name(english["name"], translated["name"], category)
				out["name"] = self.localize_string(english["name"], name_out, f"{context}/name") if TAG_RE.search(english["name"]) else name_out
			if isinstance(english.get("shortName"), str) and isinstance(translated.get("shortName"), str):
				out["ENG_shortName"] = english["shortName"]
				short_name_out = self.translate_name(english["shortName"], translated["shortName"], category)
				out["shortName"] = self.localize_string(english["shortName"], short_name_out, f"{context}/shortName") if TAG_RE.search(english["shortName"]) else short_name_out
			for key, english_value in english.items():
				if key in {"name", "shortName"} or key in CANONICAL_KEYS or key not in translated:
					continue
				if key in DIRECT_VISIBLE_KEYS | CONTENT_CONTAINER_KEYS:
					out[key] = self.localize_node(
						english_value,
						translated[key],
						f"{context}/{key}",
						category,
						matcher,
					)
			return out

		return deepcopy(english)


def pair_top_entities(english: list[dict], translated: list[dict], prop: str, report: dict) -> list[tuple[dict, dict | None]]:
	by_identity: dict[tuple[str | None, str | None], deque[dict]] = defaultdict(deque)
	for entity in translated:
		by_identity[(entity.get("ENG_name") or entity.get("name"), entity.get("source"))].append(entity)
	pairs = []
	used = 0
	for entity in english:
		identity = (entity.get("name"), entity.get("source"))
		match = by_identity[identity].popleft() if by_identity[identity] else None
		if match is None and (alias := SOURCE_ENG_NAME_ALIASES.get((prop, identity[0], identity[1]))):
			alias_identity = (alias, identity[1])
			match = by_identity[alias_identity].popleft() if by_identity[alias_identity] else None
			if match is not None:
				report.setdefault("sourceNameAliasesApplied", []).append({
					"arrayKind": prop,
					"englishName": identity[0],
					"translatedENGName": alias,
					"source": identity[1],
				})
		if match is None:
			report["unmatchedEnglishEntities"].append({"arrayKind": prop, "name": identity[0], "source": identity[1]})
		else:
			used += 1
		pairs.append((entity, match))
	for identity, remaining in by_identity.items():
		for _ in remaining:
			report["unmatchedTranslatedEntities"].append({"arrayKind": prop, "ENG_name": identity[0], "source": identity[1]})
	return pairs


def build_standard_file(
	localizer: Localizer,
	english_data: dict,
	translated_data: dict,
	props: tuple[str, ...],
	relative: str,
) -> tuple[dict, dict[str, int]]:
	output = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"conversion": "OpenCC s2twp; locked Class memory; approved first-candidate glossary",
			"license": "CC BY-NC-SA 4.0",
		},
	}
	counts = {}
	for prop in props:
		english_entities = english_data.get(prop, [])
		translated_entities = translated_data.get(prop, [])
		output[prop] = []
		for ix, (english, translated) in enumerate(pair_top_entities(english_entities, translated_entities, prop, localizer.report)):
			if translated is None:
				localized = deepcopy(english)
				if isinstance(english.get("name"), str):
					localized["ENG_name"] = english["name"]
			else:
				localized = localizer.localize_node(english, translated, f"{relative}/{prop}/{ix}", prop)
			output[prop].append(localized)
		counts[prop] = len(output[prop])
	return output, counts


def build_quickref(localizer: Localizer, english_data: dict, translated_data: dict) -> tuple[dict, dict]:
	matcher = QuickRefMatcher(translated_data.get("data", {}))
	english_reference = english_data["reference"]["bookref-quick"]
	translated_reference = translated_data["reference"]["bookref-quick"]
	reference = deepcopy(english_reference)
	reference["ENG_name"] = english_reference["name"]
	reference["name"] = localizer.translate_name(english_reference["name"], translated_reference["name"], "quickref")

	# Only the reference root and five chapter names lack ENG_name.  Chapter
	# headers are rebuilt in canonical English order from the 395 named blocks,
	# because the Chinese source reordered them.
	header_map = {
		english: sorted(values)[0]
		for english, values in localizer.source_name_translations.items()
		if values
	}
	for ix, english_chapter in enumerate(english_reference.get("contents", [])):
		translated_chapter = translated_reference.get("contents", [])[ix]
		chapter = deepcopy(english_chapter)
		chapter["ENG_name"] = english_chapter["name"]
		chapter["name"] = localizer.translate_name(english_chapter["name"], translated_chapter["name"], "quickref")
		chapter["headers"] = [
			localizer.translate_name(header, header_map.get(header, header), "quickref")
			for header in english_chapter.get("headers", [])
		]
		reference["contents"][ix] = chapter

	english_data_root = english_data["data"]["bookref-quick"]
	translated_data_root = translated_data["data"]["bookref-quick"]
	localized_data_root = localizer.localize_node(
		english_data_root,
		translated_data_root,
		"generated/bookref-quick.json/data/bookref-quick",
		"quickref",
		matcher,
	)
	output = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"conversion": "OpenCC s2twp; canonical named-block reconstruction",
			"license": "CC BY-NC-SA 4.0",
		},
		"reference": {"bookref-quick": reference},
		"data": {"bookref-quick": localized_data_root},
	}
	return output, {
		"matchedNamedBlocks": len(matcher.used_ids),
		"unmatchedEnglishNamedBlocks": matcher.unmatched_english,
		"unmatchedTranslatedNamedBlocks": matcher.unmatched_translated,
	}


def walk_named(value, out: list[dict]) -> None:
	if isinstance(value, list):
		for child in value:
			walk_named(child, out)
		return
	if not isinstance(value, dict):
		return
	if isinstance(value.get("name"), str):
		out.append(value)
	for child in value.values():
		walk_named(child, out)


def validate_canonical(english, localized, context: str, failures: list[dict]) -> None:
	if isinstance(english, list):
		if not isinstance(localized, list) or len(english) != len(localized):
			failures.append({"context": context, "reason": "array-shape"})
			return
		for ix, child in enumerate(english):
			validate_canonical(child, localized[ix], f"{context}/{ix}", failures)
		return
	if not isinstance(english, dict):
		return
	if not isinstance(localized, dict):
		failures.append({"context": context, "reason": "object-shape"})
		return
	if isinstance(english.get("name"), str) and localized.get("ENG_name") != english["name"]:
		failures.append({"context": f"{context}/name", "reason": "missing-english-name-backup"})
	for key, value in english.items():
		if key not in localized:
			failures.append({"context": f"{context}/{key}", "reason": "missing-key"})
			continue
		if key in CANONICAL_KEYS and localized[key] != value:
			failures.append({"context": f"{context}/{key}", "reason": "canonical-value-changed"})
		validate_canonical(value, localized[key], f"{context}/{key}", failures)


def main() -> None:
	args = parse_args()
	source_root = prepare_source(args)
	localizer = Localizer()

	guards = {}
	for relative, _ in FILE_SPECS:
		local_path = UPSTREAM_ROOT / relative
		backup_path = source_root / "data-bak" / relative
		translated_path = source_root / "data" / relative
		is_match = local_path.read_bytes() == backup_path.read_bytes()
		guards[relative] = {
			"localEnglishSha256": sha256(local_path),
			"sourceBackupSha256": sha256(backup_path),
			"translatedSourceSha256": sha256(translated_path),
			"byteIdentical": is_match,
		}
		if not is_match:
			raise SystemExit(f"English guard mismatch for {relative}; expected 5etools {UPSTREAM_TAG}")
		localizer.register_source_names(read_json(translated_path))

	# Learn translated tag displays from the seven structurally aligned files.
	for relative, _ in FILE_SPECS:
		if relative == "generated/bookref-quick.json":
			continue
		localizer.register_tag_translations(
			read_json(UPSTREAM_ROOT / relative),
			read_json(source_root / "data" / relative),
		)

	all_counts: dict[str, int] = {}
	quickref_report = {}
	outputs: dict[str, dict] = {}
	for relative, props in FILE_SPECS:
		english_data = read_json(UPSTREAM_ROOT / relative)
		translated_data = read_json(source_root / "data" / relative)
		if relative == "generated/bookref-quick.json":
			output, quickref_report = build_quickref(localizer, english_data, translated_data)
		else:
			output, counts = build_standard_file(localizer, english_data, translated_data, props, relative)
			if relative == "generated/gendata-variantrules.json":
				all_counts["generatedVariantrule"] = counts.get("variantrule", 0)
			else:
				all_counts.update(counts)
		outputs[relative] = output
		write_json(OUTPUT_ROOT / relative, output)

	quickref_named: list[dict] = []
	walk_named(outputs["generated/bookref-quick.json"], quickref_named)
	# The sidecar metadata has no name; the total is therefore exactly the
	# canonical 401 Quick Reference named objects.
	all_counts["quickrefNamedObjects"] = len(quickref_named)

	count_failures = {
		key: {"expected": expected, "actual": all_counts.get(key)}
		for key, expected in EXPECTED_COUNTS.items()
		if all_counts.get(key) != expected
	}
	canonical_failures = []
	for relative, _ in FILE_SPECS:
		english = read_json(UPSTREAM_ROOT / relative)
		localized = outputs[relative]
		# Sidecars add only _meta at the root; validate every canonical source key.
		for key, value in english.items():
			validate_canonical(value, localized.get(key), f"{relative}/{key}", canonical_failures)

	source_counts = defaultdict(Counter)
	for relative, props in FILE_SPECS:
		if relative == "generated/bookref-quick.json":
			continue
		for prop in props:
			for entity in outputs[relative].get(prop, []):
				source_counts[prop][entity.get("source", "(none)")] += 1

	index = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"license": "CC BY-NC-SA 4.0",
		},
		"files": [relative for relative, _ in FILE_SPECS],
		"entityCounts": all_counts,
	}
	write_json(OUTPUT_ROOT / "index.json", index)

	# Split raw QA findings into resolved/intentional and genuinely unresolved
	# buckets.  The report keeps the evidence and reason for every decision.
	numeric_raw = localizer.report.pop("numericDifferences")
	numeric_equivalent = []
	numeric_unresolved = []
	for item in numeric_raw:
		is_equivalent, reason = classify_numeric_difference(item)
		annotated = {**item, "reason": reason}
		(numeric_equivalent if is_equivalent else numeric_unresolved).append(annotated)
	localizer.report["numericDifferencesRawCount"] = len(numeric_raw)
	localizer.report["numericEquivalentDifferences"] = numeric_equivalent
	localizer.report["numericUnresolved"] = numeric_unresolved

	untranslated_raw = localizer.report.pop("untranslatedVisibleStrings")
	intentional_untranslated = [
		{**item, "reason": "mechanical/numeric table cell or retained rules unit"}
		for item in untranslated_raw
		if is_intentional_untranslated(item)
	]
	untranslated_unresolved = [item for item in untranslated_raw if not is_intentional_untranslated(item)]
	localizer.report["untranslatedVisibleStringsRawCount"] = len(untranslated_raw)
	localizer.report["intentionalUntranslatedStrings"] = intentional_untranslated
	localizer.report["untranslatedVisibleStrings"] = untranslated_unresolved

	tag_shape_raw = localizer.report.pop("tagShapeMismatches")
	if localizer.report["tagCanonicalDifferences"]:
		localizer.report["tagShapeMismatches"] = tag_shape_raw
		localizer.report["tagShapeDifferencesResolved"] = []
	else:
		localizer.report["tagShapeMismatches"] = []
		localizer.report["tagShapeDifferencesResolved"] = [
			{**item, "reason": "translated tag order/shape differed; canonical multiset restored"}
			for item in tag_shape_raw
		]

	report = {
		"status": "pass" if not (
			count_failures
			or canonical_failures
			or localizer.report["unmatchedEnglishEntities"]
			or localizer.report["unmatchedTranslatedEntities"]
			or quickref_report.get("unmatchedEnglishNamedBlocks")
			or quickref_report.get("unmatchedTranslatedNamedBlocks")
			or localizer.report["arrayShapeMismatches"]
			or localizer.report["typeShapeMismatches"]
			or localizer.report["tagShapeMismatches"]
			or localizer.report["tagCanonicalDifferences"]
			or localizer.report["diceDifferences"]
			or localizer.report["numericUnresolved"]
			or localizer.report["untranslatedVisibleStrings"]
		) else "needs-review",
		"source": {
			"repository": SOURCE_REPOSITORY,
			"commit": SOURCE_COMMIT,
			"license": "CC BY-NC-SA 4.0",
			"attribution": "Kiwee and contributors; DND Common Library; folk localization groups and independent translators",
		},
		"upstream": {"tag": UPSTREAM_TAG, "commit": UPSTREAM_COMMIT},
		"guards": guards,
		"counts": all_counts,
		"countFailures": count_failures,
		"sourceBreakdown": {key: dict(value) for key, value in source_counts.items()},
		"quickReference": quickref_report,
		"canonicalFailures": canonical_failures,
		"qa": localizer.report,
	}
	write_json(REPORT_PATH, report)

	print(json.dumps({
		"status": report["status"],
		"files": len(FILE_SPECS),
		"counts": all_counts,
		"guardFailures": sum(not item["byteIdentical"] for item in guards.values()),
		"canonicalFailures": len(canonical_failures),
		"unmatchedEntities": len(localizer.report["unmatchedEnglishEntities"]) + len(localizer.report["unmatchedTranslatedEntities"]),
		"quickrefMatched": quickref_report.get("matchedNamedBlocks", 0),
		"quickrefUnmatched": len(quickref_report.get("unmatchedEnglishNamedBlocks", [])) + quickref_report.get("unmatchedTranslatedNamedBlocks", 0),
		"arrayShapeMismatches": len(localizer.report["arrayShapeMismatches"]),
		"typeShapeMismatches": len(localizer.report["typeShapeMismatches"]),
		"tagShapeMismatches": len(localizer.report["tagShapeMismatches"]),
		"tagCanonicalDifferences": len(localizer.report["tagCanonicalDifferences"]),
		"diceDifferences": len(localizer.report["diceDifferences"]),
		"numericDifferencesRaw": localizer.report["numericDifferencesRawCount"],
		"numericEquivalentDifferences": len(localizer.report["numericEquivalentDifferences"]),
		"numericUnresolved": len(localizer.report["numericUnresolved"]),
		"intentionalUntranslatedStrings": len(localizer.report["intentionalUntranslatedStrings"]),
		"untranslatedVisibleStrings": len(localizer.report["untranslatedVisibleStrings"]),
	}, ensure_ascii=False, indent=2))

	if report["status"] != "pass":
		raise SystemExit(1)


if __name__ == "__main__":
	main()
