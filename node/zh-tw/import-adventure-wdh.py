#!/usr/bin/env python3
"""Import Waterdeep: Dragon Heist with the shared adventure structural guards."""
from pathlib import Path
import importlib.util
import re

spec = importlib.util.spec_from_file_location("adventure_importer", Path(__file__).with_name("import-adventure-tyranny.py"))
BASE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(BASE)
DIRECTORY = BASE.ROOT / "translation/zh-TW/adventures/wdh"


def apply_site_name_corrections():
    corrections = BASE.read(DIRECTORY / "site-name-corrections.json")
    for filename, prop in (("bestiary-wdh.json", "monster"), ("fluff-bestiary-wdh.json", "monsterFluff")):
        path = BASE.ROOT / "data/zh-TW/bestiary" / filename
        document, changed = BASE.read(path), False
        for entity in document[prop]:
            if correction := corrections.get(entity.get("ENG_name")):
                if entity["name"] not in (correction["before"], correction["zh_tw"]):
                    raise ValueError(f"Site name changed; review correction for {entity['ENG_name']}")
                changed |= entity["name"] != correction["zh_tw"]
                entity["name"] = correction["zh_tw"]
        if changed:
            BASE.write(path, document)


class WaterdeepLocalizer(BASE.TyrannyLocalizer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Draft variants can collide with another person's locked name, notably
        # Laeral's draft spelling with the goddess Leira (蕾拉).
        for entry in self.glossary.values():
            if entry.get("scope") != "heading-only":
                self.aliases[entry["zh_tw"]] = entry["zh_tw"]
        self.alias_pattern = re.compile("|".join(re.escape(value) for value in sorted(self.aliases, key=len, reverse=True)))

    def _get_tag_match_score(self, tag_type, en_parts, zh_parts):
        # Chinese word order can reorder several tags of the same type.
        # Use the site's identity map before occurrence-paired draft evidence.
        if tag_type in BASE.CORE.REFERENCE_TAGS | BASE.CORE.ADVANCED_REFERENCE_TAGS and en_parts and zh_parts:
            key = lambda value: self._tag_token_key(self.cleanup_visible(value))
            display_ix = BASE.CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag_type, 2)
            if len(en_parts) > display_ix and len(zh_parts) > display_ix:
                if alias := self.english_names.get(en_parts[display_ix]):
                    if key(alias) == key(zh_parts[display_ix]):
                        return 250
            if self._tag_token_key(en_parts[0]) == self._tag_token_key(zh_parts[0]):
                return 200
            known = {self.lookup(en_parts[0], tag_type, en_parts[1] if len(en_parts) > 1 else "")}
            if entry := self.glossary.get(en_parts[0]):
                known.update([entry["zh_tw"], *entry.get("aliases", [])])
            known.update(self.source_name_translations.get(en_parts[0], set()))
            if key(zh_parts[0]) in {key(value) for value in known if value}:
                return 150
        return super()._get_tag_match_score(tag_type, en_parts, zh_parts)

    def localize_string(self, english, translated, context):
        if re.fullmatch(r"data/0/entries/5/entries/0/rows/\d+/1", context):
            self.report.setdefault("preservedPronunciations", []).append(context)
            return english
        if re.fullmatch(r"data/0/entries/5/entries/0/rows/\d+/0", context) and "{@" not in english:
            name = english.removesuffix(" (month)")
            if label := self.english_names.get(name):
                translated = label + ("（月份）" if name != english else "")
        if re.fullmatch(r"data/13/entries/3/entries/1/items/\d+", context):
            if match := re.fullmatch(r"(\d+\. )(.+?)( \(proprietor\))?", english):
                name = match[2]
                label = self.lookup(name) or self.glossary.get(name, {}).get("zh_tw")
                if label:
                    translated = match[1] + label + ("（店主）" if match[3] else "")
        return super().localize_string(english, translated, context)

    def cleanup_visible(self, text):
        text = re.sub(r"(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])", "", text)
        text = super().cleanup_visible(text)
        for before, after in (("家族家族", "家族"), ("成員成員", "成員"),
                              ("部分割槽域", "部分區域"), ("大部分割槽域", "大部分區域"),
                              ("Lord 達格魯特 無燼", "達格魯特·無燼領主"),
                              ("Lord 達格魯特無燼", "達格魯特·無燼領主"),
                              ("Lord 無燼", "無燼領主")):
            text = text.replace(before, after)
        return text

    def translate_name(self, english, translated, category):
        name = super().translate_name(english, translated, category)
        if room := re.match(r"^([A-Z]{0,2}\d+[a-z]?\.)\s+", english):
            name = re.sub(r"^[A-Z]{0,2}\d+[a-z]?[.．、。]\s*", "", name)
            name = room[1] + " " + name
        return name


if __name__ == "__main__":
    apply_site_name_corrections()
    BASE.main(books={"wdh": "WDH"}, directory=DIRECTORY, localizer_class=WaterdeepLocalizer)
