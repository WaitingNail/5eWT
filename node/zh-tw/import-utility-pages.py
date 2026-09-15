#!/usr/bin/env python3
"""Import the ten standalone reference/tool pages, never complete rulebooks.

Start from the pinned English structure. Translate a visible-field allowlist;
identity fields remain canonical and receive separate display fields. Source
layout repairs are explicit and guarded, not fuzzy entity matching.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "vendor/5etools-src/data" if (ROOT / "vendor/5etools-src/data").exists() else ROOT / "data"
OUT = ROOT / "data/zh-TW/utility-pages"
REPORT = ROOT / "translation/zh-TW/utility-pages/generated/import-report.json"
SPEC = importlib.util.spec_from_file_location("content_importer", Path(__file__).with_name("import-content-translations.py"))
CONTENT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONTENT)
CORE = CONTENT.CORE

FILES = ["trapshazards.json", "objects.json", "decks.json", "tables.json", "generated/gendata-tables.json", "life.json", "encounters.json", "loot.json", "names.json", "monsterfeatures.json"]
VISIBLE = CORE.DIRECT_VISIBLE_KEYS | CORE.CONTENT_CONTAINER_KEYS | {
    "threat", "effect", "trigger", "countermeasures", "eActive", "eDynamic", "eConstant",
    "condition", "initiativeNote", "reasons", "lifeTrinket", "table", "result", "option",
    "example", "attackEntries", "hitEntries", "actionEntries", "senses", "special",
    "captionPrefix", "captionSuffix", "instructions", "valueName",
}
DISPLAY = {"name", "shortName", "option", "threat", "senses", "valueName", "example", "suit"}
PROTECTED = CORE.CANONICAL_KEYS | {
    "cards", "set", "tier", "dpr", "ac", "hp", "cr", "immune", "resist", "vulnerable",
    "conditionImmune", "fromGroup", "fromGeneric", "fromItems", "item", "chapter", "credits",
    "face", "back", "credit", "exampleCreature", "diceExpression", "min", "max", "choose",
}
# Life class-specific tables have free-form English object keys. Keep those
# keys unchanged (the generator indexes by them) and localize their values.
LIFE_TABLES = {"Personal Totems", "Tattoo", "Superstitions", "Defining Work", "Instrument", "Embarrassment", "Temple", "Keepsake", "Secret", "Treasured Item", "Guiding Aspect", "Mentor", "Heraldic Sign", "Instructor", "Signature Style", "Monastery", "Monastic Icon", "Master", "Personal Goal", "Symbol", "Nemesis", "Temptation", "World View", "Homeland", "Sworn Enemy", "Guilty Pleasure", "Adversaries", "Benefactor", "Arcane Origin", "Reaction", "Supernatural Mark", "Sign of Sorcery", "Patron Attitude", "Special Terms", "Binding Mark", "Spellbook", "Ambition", "Eccentricity"}

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def bilingual(zh, en):
    if zh == en or not re.search(r"[\u3400-\u9fff]", zh):
        return en
    if zh.endswith(f"（{en}）"):
        return zh
    return f"{zh}（{en}）"

def repair_generated(en, zh):
    a, b = en["table"], zh["table"]
    assert len(a) == 2326 and len(b) == 2327
    assert a[1804]["name"] == "Weather" and a[1804]["source"] == "XDMG"
    assert all(x["source"] == "XDMG" and x["page"] == 38 for x in b[1804:1806])
    fixed = deepcopy(a[1804])
    fixed.update(name="天氣", caption="天氣", colLabels=["1d20", "氣溫", "風力", "降水"])
    fixed["rows"] = [
        ["1–14", "本季正常氣溫", "無", "無"],
        ["15–17", "比正常氣溫低 {@dice 1d4 × 10} 華氏度", "微風", "小雨或小雪"],
        ["18–20", "比正常氣溫高 {@dice 1d4 × 10} 華氏度", "強風", "大雨或大雪"],
    ]
    zh["table"] = b[:1804] + [fixed] + b[1806:]
    for prop in ("table", "tableGroup"):
        assert len(en[prop]) == len(zh[prop])
        for i, (x, y) in enumerate(zip(en[prop], zh[prop])):
            for key in ("source", "page"):
                assert x.get(key) == y.get(key), (prop, i, key)

class Localizer(CONTENT.ContentLocalizer):
    def __init__(self, overrides):
        super().__init__()
        self.overrides = overrides
        self.audit = []

    def text(self, en, zh, ctx, *, heading=False):
        zh = self.overrides.get(ctx, zh)
        if "/colLabels/" in ctx:
            zh = {"Insult": "辱罵（Insult）", "NPC": "非玩家角色（NPC）", "Encounter": "遭遇（Encounter）", "Attitude": "態度（Attitude）", "Name": "姓名（Name）"}.get(en, zh)
        zh = self.normalize_text(zh)
        # Reviewed source annotations duplicate the already translated noun.
        # Only remove them outside inline tags and in the audited table ranges.
        table_match = re.match(r"generated/gendata-tables.json/table/(\d+)/rows/", ctx)
        if table_match and (int(table_match[1]) == 60 or 231 <= int(table_match[1]) <= 240):
            zh = "".join(part if part.startswith("{@") else re.sub(r"[A-Za-z]+(?:[ '&]+[A-Za-z]+)*", "", part) for part in re.split(r"(\{@[^}]+\})", zh))
        duplicate_terms = "earthquake|magic missile|spiritual weapon|lightning bolt|flame strike|fireball|greater restoration|swarm of insects|razorvine|regenerate|blade barrier|Reverse gravity|magic missiles|disintegrate|thunderwave|confusion|polymorph|suggestion|random   obstacles|Obstacles table|yugoloth"
        if not heading:
            zh = "".join(part if part.startswith("{@") else re.sub(r"(?<=[\u3400-\u9fff}])(?:" + duplicate_terms + r")(?![A-Za-z])", "", part, flags=re.I) for part in re.split(r"(\{@[^}]+\})", zh))
            # The preceding inline tag was split off, so its adjacent duplicate
            # is at the beginning of the next plain-text fragment.
            zh = re.sub(r"}(?:" + duplicate_terms + r")(?![A-Za-z])", "}", zh, flags=re.I)
        repairs = {
            "decks.json/card/539/entries/1": "茲比爾娜的管家外表是一名身穿褪色棕衣的瘦長男子。辛寧斯渴望看到普里斯米爾的大妖精擺脫時間靜止，並讓她的敵人受到應有的懲罰。他會幫助任何目標與自己一致的人，但他厭惡暴力，也迴避戰鬥。",
            "generated/gendata-tables.json/table/73/rows/2/1": "匕首、雙匕（中國）；小柄、短刀（日本）",
            "generated/gendata-tables.json/table/73/rows/4/1": "雙節棍（日本）",
            "generated/gendata-tables.json/table/209/rows/1/1": "{@bold 失去一隻手臂或一隻手。}你無法再用雙手持握任何東西，而且一次只能持握一件物品。{@spell regenerate||再生術}或類似魔法可以恢復失去的附肢。",
            "generated/gendata-tables.json/table/2058/rows/1/1": "闕森坦蓮花乳酪",
        }
        zh = repairs.get(ctx, zh)
        for english, translated in {"eldritch機器": "魔能機器", "panpipes": "排簫", "ardragon": "高階龍首", "fomorian 的領地": "廢陋巨人的領地"}.items():
            if english in zh and not heading:
                zh = "".join(part if part.startswith("{@") else part.replace(english, translated) for part in re.split(r"(\{@[^}]+\})", zh))
        # Source transcription repairs, each scoped by the original wording
        # or exact data path; never infer a rule from the translated number.
        if re.fullmatch(r"\d*d\d+", en):
            zh = en
        if re.fullmatch(r"[\d,]+ GP", en):
            zh = en
        if ctx.startswith("generated/gendata-tables.json/tableGroup/") and "/colLabels/" in ctx and en.startswith("I became "):
            zh = re.sub(r"^d6\s*", "", zh)
        if ctx in {
            "generated/gendata-tables.json/table/384/rows/10/1", "generated/gendata-tables.json/table/579/rows/0/1",
            "generated/gendata-tables.json/table/579/rows/1/1", "generated/gendata-tables.json/table/579/rows/11/1",
            "generated/gendata-tables.json/table/637/rows/1/1", "generated/gendata-tables.json/table/723/rows/0/1",
            "generated/gendata-tables.json/table/723/rows/2/1", "generated/gendata-tables.json/table/723/rows/5/1",
            "generated/gendata-tables.json/table/1159/rows/1/1", "generated/gendata-tables.json/table/1256/rows/8/1",
            "generated/gendata-tables.json/table/1260/rows/1/1", "generated/gendata-tables.json/table/1265/rows/7/1",
            "generated/gendata-tables.json/table/1286/rows/5/1", "generated/gendata-tables.json/table/1692/rows/4/1",
            "generated/gendata-tables.json/tableGroup/7/tables/2/rows/0/1",
            "generated/gendata-tables.json/tableGroup/14/tables/8/rows/3/1", "life.json/lifeClass/8/reasons/3",
        }:
            zh = re.sub(r"^\d+[.：—\s]*", "", zh)
        if ctx in {"trapshazards.json/hazard/15/entries/0", "trapshazards.json/hazard/17/entries/0", "trapshazards.json/hazard/33/entries/1", "generated/gendata-tables.json/table/1918/rows/10/1"}:
            zh = re.sub(r"（譯(?:者注|註)[^）]+）", "", zh)
        if ctx == "generated/gendata-tables.json/table/1164/rows/6/1":
            zh = zh.replace("30尺", "60尺")
        if ctx in {"generated/gendata-tables.json/table/1592/rows/10/1", "generated/gendata-tables.json/table/1601/rows/10/1"}:
            zh = zh.replace("1，000", "1,000")
        if ctx in {"generated/gendata-tables.json/tableGroup/1/tables/1/rows/2/1", "generated/gendata-tables.json/tableGroup/1/tables/1/rows/3/1"}:
            zh = re.sub(r"^\d+（(\{@dice [^}]+})）", r"\1", zh)
        if en == "1d3 + 2 {@creature noble||nobles} on {@creature riding horse||riding horses} with an escort of 1d10 {@creature guard||guards}":
            zh = "1d3 + 2 名騎著{@creature riding horse||乘用馬}的{@creature noble||貴族}，由 1d10 名{@creature guard||守衛}護送"
        if heading and ctx not in self.overrides:
            zh = self.translate_name(en, zh, "namedRuleBlock")
        out = self.localize_string(en, zh, ctx)
        self.audit.append({"context": ctx, "english": en, "localized": out, "heading": heading})
        return bilingual(out, en) if heading else out

    def walk(self, en, zh, ctx, *, visible=False, names=False):
        if isinstance(en, str):
            if not visible:
                return en
            if not isinstance(zh, str):
                raise ValueError(f"Missing translated string: {ctx}")
            # Retain personal-name spellings; translate meanings and virtue
            # names, not a spell glossary's accidental interpretation of names.
            if names and ctx.endswith("/result"):
                if ctx.startswith("names.json/name/9/tables/2/"):
                    virtues = dict(zip("Ambition|Art|Carrion|Chant|Creed|Death|Debauchery|Despair|Doom|Doubt|Dread|Ecstasy|Ennui|Entropy|Excellence|Fear|Glory|Gluttony|Grief|Hate|Hope|Horror|Ideal|Ignominy|Laughter|Love|Lust|Mayhem|Mockery|Murder|Muse|Music|Mystery|Nowhere|Open|Pain|Passion|Poetry|Quest|Random|Reverence|Revulsion|Sorrow|Temerity|Torment|Tragedy|Vice|Virtue|Weary|Wit".split("|"), "雄心|藝術|腐肉|吟唱|信條|死亡|放蕩|絕望|厄運|疑惑|畏懼|狂喜|倦怠|熵|卓越|恐懼|榮耀|暴食|悲慟|憎恨|希望|驚駭|理想|恥辱|歡笑|愛|慾望|混亂|嘲弄|謀殺|靈感|音樂|奧祕|無處|敞開|痛楚|熱情|詩歌|追尋|隨機|崇敬|厭惡|悲傷|莽勇|折磨|悲劇|惡德|美德|疲憊|機智".split("|")))
                    assert en in virtues, en
                    return bilingual(virtues[en], en)
                if "(" not in en:
                    return en
                meanings = {"green":"綠色", "war":"戰爭", "animal":"野獸", "dragon":"龍", "axe":"斧", "hammer":"錘", "storm":"風暴", "gem":"寶石", "danger":"危險", "small":"小", "demon":"惡魔", "armor":"護甲", "song":"歌曲", "many":"眾多", "night":"夜晚", "iron":"鐵", "burn":"燃燒", "battle":"戰鬥", "black":"黑色", "steel":"鋼"}
                meaning = re.fullmatch(r"(.+) \((.+)\)", en)
                assert meaning and meaning[2] in meanings, (ctx, en)
                return f"{meaning[1]}（{meanings[meaning[2]]}）"
            return self.text(en, zh, ctx)
        if isinstance(en, list):
            if not isinstance(zh, list) or len(en) != len(zh):
                raise ValueError(f"Array shape mismatch: {ctx}: {len(en)} vs {len(zh) if isinstance(zh, list) else type(zh)}")
            return [self.walk(x, y, f"{ctx}/{i}", visible=visible, names=names) for i, (x, y) in enumerate(zip(en, zh))]
        if not isinstance(en, dict):
            return deepcopy(en)
        if not isinstance(zh, dict):
            raise ValueError(f"Object shape mismatch: {ctx}")
        out = deepcopy(en)
        for key, value in en.items():
            if key in {"ac", "hp"} and isinstance(value, dict) and isinstance(value.get("special"), str):
                special = {
                    "Varies (see below)": "不定（見下文）",
                    "equal to five times your artificer level": "等於你的奇械師等級的五倍",
                    "5 × your artificer level (casting {@spell Mending|XPHB} on the cannon restores {@dice 2d6} hit points to it)": "5 × 你的奇械師等級（對魔能砲施放{@spell Mending|XPHB|修復術}可使其恢復 {@dice 2d6} 點生命值）",
                }
                assert value["special"] in special, (ctx, key, value)
                out[f"_display{key[0].upper()}{key[1:]}"] = self.text(value["special"], special[value["special"]], f"{ctx}/{key}/special")
            if key.startswith("_") or key in PROTECTED:
                continue
            if key not in zh:
                if key in VISIBLE and value:
                    raise ValueError(f"Missing field: {ctx}/{key}")
                continue
            subctx = f"{ctx}/{key}"
            if key in DISPLAY and isinstance(value, str):
                out[f"_display{key[0].upper()}{key[1:]}"] = self.text(value, zh[key], subctx, heading=True)
            elif key == "caption" and isinstance(value, str):
                out[key] = self.text(value, zh[key], subctx, heading=True)
            elif isinstance(value, (dict, list)):
                out[key] = self.walk(value, zh[key], subctx, visible=visible or key in VISIBLE or key in LIFE_TABLES, names=names)
            elif key in VISIBLE:
                out[key] = self.walk(value, zh[key], subctx, visible=True, names=names)
        return out

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--audit-strings", type=Path, help="optional intermediate, not needed by deployment")
    args = parser.parse_args()
    override_path = ROOT / "translation/zh-TW/utility-pages/overrides.json"
    loc = Localizer(read(override_path) if override_path.exists() else {})
    source_files = {}
    pairs = []
    for rel in FILES:
        en_path, zh_path = RAW / rel, args.source_dir / "data" / rel
        en, zh = read(en_path), read(zh_path)
        if rel == "generated/gendata-tables.json":
            repair_generated(en, zh)
        loc.register_source_names(zh)
        loc.register_tag_translations(en, zh)
        source_files[rel] = {"upstreamSha256": sha(en_path), "sourceSha256": sha(zh_path)}
        pairs.append((rel, en, zh))
    counts = {}
    for rel, en, zh in pairs:
        for prop, entries in en.items():
            if prop.startswith("_") or not isinstance(entries, list):
                continue
            assert len(entries) == len(zh[prop]), (rel, prop)
            if rel != "generated/gendata-tables.json":
                for i, (x, y) in enumerate(zip(entries, zh[prop])):
                    if isinstance(x, dict) and "name" in x and "ENG_name" in y:
                        assert x["name"] == y["ENG_name"], (rel, prop, i, x["name"], y["ENG_name"])
            counts[f"{rel}:{prop}"] = len(entries)
        out = loc.walk(en, zh, rel, names=rel == "names.json")
        CORE.write_json(OUT / rel, out)
    report = {"counts": counts, "sources": source_files, **loc.report, "auditedVisibleStrings": len(loc.audit)}
    def classify(v):
        # Normalize notation before the shared checker: a weapon range such
        # as 300/1,200 is two distances, not a rational number.
        en, zh = v["english"], v["localized"]
        if "/" in en and ("range " in en or "射程" in zh):
            en, zh = en.replace(",", "").replace("/", " / "), zh.replace(",", "").replace("/", " / ")
            en, zh = en.replace(" / ", " 或 "), zh.replace(" / ", " 或 ")
        for token, number in {"twenty-two": "22", "fifty-four": "54", "forty-seven": "47", "one hundred": "100", "one thousand": "1000", "a thousand": "1000", "the next minute": "the next 1 minute", "the next hour": "the next 1 hour"}.items():
            en = re.sub(r"\b" + token + r"\b", number, en, flags=re.I)
        return CORE.classify_numeric_difference({"english": en, "localized": zh})
    report["numericReview"] = [{**v, "review": classify(v)} for v in loc.report["numericDifferences"]]
    report["exactContextOverrides"] = len(loc.overrides)
    report["generatedTableLayoutRepairs"] = ["XDMG Weather: join the two translated source tables to the canonical three-row, four-column table"]
    report["untranslatedProseCandidates"] = [v for v in loc.audit if not v["heading"] and re.search(r"\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}\b", re.sub(r"（[^）]*）", "", re.sub(r"\{@[^}]+\}", "", v["localized"])))]
    CORE.write_json(REPORT, report)
    if args.audit_strings:
        CORE.write_json(args.audit_strings, loc.audit)
    CORE.write_json(OUT / "index.json", {"locale": "zh-TW", "upstreamTag": CONTENT.UPSTREAM_TAG, "upstreamCommit": CONTENT.UPSTREAM_COMMIT, "sourceRepository": CONTENT.SOURCE_REPOSITORY, "sourceCommit": CONTENT.SOURCE_COMMIT, "license": "CC BY-NC-SA 4.0", "files": source_files, "counts": counts})
    print(json.dumps({"counts": counts, "audit": len(loc.audit), "issues": {k: len(v) for k, v in loc.report.items()}}, ensure_ascii=False))

if __name__ == "__main__":
    main()
