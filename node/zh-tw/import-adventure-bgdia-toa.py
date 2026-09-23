#!/usr/bin/env python3
"""Build source-guarded Traditional Chinese editions of BGDIA and ToA."""
from pathlib import Path
import importlib.util
import re

spec = importlib.util.spec_from_file_location("wdh_importer", Path(__file__).with_name("import-adventure-wdh.py"))
WDH = importlib.util.module_from_spec(spec)
spec.loader.exec_module(WDH)
BASE = WDH.BASE
DIRECTORY = BASE.ROOT / "translation/zh-TW/adventures/bgdia-toa"
BOOKS = {"bgdia": "BGDIA", "toa": "ToA"}


class ExpeditionLocalizer(WDH.WaterdeepLocalizer):

    def lookup(self, english, prop=None, source=""):
        if prop == "spell" and not source:
            source = "PHB"
        return super().lookup(english, prop, source)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.contextual = BASE.read(DIRECTORY / "contextual-terminology.json")
        self.context_patterns = [(term, entry, re.compile(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", re.I))
                                 for term, entry in self.contextual.items()]

    def contextual_cleanup(self, english, text):
        aliases = {}
        for term, entry, source_pattern in self.context_patterns:
            if not source_pattern.search(english):
                continue
            aliases.update({value: entry["zh_tw"] for value in entry.get("aliases", [])})
            aliases[term] = entry["zh_tw"]
            aliases[entry["zh_tw"]] = entry["zh_tw"]
        if not aliases:
            return text
        # Only names proven to occur in this source field may be normalized.
        pattern = re.compile("|".join(re.escape(value) for value in sorted(aliases, key=len, reverse=True)))
        replace = lambda value: pattern.sub(lambda match: aliases[match[0]], value)
        def tag_display(match):
            tag, parts = match[1], match[2].split("|")
            if tag in BASE.CORE.REFERENCE_TAGS | BASE.CORE.ADVANCED_REFERENCE_TAGS:
                ix = BASE.CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag, 2)
                if len(parts) > ix:
                    parts[ix] = replace(parts[ix])
            elif tag in BASE.CORE.DISPLAY_FIRST_TAGS or tag in {"b", "i", "u", "s", "note", "sup", "sub"}:
                parts[0] = replace(parts[0])
            return "{@" + tag + " " + "|".join(parts) + "}"
        text = BASE.CORE.TAG_RE.sub(tag_display, text)
        return "".join(part if part.startswith("{@") else replace(part) for part in re.split(r"(\{@[^{}]+})", text))

    def localize_string(self, english, translated, context):
        if self.book == "toa" and re.fullmatch(r"data/0/entries/1/entries/1/rows/\d+/1", context):
            self.report.setdefault("preservedPronunciations", []).append(context)
            return english
        out = self.contextual_cleanup(english, BASE.TyrannyLocalizer.localize_string(self, english, translated, context))
        # The shared reference reconciler truncates optional class subclass/hash
        # parameters. Preserve those parameters from the authoritative source.
        classes = iter(re.findall(r"\{@class ([^{}]+)}", english))
        def restore_class(match):
            self.report.setdefault("preservedClassParameters", []).append(context)
            original = next(classes).split("|")
            localized = match[1].split("|")
            display = "邪魔" if original[2:] == ["the Fiend", "Fiend"] else localized[2] if len(localized) > 2 else self.lookup(original[0], "class") or original[0]
            return "{@class " + "|".join([original[0], original[1] if len(original) > 1 else "", display, *original[3:]]) + "}"
        out = re.sub(r"\{@class ([^{}]+)}", restore_class, out)
        checks = iter(re.findall(r"\{@skillCheck ([^{}]+)}", english))
        def restore_skill_check(match):
            self.report.setdefault("preservedSkillRolls", []).append(context)
            original = next(checks).split("|")
            localized = match[1].split("|")
            # The first parameter is a skill identifier plus its roll modifier.
            skill, modifier = original[0].split(" ", 1)
            display = localized[1] if len(localized) > 1 else f"{int(modifier):+d}"
            label = self.lookup(skill.replace("_", " "), "skill") or skill
            return "{@skillCheck " + "|".join([original[0], display, label]) + "}"
        out = re.sub(r"\{@skillCheck ([^{}]+)}", restore_skill_check, out)
        if self.book == "toa" and re.fullmatch(r"data/3/entries/4/entries/17/entries/4/entries/2/entries/[0-5]", context):
            # Handout 16 consumes these exact letters, including “caster” in its
            # shadow-casting sense. Chinese is a reading aid, not puzzle input.
            out += "（" + english + "）"
        return out

    def translate_name(self, english, translated, category):
        text = super().translate_name(english, translated, category)
        if room := re.match(r"^([A-Z]{1,3}\d+[a-z]?)[.:]\s+", english):
            text = room[1] + ". " + re.sub(r"^[A-Z]{1,3}\d+[a-z]?[.．、。:]\s*", "", text)
        return self.contextual_cleanup(english, text)


if __name__ == "__main__":
    BASE.main(books=BOOKS, directory=DIRECTORY, localizer_class=ExpeditionLocalizer)
