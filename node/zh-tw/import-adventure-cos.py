#!/usr/bin/env python3
"""Import the pinned CoS translation, using the site's existing entity names.

Only display strings are translated. English structure, map data, identities,
source/version, and reference targets are retained and audited against v2.33.3.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import re
from collections import Counter, defaultdict
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("cos_content", Path(__file__).with_name("import-content-translations.py"))
CONTENT = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CONTENT)
CORE = CONTENT.CORE
CORE.ROOT = ROOT
CORE.CLASS_MEMORY_PATH = ROOT / "translation/zh-TW/classes/translation-memory.csv"
CORE.GLOSSARY_PATH = ROOT / "translation/zh-TW/glossary-proposed.csv"
# Card identities have three canonical fields; area IDs/flags are link targets.
CORE.REFERENCE_TAGS.add("card")
CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX["card"] = 3
CORE.DISPLAY_FIRST_TAGS.add("area")
CORE.MECHANICAL_TAGS.add("atk")
VISIBLE = CORE.DIRECT_VISIBLE_KEYS | CORE.CONTENT_CONTAINER_KEYS | {"images"}
TRANSLATION = ROOT / "translation/zh-TW/adventures/cos"
SOURCE_COMMIT = CONTENT.SOURCE_COMMIT


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")


def strings(value, path=""):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for i, child in enumerate(value):
            yield from strings(child, f"{path}/{i}")
    elif isinstance(value, dict):
        for key, child in value.items():
            if key in VISIBLE or key == "data":
                yield from strings(child, f"{path}/{key}")


def get_site_names():
    candidates = defaultdict(lambda: defaultdict(set))
    generic = defaultdict(set)
    provenance = defaultdict(set)
    aliases = {"monster": "creature", "monsterFluff": "creature", "spellFluff": "spell", "itemFluff": "item", "baseitem": "item", "itemGroup": "item", "legendaryGroup": "legroup"}

    def walk(value, prop, source, file):
        if isinstance(value, list):
            for child in value:
                walk(child, prop, source, file)
        elif isinstance(value, dict):
            source = value.get("source", source)
            english, chinese = value.get("ENG_name"), value.get("name")
            if isinstance(english, str) and isinstance(chinese, str) and re.search("[\u3400-\u9fff]", chinese):
                key = (prop, english.casefold(), source.casefold())
                candidates[key][chinese].add(file)
                generic[english.casefold()].add(chinese)
                provenance[(english.casefold(), chinese)].add(file)
            for key, child in value.items():
                if key not in {"_meta", "_copy"}:
                    walk(child, prop, source, file)

    for path in sorted((ROOT / "data/zh-TW").rglob("*.json")):
        if "adventures" in path.parts:
            continue
        document = read(path)
        if not isinstance(document, dict):
            continue
        for prop, values in document.items():
            if isinstance(values, list):
                walk(values, aliases.get(prop, prop.removesuffix("Fluff")), "", str(path.relative_to(ROOT)))
    return candidates, generic, provenance


class CosLocalizer(CONTENT.ContentLocalizer):
    def __init__(self, source):
        super().__init__()
        self.site, self.generic, self.provenance = get_site_names()
        self.used_terms = {}
        self.term_conflicts = []
        self.applied_overrides = set()
        self.overrides = read(TRANSLATION / "text-overrides.json") if (TRANSLATION / "text-overrides.json").exists() else {}
        self.aliases = {}
        self.register_source_names(source)
        for english, values in self.source_name_translations.items():
            existing = self.lookup(english)
            if existing:
                for candidate in values:
                    if candidate != existing:
                        self.aliases[candidate] = existing
        for npc in read(ROOT / "data/zh-TW/bestiary/bestiary-cos.json")["monster"]:
            if not (npc.get("isNpc") or npc.get("isNamedCreature")) or "·" not in npc["name"]:
                continue
            short = npc["name"].split("·")[0]
            converted = self.normalize_text(short)
            if converted != short:
                self.aliases[converted] = short

    def lookup(self, english, prop=None, source=""):
        key = (prop, english.casefold(), source.casefold())
        choices = self.site.get(key, {}) if prop else {}
        if not choices:
            choices = set().union(*(set(values) for (kind, name, _), values in self.site.items() if kind == prop and name == english.casefold())) if prop else self.generic.get(english.casefold(), set())
        if len(choices) == 1:
            zh = next(iter(choices))
            self.used_terms[(prop or "name", english, source)] = zh
            return zh
        if len(choices) > 1 and prop:
            record = {"english": english, "category": prop, "source": source, "choices": sorted(choices)}
            if record not in self.term_conflicts:
                self.term_conflicts.append(record)
        return None

    def normalize_text(self, text):
        text = super().normalize_text(text)
        # Established project faction spelling; no changes to lookup tokens.
        return self._apply_project_terms(text)

    def cleanup_visible(self, text):
        for before, after in sorted(self.aliases.items(), key=lambda item: -len(item[0])):
            text = text.replace(before, after)
        for before, after in (
            ("計程車兵", "的士兵"), ("計程車氣", "的士氣"),
            ("複活", "復活"), ("擴充套件其影響力", "擴大其影響力"),
            ("藍水旅店", "藍水旅館"), ("範·裡希滕", "範·裡希騰"),
            ("魯道夫範裡希滕", "魯道夫·範·裡希騰"),
            ("雕文", "雕紋"), ("一幅撲克牌", "一副撲克牌"),
            ("英尺", "尺"), ("英寸", "吋"),
            ("毫無意義、毫無意義", "徒勞無益、毫無意義"),
        ):
            text = text.replace(before, after)
        # Repair extraction spaces inside Chinese words. Lists with equals signs
        # and intentionally separated NPC labels retain their own delimiters.
        for before, after in (
            ("波 利 多 裡", "波利多里"), ("盡 管 他 會 獵 食", "儘管他會獵食"),
            ("升 入", "升入"), ("作為他 分裂", "作為他分裂"),
            ("時機 對角色", "時機對角色"), ("飛行的 人", "飛行的人"),
            ("飛行的 力量", "飛行的力量"), ("那他就 在", "那他就在"),
            ("並回 答", "並回答"), ("骨 粉", "骨粉"), ("的 木門", "的木門"),
            ("當一 名", "當一名"), ("天花板 的", "天花板的"),
            ("顯現 並", "顯現並"), ("若 是", "若是"), ("屈 服", "屈服"),
            ("沒 有", "沒有"),
        ):
            text = text.replace(before, after)
        return text

    def translate_name(self, english, translated, category):
        if re.fullmatch(r"[A-Z]?\d+[a-z]?", english):
            return english
        return self.lookup(english) or self.cleanup_visible(super().translate_name(english, translated, category))

    def _get_locked_tag_display(self, tag_type, en_parts, zh_parts):
        display_ix = CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
        # Explicit English aliases (e.g. "Strahd") are translated as aliases.
        if len(en_parts) > display_ix and en_parts[display_ix] and en_parts[display_ix].casefold() != en_parts[0].casefold():
            return self.cleanup_visible(super()._get_locked_tag_display(tag_type, en_parts, zh_parts))
        source = en_parts[2] if tag_type == "card" else en_parts[1] if len(en_parts) > 1 and en_parts[1] else {"creature": "MM", "spell": "PHB", "item": "DMG", "condition": "PHB", "skill": "PHB", "status": "PHB", "sense": "PHB"}.get(tag_type, "")
        return self.lookup(en_parts[0], tag_type, source) or self.cleanup_visible(super()._get_locked_tag_display(tag_type, en_parts, zh_parts))

    def localize_string(self, english, translated, context):
        if context in self.overrides:
            override = self.overrides[context]
            if override["english"] != english:
                raise ValueError(f"Stale translation override: {context}")
            translated = override["zh_tw"]
            self.applied_overrides.add(context)
        if context.startswith("data/1/entries/4/entries/8/entries/2/entries/4/rows/") and context.endswith("/0"):
            translated = re.sub(r"(\d+)(?:st|nd|rd|th)", r"\1", english) + "級"
        if context == "data/21/entries/2/colLabels/1":
            translated = "挑戰等級（CR）"
        translated = self.cleanup_visible(self.normalize_text(translated))
        out = super().localize_string(english, translated, context)
        # OpenCC is also invoked by the shared importer; apply prose repairs once
        # more without touching canonical tag parameters.
        parts = re.split(r"(\{@[^{}]+})", out)
        return "".join(part if part.startswith("{@") else self.cleanup_visible(part) for part in parts)

    def localize_node(self, english, translated, context, category="adventure"):
        if isinstance(english, str):
            if not isinstance(translated, str):
                raise ValueError(f"String shape mismatch at {context}")
            return self.localize_string(english, translated, context)
        if isinstance(english, list):
            if not isinstance(translated, list) or len(english) != len(translated):
                raise ValueError(f"Array shape mismatch at {context}")
            return [self.localize_node(a, b, f"{context}/{i}", category) for i, (a, b) in enumerate(zip(english, translated))]
        if isinstance(english, dict):
            if not isinstance(translated, dict):
                raise ValueError(f"Object shape mismatch at {context}")
            if "ENG_name" in translated and translated["ENG_name"] != english.get("name"):
                raise ValueError(f"Heading identity mismatch at {context}")
            out = deepcopy(english)
            for key in english:
                if key not in VISIBLE:
                    continue
                if key not in translated:
                    raise ValueError(f"Missing display property: {context}/{key}")
                if key == "name":
                    out["ENG_name"] = english[key]
                    name = translated[key] if f"{context}/{key}" in self.overrides else self.translate_name(english[key], translated[key], category)
                    out[key] = self.localize_string(english[key], name, f"{context}/{key}")
                else:
                    out[key] = self.localize_node(english[key], translated[key], f"{context}/{key}", category)
            return out
        return deepcopy(english)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True, help="Pinned data/ and data-bak/ download directory")
    parser.add_argument("--upstream-dir", type=Path, default=ROOT / "vendor/5etools-src")
    args = parser.parse_args()
    original = args.upstream_dir / "data/adventure/adventure-cos.json"
    guard = args.source_dir / "data-bak/adventure/adventure-cos.json"
    if original.read_bytes() != guard.read_bytes():
        raise ValueError("Pinned original differs from v2.33.3; review upstream changes first")
    english = read(original)
    source = read(args.source_dir / "data/adventure/adventure-cos.json")
    localizer = CosLocalizer(source)
    localizer.register_tag_translations(english, source)
    chapters = localizer.localize_node(english["data"], source["data"], "data")
    if unused := set(localizer.overrides) - localizer.applied_overrides:
        raise ValueError(f"Unused source-guarded corrections: {sorted(unused)}")
    index = next(e for e in read(args.upstream_dir / "data/adventures.json")["adventure"] if e["id"] == "CoS")
    source_index = next(e for e in read(args.source_dir / "data/adventures.json")["adventure"] if e["id"] == "CoS")
    localized_index = deepcopy(index)
    localized_index["ENG_name"] = index["name"]
    localized_index["name"] = localizer.translate_name(index["name"], source_index["name"], "adventure")
    for i, chapter in enumerate(localized_index["contents"]):
        chapter["ENG_name"] = chapter["name"]
        # The external table of contents contains older spellings (e.g. Vallaki).
        # Derive sidebar labels from the translated body to keep both identical.
        body_name = english["data"][i]["name"]
        if body_name == chapter["name"]:
            chapter["name"] = chapters[i]["name"]
        elif body_name.endswith(": " + chapter["name"]):
            chapter["name"] = chapters[i]["name"].split("：", 1)[-1]
        else:
            raise ValueError(f"Index/body chapter identity mismatch: {i}")
    output = {"_meta": {"locale": "zh-TW", "upstreamTag": CONTENT.UPSTREAM_TAG, "upstreamCommit": CONTENT.UPSTREAM_COMMIT, "upstreamSha256": hashlib.sha256(original.read_bytes()).hexdigest(), "translationSourceRepository": CONTENT.SOURCE_REPOSITORY, "translationSourceCommit": SOURCE_COMMIT, "conversion": "OpenCC s2twp; existing site terminology; source-guarded editorial corrections; canonical references", "license": "CC BY-NC-SA 4.0"}, "adventure": localized_index, "data": chapters}
    write(ROOT / "data/zh-TW/adventures/adventure-cos.json", output)
    numeric_review = []
    reviewed_equivalences = read(TRANSLATION / "reviewed-numeric-equivalences.json") if (TRANSLATION / "reviewed-numeric-equivalences.json").exists() else {}
    verified_equivalences = []
    for item in localizer.report["numericDifferences"]:
        is_equal, reason = CORE.classify_numeric_difference(item)
        if not is_equal:
            reviewed = reviewed_equivalences.get(item["context"])
            if reviewed and reviewed["englishSha256"] == hashlib.sha256(item["english"].encode()).hexdigest() and reviewed["localizedSha256"] == hashlib.sha256(item["localized"].encode()).hexdigest():
                verified_equivalences.append({"context": item["context"], **reviewed})
            else:
                numeric_review.append({**item, "reason": reason})
    localizer.report["numericReview"] = numeric_review
    localizer.report["reviewedNumericEquivalences"] = verified_equivalences
    localizer.report["termConflicts"] = localizer.term_conflicts
    localizer.report["sourceGuardedCorrections"] = sorted(localizer.applied_overrides)
    localizer.report["chapterCounts"] = [{"chapter": i, "english": e["name"], "name": z["name"], "visibleStrings": len(list(strings(z))), "readaloudBlocks": json.dumps(e).count('"insetReadaloud"')} for i, (e, z) in enumerate(zip(english["data"], chapters))]
    write(TRANSLATION / "import-review.json", localizer.report)
    with (TRANSLATION / "site-terminology.csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(["category", "english", "source", "zh_tw", "status", "existing_files"])
        for (prop, en, src), zh in sorted(localizer.used_terms.items()):
            writer.writerow([prop, en, src, zh, "existing-site", ";".join(sorted(localizer.provenance[(en.casefold(), zh)]))])
    print(json.dumps({key: len(value) for key, value in localizer.report.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
