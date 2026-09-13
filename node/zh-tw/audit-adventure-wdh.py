#!/usr/bin/env python3
"""Produce source-addressed terminology and display-block inventories for WDH."""
from pathlib import Path
import csv
import importlib.util
import re
from collections import Counter

spec = importlib.util.spec_from_file_location("wdh", Path(__file__).with_name("import-adventure-wdh.py"))
WDH = importlib.util.module_from_spec(spec)
spec.loader.exec_module(WDH)
BASE = WDH.BASE
ROOT, DIRECTORY = BASE.ROOT, WDH.DIRECTORY
english = BASE.read(ROOT / "vendor/5etools-src/data/adventure/adventure-wdh.json")
localized = BASE.read(ROOT / "data/zh-TW/adventures/adventure-wdh.json")
glossary = BASE.read(DIRECTORY / "terminology.json")
pairs = list(zip(BASE.strings(english), BASE.strings(localized)))


def ancestry(context):
    value, page, types = english, None, []
    for key in context.strip("/").split("/"):
        if isinstance(value, dict):
            page = value.get("page", page)
            types.append(value.get("type", ""))
            value = value[key]
        else:
            value = value[int(key)]
    return page, types


def classify(context, text, types):
    if context.endswith(("/name", "/caption")) or "/colLabels/" in context:
        return "HEADING_LABEL", 0.99
    if "insetReadaloud" in types:
        return "READ_ALOUD", 0.99
    if "table" in types or "/rows/" in context:
        return "TABLE", 0.99
    if any(kind.startswith("statblock") for kind in types):
        return "STAT_BLOCK", 0.99
    rule = re.search(r"\{@(?:dc|damage|dice|hit|condition) |saving throw|ability check|advantage|hit points|spell slot", text, re.I)
    if rule:
        return ("MIXED", 0.85) if len(text) > 220 else ("RULE", 0.90)
    if text.startswith(('"', "“")) and text.endswith(('"', "”")):
        return "NPC_DIALOGUE", 0.85
    if re.search(r"\bcharacters?\b|\bparty\b|\byou can\b|\bif\b", text, re.I):
        return "DM_INSTRUCTION", 0.85
    if context.endswith("/title") and len(text) < 100:
        return "HEADING_LABEL", 0.85
    return "NARRATIVE", 0.80


counts = Counter()
pages = {}
with (DIRECTORY / "block-classification.csv").open("w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, lineterminator="\n")
    writer.writerow(["context", "page", "type", "classification_confidence", "english", "zh_tw"])
    for (context, original), (_, translated) in pairs:
        page, types = ancestry(context)
        pages[context] = page
        kind, confidence = classify(context, original, types)
        counts[kind] += 1
        writer.writerow([context.lstrip("/"), page, kind, confidence, original, translated])

with (DIRECTORY / "terminology-extraction.csv").open("w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, lineterminator="\n")
    writer.writerow(["english", "category", "first_page", "occurrences", "first_context", "representative_source", "confidence", "zh_tw", "status", "scope", "variants", "evidence"])
    for name, entry in sorted(glossary.items()):
        pattern = re.compile(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])")
        matches = [(p, text) for (p, text), _ in pairs if pattern.search(text)]
        context, sample = matches[0] if matches else ("", "")
        category = "heading/rule" if entry.get("scope") == "heading-only" else "possible-proper-noun"
        status = entry.get("status", "project-proposed")
        writer.writerow([name, category, pages.get(context), sum(len(pattern.findall(text)) for _, text in matches), context.lstrip("/"), sample,
                         0.95 if status.startswith("existing") else 0.80, entry["zh_tw"], status, entry.get("scope", "contextual"),
                         ";".join(entry.get("aliases", [])), entry.get("evidence", "")])

BASE.write(DIRECTORY / "coverage-summary.json", {
    "chapters": len(english["data"]), "visibleStrings": len(pairs), "blockClassification": dict(counts),
    "glossaryEntries": len(glossary), "pronunciationRowsPreserved": len(english["data"][0]["entries"][5]["entries"][0]["rows"]),
    "classificationNote": "Heuristic classification confidence, not a translation-quality score. See audit report for verification limits.",
})
print(dict(counts))
