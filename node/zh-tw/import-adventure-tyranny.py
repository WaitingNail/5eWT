#!/usr/bin/env python3
"""Import both Tyranny of Dragons volumes against the pinned English source.

Reuses the CoS structural guard and canonical reference reconciliation. Both
books share terminology; identities, mechanics and maps always come from English.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import re
from collections import defaultdict
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("cos_importer", Path(__file__).with_name("import-adventure-cos.py"))
COS = importlib.util.module_from_spec(spec)
spec.loader.exec_module(COS)
CONTENT, CORE = COS.CONTENT, COS.CORE
read, write, strings = COS.read, COS.write, COS.strings
DIRECTORY = ROOT / "translation/zh-TW/adventures/tyranny"
BOOKS = {"hotdq": "HotDQ", "rot": "RoT"}


class TyrannyLocalizer(COS.CosLocalizer):
    def __init__(self, sources, book, site_names):
        CONTENT.ContentLocalizer.__init__(self)
        self.site, self.generic, self.provenance = site_names
        self.book = book
        self.used_terms, self.term_conflicts, self.aliases = {}, [], {}
        self.applied_overrides = set()
        self.overrides = read(DIRECTORY / "text-overrides.json").get(book, {})
        self.glossary = read(DIRECTORY / "terminology.json")
        self.shared_names = {}
        for source in sources.values():
            self.register_source_names(source)
        for english, candidates in self.source_name_translations.items():
            existing = self.lookup(english)
            chosen = existing or self.glossary.get(english, {}).get("zh_tw")
            if chosen:
                for candidate in candidates:
                    if candidate != chosen and len(candidate) >= 2 and re.search("[\u3400-\u9fff]", candidate):
                        self.aliases[candidate] = chosen
        for english, entry in self.glossary.items():
            for alias in [*entry.get("aliases", []), self.normalize_text(entry["zh_tw"])]:
                if alias != entry["zh_tw"]:
                    self.aliases[alias] = entry["zh_tw"]
        self.english_names = {en: entry["zh_tw"] for en, entry in self.glossary.items()}
        for source in sources.values():
            for _, value in strings(source):
                for word in re.findall(r"[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’-]*)*", CORE.TAG_RE.sub("", value)):
                    if word in self.english_names or word in {"NPC", "DM", "DC", "XP", "Gauntlet", "Thayan", "adventure"}:
                        continue
                    existing = self.lookup(word)
                    if existing:
                        self.english_names[word] = existing
                        converted = self.normalize_text(existing)
                        if converted != existing:
                            self.aliases[converted] = existing
        # Protect canonical words from shorter aliases occurring inside them.
        for canonical in [*self.aliases.values(), *self.english_names.values()]:
            self.aliases.setdefault(canonical, canonical)
        self.alias_pattern = re.compile("|".join(re.escape(x) for x in sorted(self.aliases, key=len, reverse=True))) if self.aliases else None
        self.english_pattern = re.compile(r"(?<![A-Za-z])(?:" + "|".join(re.escape(x) for x in sorted(self.english_names, key=len, reverse=True)) + r")(?![A-Za-z])")

    def cleanup_visible(self, text):
        if getattr(self, "alias_pattern", None):
            text = self.alias_pattern.sub(lambda m: self.aliases[m[0]], text)
        if getattr(self, "english_pattern", None):
            text = self.english_pattern.sub(lambda m: self.english_names[m[0]], text)
        for before, after in (("計程車兵", "的士兵"), ("計程車氣", "的士氣"),
                              ("複活", "復活"), ("英尺", "尺"), ("英寸", "吋"),
                              ("幷", "並"), ("瞭如何", "了如何")):
            text = text.replace(before, after)
        return text

    def translate_name(self, english, translated, category):
        name = self.lookup(english) or self.glossary.get(english, {}).get("zh_tw")
        name = name or self.cleanup_visible(CONTENT.ContentLocalizer.translate_name(self, english, translated, category))
        # Preserve printed room labels even when the initial translation lost one
        # or confused a letter with a digit (notably 1O versus 10).
        if room := re.match(r"^(\d+[A-Za-z]?(?:\s*(?:and|–|-)\s*\d+[A-Za-z]?)?\.)\s+", english):
            name = re.sub(r"^\d+[A-Za-z]?(?:\s*(?:and|和|與|–|-)\s*\d+[A-Za-z]?)?[.．、。]\s*", "", name)
            name = room[1] + " " + name
        if chapter := re.match(r"^(Chapter|Appendix) ([\dA-Z]+): ", english):
            name = re.sub(r"^(?:第[\d一二三四五六七八九十]+章|附錄\s*[A-Z])\s*[:：]\s*", "", name)
            name = (f"第{chapter[2]}章" if chapter[1] == "Chapter" else f"附錄{chapter[2]}") + "：" + name
        # Identical headings in these two linked books use one label. Contextual
        # differences must be entered explicitly in the guarded overrides.
        return self.shared_names.setdefault(english, name)

    def _get_locked_tag_display(self, tag_type, en_parts, zh_parts):
        display_ix = CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
        if len(en_parts) > display_ix and en_parts[display_ix]:
            alias = en_parts[display_ix]
            base = en_parts[0]
            if alias.casefold() in {base.casefold() + ending for ending in ("s", "es", "'s", "’s")}:
                source = en_parts[1] if len(en_parts) > 1 else ""
                if value := self.lookup(base, tag_type, source):
                    return value
            if alias in self.english_names:
                return self.english_names[alias]
        return super()._get_locked_tag_display(tag_type, en_parts, zh_parts)

    def localize_string(self, english, translated, context):
        if context in self.overrides:
            override = self.overrides[context]
            if override["english"] != english:
                raise ValueError(f"Stale source correction: {self.book}/{context}")
            translated = override["zh_tw"]
            self.applied_overrides.add(context)
        translated = self.normalize_text(translated)
        translated = re.sub(r"\{@(b|i|u|s|note|sup|sub) ([^{}]*)}",
                            lambda m: "{@" + m[1] + " " + self.cleanup_visible(m[2]) + "}", translated)
        translated = "".join(part if part.startswith("{@") else self.cleanup_visible(part)
                             for part in re.split(r"(\{@[^{}]+})", translated))
        out = CONTENT.ContentLocalizer.localize_string(self, english, translated, context)
        def display_tag(match):
            tag, parts = match[1], match[2].split("|")
            if tag in CORE.DISPLAY_FIRST_TAGS or tag in {"b", "i", "u", "s", "note", "sup", "sub"}:
                parts[0] = self.cleanup_visible(parts[0])
            elif tag in CORE.REFERENCE_TAGS | CORE.ADVANCED_REFERENCE_TAGS:
                ix = CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag, 2)
                if len(parts) > ix:
                    parts[ix] = self.cleanup_visible(parts[ix])
            return "{@" + tag + " " + "|".join(parts) + "}"
        out = CORE.TAG_RE.sub(display_tag, out)
        return "".join(part if part.startswith("{@") else self.cleanup_visible(part)
                       for part in re.split(r"(\{@[^{}]+})", out))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--upstream-dir", type=Path, default=ROOT / "vendor/5etools-src")
    args = parser.parse_args()
    sources = {key: read(args.source_dir / f"data/adventure/adventure-{key}.json") for key in BOOKS}
    indexes = read(args.upstream_dir / "data/adventures.json")["adventure"]
    source_indexes = read(args.source_dir / "data/adventures.json")["adventure"]
    site_names = COS.get_site_names()
    shared_names, all_terms, heading_rows = {}, {}, []
    summaries = {}
    for book, book_id in BOOKS.items():
        original = args.upstream_dir / f"data/adventure/adventure-{book}.json"
        if original.read_bytes() != (args.source_dir / f"data-bak/adventure/adventure-{book}.json").read_bytes():
            raise ValueError(f"{book_id}: upstream changed from the pinned source")
        english, source = read(original), sources[book]
        localizer = TyrannyLocalizer(sources, book, site_names)
        localizer.shared_names = shared_names
        localizer.register_tag_translations(english, source)
        chapters = localizer.localize_node(english["data"], source["data"], "data")
        if unused := set(localizer.overrides) - localizer.applied_overrides:
            raise ValueError(f"Unused corrections: {book}/{sorted(unused)}")
        index = next(e for e in indexes if e["id"] == book_id)
        source_index = next(e for e in source_indexes if e["id"] == book_id)
        translated_index = deepcopy(index)
        translated_index["ENG_name"] = index["name"]
        translated_index["name"] = localizer.translate_name(index["name"], source_index["name"], "adventure")
        for i, chapter in enumerate(translated_index["contents"]):
            chapter["ENG_name"] = chapter["name"]
            if english["data"][i]["name"] == chapter["name"]:
                chapter["name"] = chapters[i]["name"]
            elif english["data"][i]["name"].endswith(": " + chapter["name"]):
                chapter["name"] = chapters[i]["name"].split("：", 1)[-1]
            else:
                raise ValueError(f"Chapter index mismatch: {book}/{i}")
        output = {"_meta": {"locale": "zh-TW", "upstreamTag": CONTENT.UPSTREAM_TAG,
                  "upstreamCommit": CONTENT.UPSTREAM_COMMIT, "upstreamSha256": hashlib.sha256(original.read_bytes()).hexdigest(),
                  "translationSourceRepository": CONTENT.SOURCE_REPOSITORY, "translationSourceCommit": CONTENT.SOURCE_COMMIT,
                  "translationSourceSha256": hashlib.sha256((args.source_dir / f"data/adventure/adventure-{book}.json").read_bytes()).hexdigest(),
                  "conversion": "OpenCC s2twp; existing site and cross-volume terminology; source-guarded corrections; canonical references",
                  "license": "CC BY-NC-SA 4.0"}, "adventure": translated_index, "data": chapters}
        write(ROOT / f"data/zh-TW/adventures/adventure-{book}.json", output)
        review = localizer.report
        review["numericReview"] = []
        review["reviewedNumericEquivalences"] = []
        reviewed = read(DIRECTORY / "reviewed-numeric-equivalences.json").get(book, {})
        for item in review["numericDifferences"]:
            equal, reason = CORE.classify_numeric_difference(item)
            if not equal:
                accepted = reviewed.get(item["context"])
                if accepted and accepted["englishSha256"] == hashlib.sha256(item["english"].encode()).hexdigest() and accepted["localizedSha256"] == hashlib.sha256(item["localized"].encode()).hexdigest():
                    review["reviewedNumericEquivalences"].append({"context": item["context"], **accepted})
                else:
                    review["numericReview"].append({**item, "reason": reason})
        review["termConflicts"] = localizer.term_conflicts
        review["sourceGuardedCorrections"] = sorted(localizer.applied_overrides)
        review["chapterCounts"] = [{"chapter": i, "english": en["name"], "name": zh["name"],
                                   "visibleStrings": len(list(strings(zh))), "readaloudBlocks": json.dumps(en).count('"insetReadaloud"')}
                                  for i, (en, zh) in enumerate(zip(english["data"], chapters))]
        for (context, en), (_, zh) in zip(strings(english), strings(output)):
            if context.endswith("/name"):
                heading_rows.append([book_id, context, en, zh, "existing-site" if en.casefold() in localizer.generic else "project-proposed"])
        write(DIRECTORY / f"{book}-import-review.json", review)
        all_terms.update(localizer.used_terms)
        summaries[book] = {key: len(value) for key, value in review.items()}
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    with (DIRECTORY / "site-terminology.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["category", "english", "source", "zh_tw", "status", "existing_files"])
        for (prop, en, src), zh in sorted(all_terms.items()):
            writer.writerow([prop, en, src, zh, "existing-site", ";".join(sorted(site_names[2][(en.casefold(), zh)]))])
    with (DIRECTORY / "chapter-labels.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["book", "context", "english", "zh_tw", "status"])
        writer.writerows(heading_rows)
    print(json.dumps(summaries, ensure_ascii=False))


if __name__ == "__main__":
    main()
