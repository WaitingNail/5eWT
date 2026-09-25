#!/usr/bin/env python3
"""Import Keys from the Golden Vault against the pinned English source."""
from pathlib import Path
import importlib.util
import re

spec = importlib.util.spec_from_file_location("expedition", Path(__file__).with_name("import-adventure-bgdia-toa.py"))
EXPEDITION = importlib.util.module_from_spec(spec)
spec.loader.exec_module(EXPEDITION)
BASE = EXPEDITION.BASE
DIRECTORY = BASE.ROOT / "translation/zh-TW/adventures/kftgv"
BOOKS = {"kftgv": "KftGV"}


class GoldenVaultLocalizer(EXPEDITION.ExpeditionLocalizer):
    def __init__(self, *args, **kwargs):
        EXPEDITION.WDH.WaterdeepLocalizer.__init__(self, *args, **kwargs)
        self.contextual = BASE.read(DIRECTORY / "contextual-terminology.json")
        self.context_patterns = [(term, entry, re.compile(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", re.I))
                                 for term, entry in self.contextual.items()]

    def translate_name(self, english, translated, category):
        text = super().translate_name(english, translated, category)
        if room := re.match(r"^([A-Z]{1,3}\d+[a-z]?)[.:]\s+", english):
            # The community draft mixes colons and periods; emit one room code.
            text = re.sub(r"^(?:" + re.escape(room[1]) + r"[.．、。:：]\s*)+", "", text)
            text = room[1] + ". " + text
        return text

    def localize_string(self, english, translated, context):
        text = super().localize_string(english, translated, context)
        if re.fullmatch(r"data/11/entries/9/entries/3/entries/3/rows/\d+/1", context) and english.startswith('"'):
            # True names are magical inputs. Ordinary name/word dictionaries
            # must not translate their spelling (for example the name "Knob").
            override = self.overrides[context]
            assert override["english"] == english
            return override["zh_tw"]
        return text


if __name__ == "__main__":
    BASE.main(books=BOOKS, directory=DIRECTORY, localizer_class=GoldenVaultLocalizer)
