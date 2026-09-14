#!/usr/bin/env python3
"""Create reproducible source-addressed inventories for both Vecna adventures."""
from pathlib import Path
from collections import Counter
import csv
import importlib.util
import re

spec = importlib.util.spec_from_file_location("vecna", Path(__file__).with_name("import-adventure-vecna.py"))
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)
B, D = V.BASE, V.DIRECTORY
glossary = B.read(D / "terminology.json")
contextual = B.read(D / "contextual-terminology.json")


def ancestry(document, context):
    page, types = None, []
    for key in context.strip("/").split("/"):
        if isinstance(document, dict):
            page = document.get("page", page)
            types.append(document.get("type", ""))
            document = document[key]
        else:
            document = document[int(key)]
    return page, types


def classify(context, text, types):
    if context.endswith(("/name", "/caption")) or "/colLabels/" in context:
        return "HEADING_LABEL", 0.99
    if "insetReadaloud" in types:
        return "READ_ALOUD", 0.99
    if "table" in types or "/rows/" in context:
        return "TABLE", 0.99
    if any(t.startswith("statblock") for t in types):
        return "STAT_BLOCK", 0.99
    if re.search(r"\{@(?:dc|damage|dice|hit|condition) |saving throw|ability check|advantage|hit points|spell slot", text, re.I):
        return ("MIXED", 0.85) if len(text) > 220 else ("RULE", 0.9)
    if re.search(r"\bcharacters?\b|\bparty\b|\byou can\b|\bif\b", text, re.I):
        return "DM_INSTRUCTION", 0.85
    return "NARRATIVE", 0.8


rows, summaries = [], {}
with (D / "block-classification.csv").open("w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, lineterminator="\n")
    writer.writerow(["book", "context", "page", "type", "classification_confidence", "english", "zh_tw"])
    for book, book_id in V.BOOKS.items():
        original = B.read(B.ROOT / f"vendor/5etools-src/data/adventure/adventure-{book}.json")
        translated = B.read(B.ROOT / f"data/zh-TW/adventures/adventure-{book}.json")
        counts = Counter()
        pairs = list(zip(B.strings(original), B.strings(translated)))
        for (path, en), (zh_path, zh) in pairs:
            assert path == zh_path, (path, zh_path)
            page, types = ancestry(original, path)
            kind, confidence = classify(path, en, types)
            writer.writerow([book_id, path.lstrip("/"), page, kind, confidence, en, zh])
            rows.append((book_id, path, page, en))
            counts[kind] += 1
        report = B.read(D / f"{book}-import-review.json")
        summaries[book_id] = {"chapters": len(original["data"]), "visibleStrings": len(pairs),
            "readaloudBlocks": sum(x["readaloudBlocks"] for x in report["chapterCounts"]),
            "blockClassification": dict(counts), "sourceGuardedCorrections": len(report["sourceGuardedCorrections"])}

with (D / "terminology-extraction.csv").open("w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f, lineterminator="\n")
    writer.writerow(["english", "zh_tw", "status", "scope", "first_book", "first_page", "first_context", "occurrences", "representative_source", "variants"])
    for term in sorted(set(glossary) | set(contextual)):
        entry = {**glossary.get(term, {}), **contextual.get(term, {})}
        pattern = re.compile(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", re.I)
        matches = [row for row in rows if pattern.search(row[3])]
        book, path, page, en = matches[0] if matches else ("", "", "", "")
        writer.writerow([term, entry["zh_tw"], entry.get("status", "project-proposed"), entry.get("scope", "canonical-name"),
            book, page, path.lstrip("/"), sum(len(pattern.findall(row[3])) for row in matches), en, ";".join(entry.get("aliases", []))])

B.write(D / "coverage-summary.json", {"books": summaries, "glossaryEntries": len(glossary),
    "contextualTerminologyRules": len(contextual),
    "classificationNote": "Heuristic field classification, not a translation quality score; see audit for review limits."})
print(summaries)
