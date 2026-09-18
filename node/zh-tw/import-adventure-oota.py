#!/usr/bin/env python3
"""Import Out of the Abyss while preserving source identity and mechanics."""
from pathlib import Path
import importlib.util
import re

spec = importlib.util.spec_from_file_location("wdh_importer", Path(__file__).with_name("import-adventure-wdh.py"))
WDH = importlib.util.module_from_spec(spec)
spec.loader.exec_module(WDH)
BASE = WDH.BASE
DIRECTORY = BASE.ROOT / "translation/zh-TW/adventures/oota"
BOOKS = {"oota": "OotA"}


def apply_site_name_corrections():
    corrections = BASE.read(DIRECTORY / "site-name-corrections.json")
    path = BASE.ROOT / "data/zh-TW/bestiary/bestiary-oota.json"
    document = BASE.read(path)
    for entity in document["monster"]:
        if correction := corrections.get(entity.get("ENG_name")):
            if entity["name"] not in (correction["before"], correction["zh_tw"]):
                raise ValueError(f"Site name changed: {entity['ENG_name']}")
            entity["name"] = correction["zh_tw"]
    BASE.write(path, document)


class OotaLocalizer(WDH.WaterdeepLocalizer):
    def _get_locked_tag_display(self, tag_type, en_parts, zh_parts):
        if tag_type == "quickref" and len(en_parts) > 4:
            if value := {"half cover": "半身掩護", "three-quarters cover": "四分之三掩護"}.get(en_parts[4].lower()):
                return value
        return super()._get_locked_tag_display(tag_type, en_parts, zh_parts)

    def lookup(self, english, prop=None, source=""):
        # Source-less spell tags in this 2014 adventure default to PHB, not XPHB.
        if prop == "spell" and not source:
            source = "PHB"
        return super().lookup(english, prop, source)
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.contextual_terms = BASE.read(DIRECTORY / "contextual-terminology.json")
        for entry in self.contextual_terms.values():
            entry["aliases"] = list(dict.fromkeys([*entry["aliases"], self.normalize_text(entry["zh_tw"])]))
        self.site_displays = {name for candidates in self.generic.values() for name in candidates}

    def contextual_cleanup(self, english, text):
        if re.search(r"\bY\d+", english):
            text = re.sub(r"歪(?=\d+)", "Y", text)
        aliases = {}
        for term, entry in self.contextual_terms.items():
            if entry.get("scope") == "heading-only":
                continue
            suffix = r"(?![A-Za-z0-9'’])" if term == "Y" else r"(?![A-Za-z])"
            if re.search(r"(?<![A-Za-z])" + re.escape(term) + suffix, english, re.I):
                aliases.update({alias: entry["zh_tw"] for alias in entry["aliases"]})
                aliases[entry["zh_tw"]] = entry["zh_tw"]
        if aliases:
            aliases = {key.casefold(): value for key, value in aliases.items()}
            pattern = re.compile("|".join(re.escape(x) for x in sorted(aliases, key=len, reverse=True)), re.I)
            replace = lambda value: pattern.sub(lambda match: aliases[match[0].casefold()], value)
            def replace_tag(match):
                tag, parts = match[1], match[2].split("|")
                if tag in BASE.CORE.REFERENCE_TAGS | BASE.CORE.ADVANCED_REFERENCE_TAGS:
                    ix = BASE.CORE.SPECIAL_REFERENCE_TAG_DISPLAY_INDEX.get(tag, 2)
                    if len(parts) > ix:
                        if parts[ix] not in self.site_displays:
                            parts[ix] = replace(parts[ix])
                elif tag in BASE.CORE.DISPLAY_FIRST_TAGS or tag in {"b", "i", "u", "s", "note", "sup", "sub"}:
                    parts[0] = replace(parts[0])
                return "{@" + tag + " " + "|".join(parts) + "}"
            text = BASE.CORE.TAG_RE.sub(replace_tag, text)
            text = "".join(part if part.startswith("{@") else replace(part)
                           for part in re.split(r"(\{@[^{}]+})", text))
        # The inherited display pass can already have expanded these stems.
        for before, after in {"布靈登石城城": "布靈登石城", "灰矮人爾": "灰矮人", "灰矮人矮人": "灰矮人", "鼠人人": "鼠人"}.items():
            text = text.replace(before, after)
        return text

    # Reuse canonical-name protection and reference-identity matching, but not
    # WDH's book-specific pronunciation-table and illustration-key positions.
    def localize_string(self, english, translated, context):
        text = BASE.TyrannyLocalizer.localize_string(self, english, translated, context)
        text = self.contextual_cleanup(english, text)
        # Passwords and quoted Drow expressions are literal utterances, not
        # untranslated prose; retain their spelling alongside Chinese meanings.
        literals = {"aluhal'kafion", "ku'lam", "ilkalik", "tyrnae", "Oloth tlu malla", "Lolth tlu malla"}
        source_italics = re.findall(r"\{@i ([^{}]+)}", english)
        if context.startswith("data/14/entries/9/entries/4/entries/7/entries/2/entries/"):
            literals.update(source_italics)
        target_italics = list(re.finditer(r"\{@i ([^{}]+)}", text))
        if len(source_italics) == len(target_italics):
            for original, match in reversed(list(zip(source_italics, target_italics))):
                if original in literals:
                    text = text[:match.start(1)] + original + text[match.end(1):]
        if context.endswith("/name") and (room := re.match(r"^([A-Z]{1,3}\d+[a-z]?)[:.]\s+", english)):
            text = room[1] + ": " + re.sub(r"^[^:：.．]+[:：.．]\s*", "", text, count=1)
        if text != english and re.search(r"[\u3400-\u9fff]", text):
            self.report["untranslatedVisibleStrings"] = [item for item in self.report["untranslatedVisibleStrings"] if item["context"] != context]
        return text

    def translate_name(self, english, translated, category):
        name = super().translate_name(english, translated, category)
        if room := re.match(r"^([A-Z]{1,3}\d+[a-z]?)[:.]\s+", english):
            name = re.sub(r"^[A-Z]{1,3}\d+[a-z]?[:：.．、]\s*", "", name)
            name = room[1] + ": " + name
        return self.contextual_cleanup(english, name)


if __name__ == "__main__":
    apply_site_name_corrections()
    BASE.main(books=BOOKS, directory=DIRECTORY, localizer_class=OotaLocalizer)
