#!/usr/bin/env python3
"""Import both Vecna adventures while preserving source identity and mechanics."""
from pathlib import Path
import importlib.util
import re

spec = importlib.util.spec_from_file_location("wdh_importer", Path(__file__).with_name("import-adventure-wdh.py"))
WDH = importlib.util.module_from_spec(spec)
spec.loader.exec_module(WDH)
BASE = WDH.BASE
DIRECTORY = BASE.ROOT / "translation/zh-TW/adventures/vecna"
BOOKS = {"vnotee": "VNotEE", "veor": "VEoR"}


def apply_site_name_corrections():
    corrections = BASE.read(DIRECTORY / "site-name-corrections.json")
    path = BASE.ROOT / "data/zh-TW/bestiary/bestiary-veor.json"
    document = BASE.read(path)
    for entity in document["monster"]:
        if correction := corrections.get(entity.get("ENG_name")):
            if entity["name"] not in (correction["before"], correction["zh_tw"]):
                raise ValueError(f"Site name changed: {entity['ENG_name']}")
            entity["name"] = correction["zh_tw"]
    BASE.write(path, document)


class VecnaLocalizer(WDH.WaterdeepLocalizer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.contextual_terms = BASE.read(DIRECTORY / "contextual-terminology.json")

    def contextual_cleanup(self, english, text):
        if re.search(r"\bY\d+", english):
            text = re.sub(r"歪(?=\d+)", "Y", text)
        aliases = {}
        for term, entry in self.contextual_terms.items():
            if re.search(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", english, re.I):
                aliases.update({alias: entry["zh_tw"] for alias in entry["aliases"]})
                aliases[entry["zh_tw"]] = entry["zh_tw"]
        if aliases:
            pattern = re.compile("|".join(re.escape(x) for x in sorted(aliases, key=len, reverse=True)))
            replace = lambda value: pattern.sub(lambda match: aliases[match[0]], value)
            def replace_tag(match):
                tag, parts = match[1], match[2].split("|")
                if tag in BASE.CORE.REFERENCE_TAGS | BASE.CORE.ADVANCED_REFERENCE_TAGS:
                    ix = BASE.CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag, 2)
                    if len(parts) > ix:
                        parts[ix] = replace(parts[ix])
                elif tag in BASE.CORE.DISPLAY_FIRST_TAGS or tag in {"b", "i", "u", "s", "note", "sup", "sub"}:
                    parts[0] = replace(parts[0])
                return "{@" + tag + " " + "|".join(parts) + "}"
            text = BASE.CORE.TAG_RE.sub(replace_tag, text)
            text = "".join(part if part.startswith("{@") else replace(part)
                           for part in re.split(r"(\{@[^{}]+})", text))
        return text

    # Reuse canonical-name protection and reference-identity matching, but not
    # WDH's book-specific pronunciation-table and illustration-key positions.
    def localize_string(self, english, translated, context):
        text = BASE.TyrannyLocalizer.localize_string(self, english, translated, context)
        text = self.contextual_cleanup(english, text)
        if context.endswith("/name") and (room := re.match(r"^([A-Z]{1,3}\d+[a-z]?)[:.]\s+", english)):
            text = room[1] + ": " + re.sub(r"^[^:：.．]+[:：.．]\s*", "", text, count=1)
        return text

    def translate_name(self, english, translated, category):
        name = super().translate_name(english, translated, category)
        if room := re.match(r"^([A-Z]{1,3}\d+[a-z]?)[:.]\s+", english):
            name = re.sub(r"^[A-Z]{1,3}\d+[a-z]?[:：.．、]\s*", "", name)
            name = room[1] + ": " + name
        return self.contextual_cleanup(english, name)


if __name__ == "__main__":
    apply_site_name_corrections()
    BASE.main(books=BOOKS, directory=DIRECTORY, localizer_class=VecnaLocalizer)
