#!/usr/bin/env python3
"""Build guarded zh-TW sidecars for translated 5etools entity data.

The first supported content group is ``spells``.  Every localized entity is
paired to the pinned v2.33.3 English entity by canonical name and source.  The
output retains all mechanical and identity fields from English, while replacing
only renderer-visible prose.  Inline-reference targets are reconciled back to
their canonical English values before the sidecar is written.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
from collections import Counter
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
UPSTREAM_ROOT = ROOT / "data"
OUTPUT_ROOT = ROOT / "data" / "zh-TW"
TRANSLATION_ROOT = ROOT / "translation" / "zh-TW"
CORE_IMPORTER_PATH = Path(__file__).with_name("import-core-rules.py")

SOURCE_REPOSITORY = "https://github.com/tjliqy/5etools-cn"
SOURCE_COMMIT = "46b15d04f548c23c526084deae078e3568500349"
UPSTREAM_TAG = "v2.33.3"
UPSTREAM_COMMIT = "e5f3e77b303a92df10487207857200245e71957c"


def load_core_importer():
	spec = importlib.util.spec_from_file_location("zh_tw_core_importer", CORE_IMPORTER_PATH)
	if spec is None or spec.loader is None:
		raise SystemExit(f"Could not load shared importer: {CORE_IMPORTER_PATH}")
	module = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(module)
	return module


CORE = load_core_importer()


SPELL_EXACT_REPAIRS: dict[str, tuple[tuple[str, str], ...]] = {
	"spells/spells-ai.json/spell/6/entries/0/entries/0": (
		("最糟糕的90秒", "最糟糕的九十秒"),
	),
	"spells/spells-frhof.json/spell/2/entries/0": (
		("你創造一道形如劍刃的位面裂隙", "你創造一道 3 尺長、形如劍刃的位面裂隙"),
	),
	"spells/spells-bmt.json/spell/0/components/m": (
		("浪客Rogue", "遊蕩者"),
	),
	"spells/spells-egw.json/spell/9/entries/0": (
		("其回合開始時roll一個", "其回合開始時擲一個"),
	),
	"spells/spells-phb.json/spell/5/entries/0": (
		("松鼠squirrel，藍松鴉blue jay，或是蝙蝠bat", "松鼠、藍松鴉或蝙蝠"),
	),
	"spells/spells-phb.json/spell/16/entries/0": (
		("哈達，烏黯之飢渴Hadar, the Dark Hunger", "「烏黯之飢渴」哈達"),
	),
	"spells/spells-phb.json/spell/17/components/m/text": (
		("紅鋯石jacinth", "紅鋯石"),
	),
	"spells/spells-phb.json/spell/197/entries/1": (
		("魯那格Rudnogg", "魯那格"),
	),
	"spells/spells-phb.json/spell/311/entries/2": (
		("聖庫斯伯特St.Cuthbert", "聖庫斯伯特"),
		("托爾Thor", "索爾"),
	),
	"spells/spells-phb.json/spell/356/entries/2/items/3": (
		("擾亂生命Disrupt Life", "擾亂生命"),
	),
	"spells/spells-phb.json/spell/22/entries/0": (
		("利用施法的 8 小時引導", "利用施法時間引導"),
	),
	"spells/spells-phb.json/spell/81/components/m": (
		("所創造物品的一小部分", "一小片與你打算創造之物品同類的材料"),
	),
	"spells/spells-phb.json/spell/94/entries/0": (
		("（若有）。該法術可以穿透大部分障礙，但仍會被1尺厚石質，或1寸厚金屬質，或一層薄鉛質，或3尺厚木質或泥質材料阻隔。", "（若有）。"),
	),
	"spells/spells-phb.json/spell/96/entries/4": (
		("但其必須在其 30 尺內", "但其仍必須位於施法距離內"),
	),
	"spells/spells-phb.json/spell/131/entries/1": (
		("額外的{@filter 可選動物形態|bestiary|Miscellaneous=魔寵}可能會在DM的裁量下提供", "DM 可自行裁定是否提供額外的{@filter 可選動物形態|bestiary|Miscellaneous=魔寵}"),
	),
	"spells/spells-phb.json/spell/131/entries/5": (
		("（從以上列表選擇）。", "（從以上列表選擇）。你的魔寵會轉化為所選的生物。"),
	),
	"spells/spells-phb.json/spell/310/entries/1": (
		("在這 15 尺半徑的區域內", "在此區域內"),
	),
	"spells/spells-phb.json/spell/325/entries/9/entries/0": (
		("DM 重投 d100 並查閱上表", "DM 重新擲骰並查閱上表"),
	),
	"spells/spells-tce.json/spell/1/entries/1": (
		("兩個傷害都會在 11 級後再增加 1d8（{@damage 2d8}和 {@damage 3d8}），17 級後再加 1d8（{@damage 3d8}和{@damage 4d8}）。", "兩項傷害都會在 11 級時增加 1d8（提高為{@damage 2d8}和{@damage 3d8}），並在 17 級時再次增加相同幅度（提高為{@damage 3d8}和{@damage 4d8}）。"),
	),
	"spells/spells-tce.json/spell/3/entries/1": (
		("兩個傷害都會在 11 級後再增加{@damage 1d8}（{@damage 2d8}和{@damage 2d8}），17 級後再加 1d8（{@damage 3d8}和{@damage 3d8}）。", "兩項傷害在 11 級時各增加{@damage 1d8}（提高為{@damage 2d8}和{@damage 2d8}），並在 17 級時提高為{@damage 3d8}和{@damage 3d8}。"),
	),
	"spells/spells-xge.json/spell/8/entries/5/entries/0": (
		("一具處於你周圍 5 尺內的屍體", "一具屍體"),
	),
	"spells/spells-xge.json/spell/67/entries/1": (
		("專精Expertise", "專精"),
	),
	"spells/spells-xge.json/spell/35/entriesHigherLevel/0/entries/0": (
		("寒冷傷害便增加 1d6 {@scaledamage 2d6|1-9|1d6}點", "寒冷傷害便增加{@scaledamage 2d6|1-9|1d6}點"),
	),
	"spells/spells-xge.json/spell/75/entries/1/rows/2/1": (
		("3個{@filter", "8個{@filter"),
	),
	"spells/spells-xge.json/spell/80/entries/0": (
		("除你之外，在你周圍 5 尺範圍內的生物", "除你之外，位於施法距離內的每個生物"),
	),
	"spells/spells-xge.json/spell/80/scalingLevelDice/label": (
		("thunder damage", "雷鳴傷害"),
	),
	"spells/spells-xge.json/spell/92/entries/0": (
		("處於你周圍 5 尺內、", "處於施法距離內、"),
	),
	"spells/spells-xphb.json/spell/222/entriesHigherLevel/0/entries/0": (
		("使用高於五環的法術位時", "使用六環以上的法術位時"),
	),
	"spells/spells-xphb.json/spell/23/entries/0": (
		("Awakened Shrub", ""),
	),
	"spells/spells-xphb.json/spell/67/entries/0": (
		("元素位面Elemental Planes", "元素位面"),
	),
	"spells/spells-xphb.json/spell/72/entries/0": (
		("\"是Yes\"、\"不是No\"、\"可能Maybe\"、\"不可能Never\"、\"無關Irrelevant\"或\"不清楚Unclear\"", "「是」、「否」、「可能」、「絕不」、「無關」或「不清楚」"),
	),
	"spells/spells-xphb.json/spell/83/entries/0": (
		("墮影冥界Shadowfell", "墮影冥界"),
	),
	"spells/spells-xphb.json/spell/102/entries/2/entries/0": (
		("墮影冥界Shadowfell", "墮影冥界"),
		("妖精荒野Feywild", "妖精荒野"),
	),
	"spells/spells-xphb.json/spell/108/entries/0": (
		("上層位面Upper Planes", "上層位面"),
	),
	"spells/spells-xphb.json/spell/125/entries/0": (
		("以太位面Ethereal Plane", "以太位面"),
		("以太邊界Border Ethereal", "以太邊界"),
	),
	"spells/spells-xphb.json/spell/125/entries/3": (
		("外層位面Outer Plane", "外層位面"),
	),
	"spells/spells-xphb.json/spell/150/entries/0": (
		("星光位面Astral Plane", "星界位面"),
		("以太位面Ethereal Plane", "以太位面"),
		("妖精荒野Feywild", "妖精荒野"),
		("墮影冥界Shadowfell", "墮影冥界"),
	),
	"spells/spells-xphb.json/spell/196/entries/2/items/2/entries/0": (
		("（labyrinth）", ""),
	),
	"spells/spells-xphb.json/spell/261/entries/0": (
		("火元素位面Plane of Fire", "火元素位面"),
		("黃銅之城City of Brass", "黃銅城"),
		("九層地獄Nine Hells", "九層地獄"),
		("迪斯帕特Dispater", "迪斯帕特"),
	),
	"spells/spells-xphb.json/spell/242/entriesHigherLevel/0/entries/0": (
		("1 年內（八環）", "365 日內（八環）"),
	),
	"spells/spells-xphb.json/spell/289/entries/0": (
		("死亡時間不超過 100 年", "死亡時間不超過一個世紀"),
	),
	"spells/spells-xphb.json/spell/350/entries/4/entries/0": (
		("DM重骰d100並查閱上表", "DM重新擲骰並查閱上表"),
	),
	"spells/spells-xphb.json/spell/384/entries/3/items/6/entries/0": (
		("印記城City of Sigil", "印記城"),
		("痛苦女士Lady of Pain", "痛苦女士"),
	),
	"spells/spells-xphb.json/spell/384/entries/4": (
		("祈願術Wish", "祈願術"),
	),
}


class ContentLocalizer(CORE.Localizer):
	_SLOT_ABOVE_RE = re.compile(r"for each slot level above (\d+)(?:st|nd|rd|th)", re.IGNORECASE)

	def localize_string(self, english: str, translated: str, context: str) -> str:
		translated = self.normalize_text(translated)
		if match := self._SLOT_ABOVE_RE.search(english):
			base_level = match.group(1)
			translated, count = re.subn(
				r"使用的法術位每(?:比[^，。；]+)?高一環",
				f"使用的法術位每比 {base_level} 環高一環",
				translated,
				count=1,
			)
			if not count:
				translated, _ = re.subn(
					r"法術位每(?:比[^，。；]+)?高一環",
					f"法術位每比 {base_level} 環高一環",
					translated,
					count=1,
				)

		for source, replacement in SPELL_EXACT_REPAIRS.get(context, ()):
			if source not in translated:
				raise ValueError(f"Stale spell source repair at {context}: {source!r} not found")
			translated = translated.replace(source, replacement)
			self.report["sourceRepairsApplied"].append({
				"context": context,
				"from": source,
				"to": replacement,
			})

		return super().localize_string(english, translated, context)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser()
	parser.add_argument("group", choices=("spells",))
	parser.add_argument(
		"--source-dir",
		type=Path,
		required=True,
		help="root of the pinned 5etools-cn checkout containing data/ and data-bak/",
	)
	return parser.parse_args()


def read_json(path: Path):
	return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(value, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
	return hashlib.sha256(path.read_bytes()).hexdigest()


def get_spell_specs() -> list[tuple[str, tuple[str, ...]]]:
	spell_root = UPSTREAM_ROOT / "spells"
	return [
		*(
			(f"spells/{path.name}", ("spell",))
			for path in sorted(spell_root.glob("spells-*.json"))
		),
		*(
			(f"spells/{path.name}", ("spellFluff",))
			for path in sorted(spell_root.glob("fluff-spells-*.json"))
		),
	]


def localize_spell_time(localizer, english: dict, translated: dict, localized: dict, context: str) -> None:
	"""Translate only renderer-facing condition/note strings inside spell time."""
	english_times = english.get("time")
	translated_times = translated.get("time")
	localized_times = localized.get("time")
	if not all(isinstance(value, list) for value in (english_times, translated_times, localized_times)):
		return
	if not (len(english_times) == len(translated_times) == len(localized_times)):
		localizer.report["arrayShapeMismatches"].append({
			"context": f"{context}/time",
			"englishLength": len(english_times),
			"translatedLength": len(translated_times),
		})
		return
	for ix, (english_time, translated_time) in enumerate(zip(english_times, translated_times)):
		if not isinstance(english_time, dict) or not isinstance(translated_time, dict):
			continue
		for key in ("condition", "note"):
			if not isinstance(english_time.get(key), str) or not isinstance(translated_time.get(key), str):
				continue
			localized_times[ix][key] = localizer.localize_string(
				english_time[key],
				localizer.normalize_text(translated_time[key]),
				f"{context}/time/{ix}/{key}",
			)


def build_file(localizer, english_data: dict, translated_data: dict, props: tuple[str, ...], relative: str):
	output = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"conversion": "OpenCC s2twp; locked project terminology; canonical inline-tag reconciliation",
			"license": "CC BY-NC-SA 4.0",
		},
	}
	counts = {}
	for prop in props:
		english_entities = english_data.get(prop, [])
		translated_entities = translated_data.get(prop, [])
		output[prop] = []
		pairs = CORE.pair_top_entities(english_entities, translated_entities, prop, localizer.report)
		for ix, (english, translated) in enumerate(pairs):
			context = f"{relative}/{prop}/{ix}"
			if translated is None:
				localized = deepcopy(english)
				if isinstance(english.get("name"), str):
					localized["ENG_name"] = english["name"]
			else:
				localized = localizer.localize_node(english, translated, context, prop)
				if prop == "spell":
					localize_spell_time(localizer, english, translated, localized, context)
			output[prop].append(localized)
		counts[prop] = len(output[prop])
	return output, counts


_VISIBLE_DIRECT_KEYS = CORE.DIRECT_VISIBLE_KEYS | {"m", "condition", "note", "label"}


def validate_content_shape(english, localized, context: str, failures: list[dict], *, parent_key: str | None = None) -> None:
	"""Require every non-visible leaf to remain byte-for-byte equivalent."""
	if isinstance(english, list):
		if not isinstance(localized, list) or len(english) != len(localized):
			failures.append({"context": context, "reason": "array-shape"})
			return
		for ix, child in enumerate(english):
			validate_content_shape(child, localized[ix], f"{context}/{ix}", failures, parent_key=parent_key)
		return

	if isinstance(english, dict):
		if not isinstance(localized, dict):
			failures.append({"context": context, "reason": "object-shape"})
			return
		if isinstance(english.get("name"), str) and localized.get("ENG_name") != english["name"]:
			failures.append({"context": f"{context}/name", "reason": "missing-english-name-backup"})
		allowed_extra = {"ENG_name", "ENG_shortName"}
		for key in localized.keys() - english.keys() - allowed_extra:
			failures.append({"context": f"{context}/{key}", "reason": "unexpected-key"})
		for key, value in english.items():
			if key not in localized:
				failures.append({"context": f"{context}/{key}", "reason": "missing-key"})
				continue
			validate_content_shape(value, localized[key], f"{context}/{key}", failures, parent_key=key)
		return

	if english == localized:
		return
	if isinstance(english, str) and isinstance(localized, str):
		if parent_key in _VISIBLE_DIRECT_KEYS | CORE.CONTENT_CONTAINER_KEYS:
			return
		failures.append({"context": context, "reason": "non-visible-string-changed"})
		return
	failures.append({"context": context, "reason": "mechanical-value-changed"})


def finalize_qa(localizer) -> dict:
	report = localizer.report

	numeric_raw = report.pop("numericDifferences")
	numeric_equivalent = []
	numeric_unresolved = []
	for item in numeric_raw:
		is_equivalent, reason = CORE.classify_numeric_difference(item)
		annotated = {**item, "reason": reason}
		(numeric_equivalent if is_equivalent else numeric_unresolved).append(annotated)
	report["numericDifferencesRawCount"] = len(numeric_raw)
	report["numericEquivalentDifferences"] = numeric_equivalent
	report["numericUnresolved"] = numeric_unresolved

	untranslated_raw = report.pop("untranslatedVisibleStrings")
	intentional = [
		{**item, "reason": "mechanical/numeric text retained"}
		for item in untranslated_raw
		if CORE.is_intentional_untranslated(item)
	]
	report["untranslatedVisibleStringsRawCount"] = len(untranslated_raw)
	report["intentionalUntranslatedStrings"] = intentional
	report["untranslatedVisibleStrings"] = [
		item for item in untranslated_raw
		if not CORE.is_intentional_untranslated(item)
	]

	tag_shape_raw = report.pop("tagShapeMismatches")
	if report["tagCanonicalDifferences"]:
		report["tagShapeMismatches"] = tag_shape_raw
		report["tagShapeDifferencesResolved"] = []
	else:
		report["tagShapeMismatches"] = []
		report["tagShapeDifferencesResolved"] = [
			{**item, "reason": "translated tag order/shape differed; canonical multiset restored"}
			for item in tag_shape_raw
		]

	return report


def main() -> None:
	args = parse_args()
	source_root = args.source_dir.resolve()
	specs = get_spell_specs()
	localizer = ContentLocalizer()

	guards = {}
	for relative, _ in specs:
		local_path = UPSTREAM_ROOT / relative
		backup_path = source_root / "data-bak" / relative
		translated_path = source_root / "data" / relative
		for path in (local_path, backup_path, translated_path):
			if not path.is_file():
				raise SystemExit(f"Missing required file: {path}")
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

	for relative, _ in specs:
		localizer.register_tag_translations(
			read_json(UPSTREAM_ROOT / relative),
			read_json(source_root / "data" / relative),
		)

	outputs = {}
	counts = Counter()
	for relative, props in specs:
		output, file_counts = build_file(
			localizer,
			read_json(UPSTREAM_ROOT / relative),
			read_json(source_root / "data" / relative),
			props,
			relative,
		)
		outputs[relative] = output
		counts.update(file_counts)
		write_json(OUTPUT_ROOT / relative, output)

	canonical_failures = []
	for relative, _ in specs:
		english = read_json(UPSTREAM_ROOT / relative)
		localized = outputs[relative]
		for key, value in english.items():
			validate_content_shape(value, localized.get(key), f"{relative}/{key}", canonical_failures, parent_key=key)

	qa = finalize_qa(localizer)
	blocking_qa_keys = (
		"unmatchedEnglishEntities",
		"unmatchedTranslatedEntities",
		"arrayShapeMismatches",
		"typeShapeMismatches",
		"tagShapeMismatches",
		"unmatchedTranslatedTags",
		"tagCanonicalDifferences",
		"diceDifferences",
		"numericUnresolved",
		"untranslatedVisibleStrings",
	)
	status = "pass" if not canonical_failures and not any(qa[key] for key in blocking_qa_keys) else "needs-review"

	index = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"license": "CC BY-NC-SA 4.0",
		},
		"files": [relative.removeprefix("spells/") for relative, _ in specs],
		"entityCounts": dict(counts),
	}
	write_json(OUTPUT_ROOT / "spells" / "index.json", index)

	report = {
		"status": status,
		"source": {
			"repository": SOURCE_REPOSITORY,
			"commit": SOURCE_COMMIT,
			"license": "CC BY-NC-SA 4.0",
			"attribution": "Kiwee and contributors; DND Common Library; folk localization groups and independent translators",
		},
		"upstream": {"tag": UPSTREAM_TAG, "commit": UPSTREAM_COMMIT},
		"guards": guards,
		"counts": dict(counts),
		"canonicalFailures": canonical_failures,
		"qa": qa,
	}
	write_json(TRANSLATION_ROOT / "spells" / "generated" / "spell-import-report.json", report)

	print(json.dumps({
		"status": status,
		"files": len(specs),
		"counts": dict(counts),
		"canonicalFailures": len(canonical_failures),
		**{key: len(qa[key]) for key in blocking_qa_keys},
		"numericDifferencesRaw": qa["numericDifferencesRawCount"],
		"numericEquivalentDifferences": len(qa["numericEquivalentDifferences"]),
		"resolvedTagShapeDifferences": len(qa["tagShapeDifferencesResolved"]),
	}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
	main()
