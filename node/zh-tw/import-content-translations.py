#!/usr/bin/env python3
"""Build guarded zh-TW sidecars for translated 5etools entity data.

Supported groups are ``spells``, ``character-options``, ``items``, and ``monsters``. Every localized
entity is paired to the pinned v2.33.3 English entity by canonical name and
source. The output retains all mechanical and identity fields from English,
while replacing only renderer-visible prose. Inline-reference targets are
reconciled back to their canonical English values before the sidecar is written.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
from collections import Counter
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
UPSTREAM_ROOT = ROOT / "data"
OUTPUT_ROOT = ROOT / "data" / "zh-TW"
TRANSLATION_ROOT = ROOT / "translation" / "zh-TW"
CORE_IMPORTER_PATH = Path(__file__).with_name("import-core-rules.py")

SOURCE_REPOSITORY = "https://github.com/tjliqy/5etools-cn"
SOURCE_COMMIT = "46b15d04f548c23c526084deae078e3568500349"
UPSTREAM_TAG = "v2.33.3"
UPSTREAM_COMMIT = "e5f3e77b303a92df10487207857200245e71957c"
ITEM_SIDECAR_CHUNK_SIZE = 300

MONSTER_ENTRY_KEYS = {
	"trait",
	"action",
	"bonus",
	"reaction",
	"legendary",
	"mythic",
	"variant",
	"spellcasting",
	"legendaryHeader",
	"mythicHeader",
	"lairActions",
	"regionalEffects",
	"resource",
}
MONSTER_DISPLAY_KEYS = {
	*MONSTER_ENTRY_KEYS,
	"ac",
	"hp",
	"speed",
	"languages",
	"resist",
	"immune",
	"vulnerable",
	"conditionImmune",
}


def load_core_importer():
	spec = importlib.util.spec_from_file_location("zh_tw_core_importer", CORE_IMPORTER_PATH)
	if spec is None or spec.loader is None:
		raise SystemExit(f"Could not load shared importer: {CORE_IMPORTER_PATH}")
	module = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(module)
	return module


CORE = load_core_importer()


SPELL_EXACT_REPAIRS: dict[str, tuple[tuple[str, str], ...]] = {
	"spells/spells-ai.json/spell/6/entries/0/entries/0": (
		("最糟糕的90秒", "最糟糕的九十秒"),
	),
	"spells/spells-frhof.json/spell/2/entries/0": (
		("你創造一道形如劍刃的位面裂隙", "你創造一道 3 尺長、形如劍刃的位面裂隙"),
	),
	"spells/spells-bmt.json/spell/0/components/m": (
		("浪客Rogue", "遊蕩者"),
	),
	"spells/spells-egw.json/spell/9/entries/0": (
		("其回合開始時roll一個", "其回合開始時擲一個"),
	),
	"spells/spells-phb.json/spell/5/entries/0": (
		("松鼠squirrel，藍松鴉blue jay，或是蝙蝠bat", "松鼠、藍松鴉或蝙蝠"),
	),
	"spells/spells-phb.json/spell/16/entries/0": (
		("哈達，烏黯之飢渴Hadar, the Dark Hunger", "「烏黯之飢渴」哈達"),
	),
	"spells/spells-phb.json/spell/17/components/m/text": (
		("紅鋯石jacinth", "紅鋯石"),
	),
	"spells/spells-phb.json/spell/197/entries/1": (
		("魯那格Rudnogg", "魯那格"),
	),
	"spells/spells-phb.json/spell/311/entries/2": (
		("聖庫斯伯特St.Cuthbert", "聖庫斯伯特"),
		("托爾Thor", "索爾"),
	),
	"spells/spells-phb.json/spell/356/entries/2/items/3": (
		("擾亂生命Disrupt Life", "擾亂生命"),
	),
	"spells/spells-phb.json/spell/22/entries/0": (
		("利用施法的 8 小時引導", "利用施法時間引導"),
	),
	"spells/spells-phb.json/spell/81/components/m": (
		("所創造物品的一小部分", "一小片與你打算創造之物品同類的材料"),
	),
	"spells/spells-phb.json/spell/94/entries/0": (
		("（若有）。該法術可以穿透大部分障礙，但仍會被1尺厚石質，或1寸厚金屬質，或一層薄鉛質，或3尺厚木質或泥質材料阻隔。", "（若有）。"),
	),
	"spells/spells-phb.json/spell/96/entries/4": (
		("但其必須在其 30 尺內", "但其仍必須位於施法距離內"),
	),
	"spells/spells-phb.json/spell/131/entries/1": (
		("額外的{@filter 可選動物形態|bestiary|Miscellaneous=魔寵}可能會在DM的裁量下提供", "DM 可自行裁定是否提供額外的{@filter 可選動物形態|bestiary|Miscellaneous=魔寵}"),
	),
	"spells/spells-phb.json/spell/131/entries/5": (
		("（從以上列表選擇）。", "（從以上列表選擇）。你的魔寵會轉化為所選的生物。"),
	),
	"spells/spells-phb.json/spell/310/entries/1": (
		("在這 15 尺半徑的區域內", "在此區域內"),
	),
	"spells/spells-phb.json/spell/325/entries/9/entries/0": (
		("DM 重投 d100 並查閱上表", "DM 重新擲骰並查閱上表"),
	),
	"spells/spells-tce.json/spell/1/entries/1": (
		("兩個傷害都會在 11 級後再增加 1d8（{@damage 2d8}和 {@damage 3d8}），17 級後再加 1d8（{@damage 3d8}和{@damage 4d8}）。", "兩項傷害都會在 11 級時增加 1d8（提高為{@damage 2d8}和{@damage 3d8}），並在 17 級時再次增加相同幅度（提高為{@damage 3d8}和{@damage 4d8}）。"),
	),
	"spells/spells-tce.json/spell/3/entries/1": (
		("兩個傷害都會在 11 級後再增加{@damage 1d8}（{@damage 2d8}和{@damage 2d8}），17 級後再加 1d8（{@damage 3d8}和{@damage 3d8}）。", "兩項傷害在 11 級時各增加{@damage 1d8}（提高為{@damage 2d8}和{@damage 2d8}），並在 17 級時提高為{@damage 3d8}和{@damage 3d8}。"),
	),
	"spells/spells-xge.json/spell/8/entries/5/entries/0": (
		("一具處於你周圍 5 尺內的屍體", "一具屍體"),
	),
	"spells/spells-xge.json/spell/67/entries/1": (
		("專精Expertise", "專精"),
	),
	"spells/spells-xge.json/spell/35/entriesHigherLevel/0/entries/0": (
		("寒冷傷害便增加 1d6 {@scaledamage 2d6|1-9|1d6}點", "寒冷傷害便增加{@scaledamage 2d6|1-9|1d6}點"),
	),
	"spells/spells-xge.json/spell/75/entries/1/rows/2/1": (
		("3個{@filter", "8個{@filter"),
	),
	"spells/spells-xge.json/spell/80/entries/0": (
		("除你之外，在你周圍 5 尺範圍內的生物", "除你之外，位於施法距離內的每個生物"),
	),
	"spells/spells-xge.json/spell/80/scalingLevelDice/label": (
		("thunder damage", "雷鳴傷害"),
	),
	"spells/spells-xge.json/spell/92/entries/0": (
		("處於你周圍 5 尺內、", "處於施法距離內、"),
	),
	"spells/spells-xphb.json/spell/222/entriesHigherLevel/0/entries/0": (
		("使用高於五環的法術位時", "使用六環以上的法術位時"),
	),
	"spells/spells-xphb.json/spell/23/entries/0": (
		("Awakened Shrub", ""),
	),
	"spells/spells-xphb.json/spell/67/entries/0": (
		("元素位面Elemental Planes", "元素位面"),
	),
	"spells/spells-xphb.json/spell/72/entries/0": (
		("\"是Yes\"、\"不是No\"、\"可能Maybe\"、\"不可能Never\"、\"無關Irrelevant\"或\"不清楚Unclear\"", "「是」、「否」、「可能」、「絕不」、「無關」或「不清楚」"),
	),
	"spells/spells-xphb.json/spell/83/entries/0": (
		("墮影冥界Shadowfell", "墮影冥界"),
	),
	"spells/spells-xphb.json/spell/102/entries/2/entries/0": (
		("墮影冥界Shadowfell", "墮影冥界"),
		("妖精荒野Feywild", "妖精荒野"),
	),
	"spells/spells-xphb.json/spell/108/entries/0": (
		("上層位面Upper Planes", "上層位面"),
	),
	"spells/spells-xphb.json/spell/125/entries/0": (
		("以太位面Ethereal Plane", "以太位面"),
		("以太邊界Border Ethereal", "以太邊界"),
	),
	"spells/spells-xphb.json/spell/125/entries/3": (
		("外層位面Outer Plane", "外層位面"),
	),
	"spells/spells-xphb.json/spell/150/entries/0": (
		("星光位面Astral Plane", "星界位面"),
		("以太位面Ethereal Plane", "以太位面"),
		("妖精荒野Feywild", "妖精荒野"),
		("墮影冥界Shadowfell", "墮影冥界"),
	),
	"spells/spells-xphb.json/spell/196/entries/2/items/2/entries/0": (
		("（labyrinth）", ""),
	),
	"spells/spells-xphb.json/spell/261/entries/0": (
		("火元素位面Plane of Fire", "火元素位面"),
		("黃銅之城City of Brass", "黃銅城"),
		("九層地獄Nine Hells", "九層地獄"),
		("迪斯帕特Dispater", "迪斯帕特"),
	),
	"spells/spells-xphb.json/spell/242/entriesHigherLevel/0/entries/0": (
		("1 年內（八環）", "365 日內（八環）"),
	),
	"spells/spells-xphb.json/spell/289/entries/0": (
		("死亡時間不超過 100 年", "死亡時間不超過一個世紀"),
	),
	"spells/spells-xphb.json/spell/350/entries/4/entries/0": (
		("DM重骰d100並查閱上表", "DM重新擲骰並查閱上表"),
	),
	"spells/spells-xphb.json/spell/384/entries/3/items/6/entries/0": (
		("印記城City of Sigil", "印記城"),
		("痛苦女士Lady of Pain", "痛苦女士"),
	),
	"spells/spells-xphb.json/spell/384/entries/4": (
		("祈願術Wish", "祈願術"),
	),
}


CHARACTER_OPTION_EXACT_REPAIRS: dict[str, tuple[tuple[str, str], ...]] = {
	"races.json/race/48/entries/0/entries/0": (
		("在 20 歲左右進入成年", "在十幾歲後期成年"),
	),
	"races.json/race/65/entries/1/entries/0": (
		("超過2萬尺", "超過20,000尺"),
	),
	"races.json/race/73/entries/0/entries/0": (
		("一般能活到150歲", "一般能活到第二個世紀中期"),
	),
	"races.json/race/83/entries/0/entries/0": (
		("人類不到20歲成年，而很少活過100 歲", "人類在十幾歲後期成年，且壽命不滿一個世紀"),
	),
	"races.json/race/85/entries/0/entries/0": (
		("人類不到20歲成年，而很少活過100 歲", "人類在十幾歲後期成年，且壽命不滿一個世紀"),
	),
	"races.json/race/126/entries/6/entries/0": (
		("一個頭、12隻手臂、12條腿", "一個頭、一至兩隻手臂、一至兩條腿"),
	),
	"races.json/race/152/entries/2/entries/0": (
		("維多肯個頭比人類高挑且更為苗條，體重通常小於200磅。", "維多肯高挑而苗條，平均身高6至6½尺，體重通常小於200磅。"),
	),
	"fluff-races.json/raceFluff/28/entries/0/entries/0/entries/1/entries/0": (
		("身高常接近6.5英尺（約1.98米），體重達300磅（約136公斤）或更重", "身高常接近6½尺，體重達300磅或更重"),
	),
	"fluff-races.json/raceFluff/37/entries/0/entries/0/entries/2/entries/0": (
		("300多年前", "三個多世紀前"),
		("人類和半精靈", "人類和半身人"),
	),
	"fluff-races.json/raceFluff/173/entries/0/entries/4/entries/2/rows/5/1": (
		("4   我發誓絕不讓活人看到我臉上面具之後的樣子。", "我想像自己的衣著是在向全世界展示我榮耀的靈魂，並據此打扮。"),
	),
	"backgrounds.json/background/8/entries/1/entries/1": (
		(
			"在冒險之餘，你可能會參加體育比賽，以保持舒適的生活方式，如同{@book 玩家手冊|PHB}修整期活動中的\"{@book 專業實踐|PHB|8|專業實踐}\"。",
			"在冒險之餘，你可能會參加體育比賽，以維持舒適的生活方式，如同\"{@book 專業實踐|PHB|8|專業實踐}\"，即{@book 玩家手冊|PHB}第8章所述的修整期活動。",
		),
	),
	"backgrounds.json/background/10/entries/4/entries/2/rows/1/1": (("2 我", "我"),),
	"backgrounds.json/background/10/entries/4/entries/2/rows/2/1": (("3 我", "我"),),
	"backgrounds.json/background/10/entries/4/entries/2/rows/3/1": (("4 我", "我"),),
	"backgrounds.json/background/10/entries/4/entries/2/rows/4/1": (("5 我", "我"),),
	"backgrounds.json/background/10/entries/4/entries/2/rows/5/1": (("6 我", "我"),),
	"backgrounds.json/background/10/entries/4/entries/2/rows/6/1": (("7 我", "我"),),
	"backgrounds.json/background/10/entries/4/entries/2/rows/7/1": (("8 我", "我"),),
	"backgrounds.json/background/58/entries/1/entries/0": (
		("任何人口過萬的城市", "任何人口超過10,000人的城市"),
	),
	"backgrounds.json/background/62/entries/1/entries/2": (
		(
			"公會常常掌握著龐大的政治資源。當你被指控某項罪名時，公會可以為你提供全面的支援，前提是你必須為自己的清白做出舉證，或是你的罪名必須仍可接受辯護。倘若你身處公會高層，甚至可以藉由公會獲取有力的政治地位。而這些人脈資源都需要你為公會捐贈金錢或魔法物品來維持。",
			"你每月必須向公會繳交5 gp會費。若你漏繳，必須補齊欠款，才能維持公會對你的好感。",
		),
	),
	"backgrounds.json/background/91/entries/2/entries/4": (
		("在第5章中描述的{@item 米捷裝置|GGR} {@book 第五章|GGR|4|米捷裝置}是這種裝置的魔法物品版本。", "{@item 米捷裝置|GGR}（見{@book 第五章|GGR|4|米捷裝置}）是這種裝置的魔法版本。"),
	),
	"backgrounds.json/background/113/entries/2/entries/1": (
		("印記城中的12個主要派系", "印記城中的主要派系"),
	),
	"feats.json/feat/151/entries/2": (
		("然後由你決定攻擊者該使用哪粒d20。若不止一個生物決定花費幸運點影響同一個骰值，則幸運點互相抵消，即並不會有額外的d20擲骰行為。", "然後由你決定該攻擊使用攻擊者的擲骰結果還是你的擲骰結果。若不只一個生物花費幸運點影響同一次擲骰結果，這些點數會相互抵消，且不會擲額外的骰子。"),
	),
	"feats.json/feat/245/entries/1/entries/0": (
		("重新投擲D20", "重新投擲該骰"),
	),
	"optionalfeatures.json/optionalfeature/182/entries/0": (
		("你獲得一個d6的卓越骰（或在你以任何其他方式獲得的卓越骰池中增加一顆卓越骰）。此卓越骰可用於啟動你的戰技。卓越骰一經使用即消耗，並在完成一次短休或長休後恢復。", ""),
	),
}


ITEM_EXACT_REPAIRS: dict[str, tuple[tuple[str, str], ...]] = {}

ITEM_TRANSLATION_OVERRIDES: dict[str, str] = {
	"items.json/item/97/entries/6/colLabels/1": "上",
	"items.json/item/98/entries/5/colLabels/1": "上",
	"items.json/item/87/entries/2": "如果你不是亡靈，每當你使用護符傳送時，都必須進行一次{@dc 16}體質豁免。豁免失敗時，黑顱骨會咯咯作笑，而你在傳送途中發生轉化。轉化會在你抵達目的地時立即生效；其結果透過擲百分骰並查閱黑顱骨轉化表隨機決定。",
	"items.json/item/124/entries/3/entries/2": "這把斧具有{@itemProperty T|XPHB|投擲}詞條，普通射程為20尺，長射程為60尺。當你使用這把武器進行遠程攻擊並命中時，額外造成{@damage 1d8}點力場傷害；若目標是巨人類生物，則額外造成{@damage 2d8}點力場傷害。命中或失手後，武器會立即飛回你手中。",
	"items.json/item/137/entries/0": "這個沉重的布袋裡裝著{@dice 3d4}顆乾豆。布袋重½磅，另加其中每顆豆子¼磅。",
	"items.json/item/173/entries/0": "這顆小型黑色球體直徑為¾吋，重一盎司。通常會同時找到{@dice 1d4 + 4}顆{@italic 力場珠}。",
	"items.json/item/174/entries/0": "這顆小型黑色球體直徑為3/4吋，重一盎司。通常會同時找到{@dice 1d4 + 4}顆力場珠。",
	"items.json/item/405/entries/0": "食物與其他易腐物品放在保鮮箱內時不會老化或腐敗。箱子長2½尺、寬1½尺、高1尺，箱蓋呈半桶形。箱子設有鎖；使用{@item thieves' tools|PHB|盜賊工具}並成功通過一次{@dc 15}敏捷檢定即可將其撬開。砸壞鎖或箱子的任何其他部分，都會使箱子失去魔法。",
	"items.json/item/449/entries/0": "這枚銅製護符內含互相咬合的微小齒輪，並由機械境的魔法驅動；那是一個由發條般的可預測性支配的位面。護符內傳出微弱的滴答聲與轉動聲。",
	"items.json/item/474/entries/0": "這件物品是一枚普通但相當巨大的海螺殼，其上刻有烏瓦符文。海螺長2½尺，重20磅。",
	"items.json/item/511/entries/0": "一般的水晶球是極珍稀物品，直徑約6吋。接觸它時，你可以用它施展{@spell Scrying|XPHB|探知術}（豁免{@dc 17}）。",
	"items.json/item/549/entries/0": "自第一副萬象無常牌創造以來的數個世紀裡，許多人都曾試圖仿製它，卻以失敗告終。但也有人創造出新的卡牌。這四十四張額外卡牌合稱為萬事萬象無常牌。（關於為這副牌創造新卡牌的更多資訊，見第二章。）",
	"items.json/item/549/entries/1": "如同萬象無常牌，萬事萬象無常牌在不同世界會以不同形式顯現。它可能包含較少或不同的卡牌，但通常會與萬象無常牌一同出現，組成一副六十六張的彩飾牌組。組合牌組通常收在盒子或小袋中。萬事萬象無常牌的四十四張牌帶有與萬象無常牌相似的圖像，並具有強大的魔法效果，詳見本條目後文。值得注意的是，萬事萬象無常牌中的卡牌較可能帶來益處，然而其中約三分之一依然危險。",
	"items.json/item/551/entries/4/footnotes/0": "* 僅出現在二十二張牌的牌組中",
	"items.json/item/552/entries/0": "這副牌通常放在盒子或小袋裡，內含若干象牙或犢皮紙製成的卡牌。大多數（75%）牌組有十三張牌，但有些有二十二張。隨機決定從牌組抽到的牌時，使用萬象無常牌表的適當欄位。",
	"items.json/item/553/entries/0": "這個木盒內裝有一副三十二張的羊皮紙牌。",
	"items.json/item/731/entries/1": "當你在持握或佩戴碎片時對一道法術使用超魔法選項，你可以令一條黏滑觸手撕裂現實織體，攻擊你30尺內一個你看得見的生物。該生物必須進行一次魅力豁免，對抗你的法術豁免DC；失敗則受到{@damage 3d6}點心靈傷害，並對你陷入{@condition frightened||恐懼}，直到你下一回合開始。",
	"items.json/item/910/entries/0": "點燃裝滿火藥的火藥角會使其爆炸。火藥角爆炸時，以其為中心10尺半徑的{@variantrule Sphere [Area of Effect]|XPHB|球形}內，每個生物進行一次{@dc 12}敏捷豁免；失敗受到10（{@damage 3d6}）點火焰傷害，成功則傷害減半。",
	"items.json/item/988/entries/0": "你可以採取一次{@action Magic|XPHB|魔法}動作吹響號角；號角會在30尺的{@variantrule Cone [Area of Effect]|XPHB|錐形}範圍內發出雷鳴爆響，聲音在600尺外仍可聽見。{@variantrule Cone [Area of Effect]|XPHB|錐形}範圍內每個生物進行一次{@dc 15}體質豁免。豁免失敗時，生物受到{@damage 5d8}點雷鳴傷害，並陷入{@condition Deafened|XPHB|耳聾}狀態1分鐘；成功時，只受到一半傷害。{@variantrule Cone [Area of Effect]|XPHB|錐形}範圍內未被穿戴或攜帶的玻璃或水晶物件受到{@damage 10d8}點雷鳴傷害。",
	"items.json/item/995/entries/1": "青銅號角會召喚4名{@creature Berserker|XMM|狂戰士}。若要使用青銅號角，你必須受過所有中型護甲的訓練。",
	"items.json/item/1040/entries/1": "你可以演奏安斯翠瑟豎琴來施展以下法術之一：{@spell Fly|XPHB|飛行術}、{@spell Invisibility|XPHB|隱形術}、{@spell Levitate|XPHB|浮空術}、{@spell Protection from Evil and Good|XPHB|防護善惡}、{@spell Cure Wounds|XPHB|療傷術}（5環）、{@spell Ice Storm|XPHB|冰風暴}及{@spell Wall of Thorns|XPHB|荊棘牆}。安斯翠瑟豎琴施展某道法術後，直到下次黎明前都不能再次用它施展該法術。這些法術使用你的施法屬性與法術豁免DC。",
	"items.json/item/1042/entries/1": "你可以演奏卡奈斯曼陀林來施展以下法術之一：{@spell Fly|XPHB|飛行術}、{@spell Invisibility|XPHB|隱形術}、{@spell Levitate|XPHB|浮空術}、{@spell Protection from Evil and Good|XPHB|防護善惡}、{@spell Cure Wounds|XPHB|療傷術}（3環）、{@spell Dispel Magic|XPHB|解除魔法}及{@spell Protection from Energy|XPHB|防護能量}（僅限閃電傷害）。卡奈斯曼陀林施展某道法術後，直到下次黎明前都不能再次用它施展該法術。這些法術使用你的施法屬性與法術豁免DC。",
	"items.json/item/1196/entries/1/entries/0": "這塊石頭受到詛咒，但其魔法本質遭到隱藏；{@spell detect magic||偵測魔法}無法偵測到它。{@spell identify||鑑定術}會揭露石頭的真正本質。當石頭在你身上時，若你採取{@action Dash||疾走}或{@action Disengage||撤離}動作，其詛咒便會啟動。直到以{@spell remove curse||移除詛咒}或類似魔法破除詛咒前，你的速度降低5尺，且最大負重與最大舉重能力減半。你也會變得不願與石頭分離。",
	"items.json/item/1217/entries/0": "這個散發微光的水晶十二面體比外觀看來更沉重。其各側裝有一組把手，被觸碰時會脈動並發出低鳴。",
	"items.json/item/1217/entries/1/entries/2": "若原本的{@dice d20}擲骰具有優勢或劣勢，該生物會在優勢或劣勢套用於原擲骰後，再擲出自己的{@dice d20}。",
	"items.json/item/1402/entries/7/entries/0": "龍珠具有7發充能，並在每日黎明時重獲{@dice 1d4 + 3}發已消耗的充能。若你控制龍珠，你可以用它施展下表中的一道法術。表格列出施展各法術時必須消耗的充能數。",
	"items.json/item/1562/entries/0": "這瓶藥水是一件魔法物品。你可以用一個{@variantrule Bonus Action|XPHB|附贈動作}喝下它，或將它餵給你5尺內的另一個生物。喝下瓶中魔法紅色液體的生物恢復{@dice 2d4 + 2}點{@variantrule Hit Points|XPHB|生命值}。藥水的紅色液體受搖晃時會閃光。",
	"items.json/item/1588/entries/2": "若原本的{@dice d20}擲骰具有優勢或劣勢，你會在優勢或劣勢套用於原擲骰後，再擲出自己的{@dice d20}。",
	"items.json/item/1661/entries/6/entries/0": "這把武器具有{@itemProperty T|XPHB|投擲}詞條，普通射程為30尺，長射程為120尺。使用這把武器進行遠程攻擊後，它會立即飛回你手中。",
	"items.json/item/1800/entries/1": "權杖每天黎明時重獲1發已消耗的充能。若權杖降至0發充能，擲一個{@dice d20}。若擲出1，權杖會在一陣光輝中消失。",
	"items.json/item/1825/entries/4/entries/1/items/1": "你向60尺錐形範圍放出寒冰爆風。該區域內每個生物都必須進行一次{@dc 19}體質豁免；失敗受到{@damage 12d8}點寒冷傷害，成功則傷害減半。",
	"items.json/item/2023/entries/0": "靈魂幣由煉獄鐵鑄造，直徑約5吋、厚約一吋。每枚硬幣重三分之一磅，上面刻有煉獄語文字與一道將單一靈魂魔法束縛於幣中的法術。每枚靈魂幣都囚禁著獨一無二的靈魂，因此各有自己的故事。一個生物可能因未履行交易而遭囚禁，另一個則可能是夜鬼婆詛咒的受害者。",
	"items.json/item/2206/entries/1/entries/3/rows/1/3": "當你完成長休時，牙齒會對你施展{@spell sanctuary||庇護術}（{@dc 18}），該法術持續24小時，或直到你使其終止。",
	"items.json/item/2373/entries/2/entries/0": "征服者具有{@itemProperty T|XPHB|投擲}詞條，普通射程為60尺，長射程為180尺。當你使用征服者進行遠程攻擊並命中時，目標額外受到{@damage 1d8}點力場傷害；若目標是構裝體、元素或巨人，則額外受到{@damage 4d8}點力場傷害。命中或失手後，武器會立即飛回你手中。",
	"items.json/item/2393/entries/0": "穿著這雙靴子時，你具有等同於步行速度的飛行速度。你可以用靴子飛行至多4小時，能一次用完或分成數次較短的飛行；每次飛行至少消耗持續時間中的1分鐘。若持續時間耗盡時你仍在飛行，便會以每輪30尺的速度下降，直到著地。",
	"items.json/item/2423/entries/4/entries/0": "任何觸碰密瑟能核球體的生物都必須進行一次{@dc 22}體質豁免；失敗受到180（{@damage 20d10 + 70}）點光耀傷害，成功則傷害減半。亡靈進行此豁免時具有劣勢。除神器或密瑟能核的托架外，任何觸碰球體的物件都會立即解離（無豁免）。",
	"magicvariants.json/magicvariant/114/inherits/entries/0": "這件武器中封印著一道2環法術。該法術在武器製成時決定，且必須屬於{@filter 咒法、預言、塑能、死靈或變化|spells|school=C;D;V;N;T|level=2}學派。武器具有6發充能，並在每日黎明時重獲{@dice 1d6}發已消耗的充能。持握武器時，你可以消耗1發充能來施展其中的法術。",
	"magicvariants.json/magicvariant/128/inherits/entries/2": "當你拔出這把武器時，可以熄滅自身30尺內所有非魔法火焰。此屬性一旦使用，直到1小時後才能再次使用。",
	"magicvariants.json/magicvariant/163/inherits/entries/0": "你使用這把魔法武器進行攻擊檢定與傷害擲骰時獲得+2加值。",
	"magicvariants.json/magicvariant/164/inherits/entries/2": "在你的誓敵仍活著期間，你使用其他所有武器進行的攻擊檢定具有{@variantrule Disadvantage|XPHB|劣勢}。",
}

MONSTER_TRANSLATION_OVERRIDES: dict[str, str] = {
	"bestiary/bestiary-awm.json/monster/0/action/0/entries/0": "{@atk mw}命中{@hit 5}，單一目標。{@h}13（{@damage 3d6+3}）點鈍擊傷害。若目標為中型或更小體型，則陷入{@condition grappled||受擒}（掙脫{@dc 13}），並被拉向大水蛞5尺。直到此次{@action grapple||擒抱}結束前，目標陷入{@condition restrained||束縛}，大水蛞會試圖淹死它，且不能絞纏另一個目標。",
	"bestiary/bestiary-awm.json/monster/3/action/0/entries/0": "{@atk mw}命中{@hit 2}，單一目標。{@h}3（{@damage 1d6}）點穿刺傷害。",
	"bestiary/bestiary-awm.json/monster/4/action/2/entries/0": "{@atk mw}命中{@hit 6}，單一目標。{@h}17（{@damage 2d8 + 4}）點揮砍傷害。",
	"bestiary/bestiary-awm.json/monster/5/action/1/entries/0": "{@atk mw}命中{@hit 4}，單一目標。{@h}3（{@damage 1d6 +2}）點揮砍傷害。",
	"bestiary/bestiary-awm.json/monster/5/action/2/entries/0": "{@atk rw}命中{@hit 4}，單一目標。{@h}6（{@damage 1d6 + 2}）點穿刺傷害。",
	"bestiary/bestiary-awm.json/monster/6/action/0/entries/0": "{@atk mw}命中{@hit 3}，單一目標。{@h}4（{@damage 1d6 + 1}）點揮砍傷害。",
	"bestiary/bestiary-awm.json/monster/7/action/1/entries/0": "{@atk mw}命中{@hit 14}，單一目標。{@h}22（{@damage 3d8}）點穿刺傷害。目標必須通過一次{@dc 19}敏捷豁免，否則被蠕蟲吞下！",
	"bestiary/bestiary-awm.json/monster/7/action/2/entries/0": "{@atk mw}命中{@hit 14}，單一生物。{@h}19（{@damage 3d6 + 9}）點穿刺傷害。目標必須進行一次{@dc 19}體質豁免；失敗受到42（{@damage 12d6}）點毒素傷害。",
	"bestiary/bestiary-awm.json/monster/9/action/1/entries/0": "{@atk mw}命中{@hit 8}，單一目標。{@h}18（{@damage 3d8 + 5}）點鈍擊傷害。",
	"bestiary/bestiary-awm.json/monster/9/action/2/entries/0": "{@atk rw}命中{@hit 8}，單一目標。{@h}21（{@damage 3d10 + 5}）點鈍擊傷害。",
	"bestiary/bestiary-awm.json/monster/10/action/0/entries/0": "{@atk mw}命中{@hit 8}，觸及5尺，單一生物。{@h}8（{@damage 1d6 + 5}）點穿刺傷害。目標必須進行一次{@dc 13}體質豁免，失敗則陷入{@condition unconscious||昏迷}。另一個生物可以用一個動作搖醒目標。",
	"bestiary/bestiary-bam.json/monster/0/languages/0": "阿爾圖克語",
	"bestiary/bestiary-bam.json/monster/1/languages/0": "阿爾圖克語",
	"bestiary/bestiary-bam.json/monster/2/languages/0": "阿爾圖克語",
	"bestiary/bestiary-bgg.json/monster/71/action/2/entries/0": "異變體釋放一波心靈能量。異變體30尺內每個生物必須進行一次{@dc 14}智力豁免；失敗受到28（{@damage 8d6}）點心靈傷害，成功則傷害減半。",
	"bestiary/bestiary-egw.json/monster/21/ac/1/condition": "縮入甲殼時",
	"bestiary/bestiary-egw.json/monster/37/trait/0/entries/0": "海之怒能呼吸空氣和水。",
	"bestiary/bestiary-egw.json/monster/43/trait/0/entries/0": "這隻蜥蜴能呼吸空氣和水。",
	"bestiary/bestiary-egw.json/monster/46/action/0/entries/0": "{@atk mw}命中{@hit 2}，觸及5尺，單一目標。{@h}2（{@damage 1d4}）點穿刺傷害，外加3點閃電傷害。",
	"bestiary/bestiary-crcotn.json/monster/26/bonus/0/entries/0": "加爾薩里亞德以自己或他能在自身60尺內看見的一個自願生物為目標，以魔法扭曲目標周圍的重力。目標5尺內每個生物受到7（{@damage 2d6}）點力場傷害。此外，目標可以用反應向上漂浮至多20尺，且不引發藉機攻擊。此效應在加爾薩里亞德下一回合開始時結束，屆時目標會緩緩下降至多20尺。",
	"bestiary/bestiary-crcotn.json/monster/27/bonus/0/entries/0": "加爾薩里亞德以自己或他能在自身60尺內看見的一個自願生物為目標，以魔法扭曲目標周圍的重力。目標5尺內每個生物受到14（{@damage 4d6}）點力場傷害。此外，目標可以用反應向上漂浮至多20尺，且不引發藉機攻擊。此效應在加爾薩里亞德下一回合開始時結束，屆時目標會緩緩下降至多20尺。",
	"bestiary/bestiary-mcv2dc.json/monster/2/bonus/0/entries/0": "森林大師以角觸地，使一道5尺高、90尺長、10尺寬的荊棘牆迸發。牆出現時，區域內每個生物被推至牆旁最近的未佔據空間，並必須進行一次{@dc 15}敏捷豁免；失敗受到27（{@damage 6d8}）點穿刺傷害，成功則傷害減半。",
	"bestiary/bestiary-mgelft.json/monster/5/action/0/entries/0": "{@atk mw}命中{@hit 2}，觸及5尺，單一目標。{@h}3（{@damage 1d4 + 1}）點揮砍傷害，外加2（{@damage 1d4}）點寒冷傷害。爪擊同時造成揮砍與寒冷傷害。",
	"bestiary/bestiary-ftd.json/monster/0/action/3/entries/0": "該龍在口中凝聚一顆閃耀的引力珠，接著將能量釋放成90尺錐形。區域內每個生物必須進行一次{@dc 20}力量豁免。失敗時，生物受到45（{@damage 10d8}）點力場傷害，且速度降為0，直到龍的下一回合開始；成功時，傷害減半且速度不會降低。",
	"bestiary/bestiary-ftd.json/monster/49/hp/special": "5＋遊俠等級的五倍（龍獸具有等同於你遊俠等級數量的生命骰［d10］）",
	"bestiary/bestiary-ggr.json/monster/52/ac/0/condition": "每有一名其他歐節達再加1",
	"bestiary/bestiary-mm.json/monster/11/action/5/entries/0": "龍呼出毒氣，形成60尺錐形。區域內每個生物必須進行一次{@dc 18}體質豁免；失敗受到56（{@damage 16d6}）點毒素傷害，成功則傷害減半。",
	"bestiary/bestiary-mm.json/monster/14/action/5/entries/0": "龍呼出冰寒氣息，形成60尺錐形。區域內每個生物必須進行一次{@dc 19}體質豁免；失敗受到54（{@damage 12d8}）點寒冷傷害，成功則傷害減半。",
	"bestiary/bestiary-mm.json/monster/23/action/5/entries/0": "龍呼出毒氣，形成90尺錐形。區域內每個生物必須進行一次{@dc 22}體質豁免；失敗受到77（{@damage 22d6}）點毒素傷害，成功則傷害減半。",
	"bestiary/bestiary-mm.json/monster/203/action/1/entries/0": "龍呼出毒氣，形成15尺錐形。區域內每個生物必須進行一次{@dc 11}體質豁免；失敗受到21（{@damage 6d6}）點毒素傷害，成功則傷害減半。",
	"bestiary/bestiary-mm.json/monster/25/action/5/entries/1/items/1/entry": "龍呼出麻痺氣體，形成90尺錐形。區域內每個生物必須通過一次{@dc 24}體質豁免，否則陷入{@condition paralyzed||麻痺}1分鐘。生物可以在其每個回合結束時重複豁免，成功時終止自身的效應。",
	"bestiary/bestiary-mm.json/monster/56/trait/1/entries/0": "生物若觸碰布丁怪，或在其5尺內以近戰攻擊命中它，便受到4（{@damage 1d8}）點強酸傷害。任何以金屬或木材製成的非魔法武器命中布丁怪後會腐蝕；造成傷害後，該武器的傷害擲骰承受永久且可累積的−1罰值。若罰值降至−5，武器便被摧毀。以金屬或木材製成的非魔法彈藥命中後，在造成傷害後被摧毀。布丁怪能在1輪內侵蝕2吋厚的非魔法木材或金屬。",
	"bestiary/bestiary-mm.json/monster/69/action/2/entries/0": "{@atk mw,rw}命中{@hit 5}，觸及5尺或射程30/120尺，單一目標。{@h}近戰時造成9（{@damage 2d6 + 3}）點穿刺傷害，遠程時造成5（{@damage 1d6 + 3}）點穿刺傷害。",
	"bestiary/bestiary-mm.json/monster/84/variant/0/entries/1/entries/0": "巨人試圖投擲其10尺內一個小型或中型生物。目標必須通過一次{@dc 20}敏捷豁免，否則沿巨人選擇的方向被水平擲出至多60尺並{@condition prone||倒地}落地；目標每被擲出10尺便受到4（{@damage 1d8}）點鈍擊傷害。",
	"bestiary/bestiary-mm.json/monster/282/variant/0/entries/1/entries/0": "蕈人向30尺錐形區域釋放孢子。區域內每個生物必須通過一次{@dc 11}敏捷豁免，否則在蕈人的每個回合開始時受到3（{@damage 1d6}）點強酸傷害。生物可以在其回合結束時重複豁免，成功時終止自身的效應。豁免DC等於8＋蕈人的體質調整值＋熟練加值。",
	"bestiary/bestiary-mm.json/monster/283/variant/0/entries/1/entries/0": "蕈人向30尺錐形區域釋放孢子。區域內每個生物必須通過一次{@dc 12}敏捷豁免，否則在蕈人的每個回合開始時受到3（{@damage 1d6}）點強酸傷害。生物可以在其回合結束時重複豁免，成功時終止自身的效應。豁免DC等於8＋蕈人的體質調整值＋熟練加值。",
	"bestiary/bestiary-mm.json/monster/358/action/1/entries/1/items/1/entry": "龍呼出麻痺氣體，形成15尺錐形。區域內每個生物必須通過一次{@dc 13}體質豁免，否則陷入{@condition paralyzed||麻痺}1分鐘。生物可以在其每個回合結束時重複豁免，成功時終止自身的效應。",
	"bestiary/bestiary-mm.json/monster/372/variant/0/entries/1/entries/0": "巨人試圖投擲其10尺內一個小型或中型生物。目標必須通過一次{@dc 17}敏捷豁免，否則沿巨人選擇的方向被水平擲出至多60尺並{@condition prone||倒地}落地；目標每被擲出10尺便受到3（{@damage 1d6}）點鈍擊傷害。",
	"bestiary/bestiary-mm.json/monster/398/action/2/entries/0": "超等羅斯魔的雙眼閃爍乳白光芒，並以它30尺內一個它能看見的生物為目標。若目標能看見超等羅斯魔，便必須通過一次{@dc 17}感知豁免抵抗此魔法，否則陷入{@condition charmed||魅惑}直到超等羅斯魔下一回合結束。被{@condition charmed||魅惑}的目標同時陷入{@condition stunned||震懾}。若豁免成功，目標在接下來24小時內免疫該超等羅斯魔的凝視。",
	"bestiary/bestiary-mpp.json/monster/46/action/2/entries/0": "若目標正為一道法術或類似效應維持{@status concentration||專注}，則為維持其{@status concentration||專注}而進行的體質豁免具有劣勢。",
	"bestiary/bestiary-ps-z.json/monster/8/action/4/entries/0": "費利達爾以魔法傳送自己，以及它5尺內能看見的至多三個自願生物，連同各自穿戴或攜帶的裝備，抵達費利達爾熟悉且最遠1英里外的地點。",
	"bestiary/bestiary-skt.json/monster/37/_copy/_mod/action/1/items/entries/0": "{@atk mw}命中{@hit 14}，觸及10尺，單一目標。{@h}19（{@damage 3d6 + 9}）點穿刺傷害；若以雙手持用，則造成（{@damage 3d8 + 9}）點穿刺傷害。",
	"bestiary/bestiary-tce.json/monster/11/hp/special": "50（僅限惡魔）或40（僅限魔鬼）或60（僅限尤格羅斯魔），加上法術位每高於6環一環便增加15",
	"bestiary/bestiary-tce.json/monster/16/action/2/entries/0": "靈魄發出尖嘯。它30尺內每個生物必須通過一次感知豁免，對抗你的法術豁免DC，否則陷入{@condition frightened||恐懼}1分鐘。陷入{@condition frightened||恐懼}的生物可以在其每個回合結束時重複豁免，成功時終止自身的效應。",
	"bestiary/bestiary-tftyp.json/monster/71/trait/0/entries/0": "生物若觸碰黏液大師，或在其5尺內以近戰攻擊命中它，便受到9（{@damage 2d8}）點強酸傷害。任何非魔法武器命中黏液大師後會腐蝕；造成傷害後，武器的傷害擲骰承受永久且可累積的−1罰值。若罰值降至−5，武器便被摧毀。非魔法彈藥命中後，在造成傷害後被摧毀。",
	"bestiary/bestiary-tftyp.json/monster/123/trait/1/entries/0": "任何以金屬製成的非魔法武器命中白喉後會腐蝕；造成傷害後，武器的傷害擲骰承受永久且可累積的−1罰值。若罰值降至−5，武器便被摧毀。以金屬製成的非魔法彈藥命中白喉後，在造成傷害後被摧毀。",
	"bestiary/bestiary-toa.json/monster/9/legendary/2/entries/0": "萎縮者發出衰萎哀號。萎縮者120尺內能聽見哀號的每個生物必須通過一次{@dc 19}體質豁免，否則獲得1級{@condition exhaustion||力竭}。",
	"bestiary/bestiary-wdh.json/monster/23/trait/0/entries/0": "法杖位於{@spell antimagic field||反魔法場}區域內時陷入{@condition incapacitated||失能}。若成為{@spell dispel magic||解除魔法}的目標，法杖必須通過一次體質豁免，DC等於施法者的法術豁免DC，否則陷入{@condition unconscious||昏迷}1分鐘。",
	"bestiary/bestiary-xmm.json/monster/8/legendary/2/entries/0": "{@actSave con} {@dc 17}，以龍90尺內能看見的一點為中心，半徑20尺{@variantrule Sphere [Area of Effect]|XPHB|球形}內的每個生物。{@actSaveFail}10（{@damage 3d6}）點雷鳴傷害，且目標陷入{@condition Deafened|XPHB|耳聾}直到其下一回合結束。",
	"bestiary/bestiary-xmm.json/monster/19/action/3/entries/0": "{@actSave con} {@dc 21}，90尺{@variantrule Cone [Area of Effect]|XPHB|錐形}內的每個生物。{@actSaveFail}目標陷入{@condition Incapacitated|XPHB|失能}直到其下一回合結束，屆時重複豁免。{@actSaveFail 2}目標陷入{@condition Unconscious|XPHB|昏迷}10分鐘。若目標受到傷害，或其5尺內一個生物採取動作將其喚醒，此效應對目標終止。",
	"bestiary/bestiary-xmm.json/monster/35/action/1/entries/0": "{@atkr m,r} {@hit 9}，觸及5尺或射程120尺。{@h}31（{@damage 4d12 + 5}）點黯蝕傷害。",
	"bestiary/bestiary-xmm.json/monster/81/action/1/entries/0": "{@atkr m} {@hit 7}，觸及5尺。{@h}17（{@damage 2d12 + 4}）點穿刺傷害。",
	"bestiary/bestiary-xphb.json/monster/0/trait/0/entries/0": "若靈魄至少有1點{@variantrule Hit Points|XPHB|生命值}，則在其回合開始時恢復5點{@variantrule Hit Points|XPHB|生命值}。",
	"bestiary/fluff-bestiary-bgg.json/monsterFluff/42/entries/0/entries/1": "受飼養者命令時，巨鵝會生下一枚金蛋——一個長1尺、重2磅、內部中空的黃金蛋殼。蛋殼價值100 gp。有時蛋中會莫名出現某種小飾品或次要魔法物品。巨鵝生下金蛋後，要過一年零一天才能再次生產。",
	"bestiary/fluff-bestiary-cos.json/monsterFluff/3/entries/0/entries/0/entries/0/entries/3/entries/1": "史特拉德不認為鴉人是嚴重威脅，但萊薩迦選擇將他們視為眼中釘。經過長期搜索與探知，她在美酒巫師酒莊（第12章）發現一處鴉人庇護所，並開始對其發動戰爭。此外，她與出沒於往日山丘（第14章）的瘋狂德魯伊結盟，說服他們相信史特拉德是她所生，而德魯伊將史特拉德視為神祇。有德魯伊相助，她期望徹底清除巴洛維亞的鴉人禍患。",
	"bestiary/fluff-bestiary-mabjov.json/monsterFluff/35/entries/3": "帕祖祖的居所是無底深淵第一層帕祖尼亞，又稱無限門扉平原或1,001櫥宮。此地環境險惡，表面遍布深坑與裂谷。這些深坑都是傳送門，不僅通往無底深淵的所有層級，也通往其他位面，乃至凡人世界。只有帕祖祖知道每道門通往何處。",
	"bestiary/fluff-bestiary-mpmm.json/monsterFluff/167/entries/4/rows/0/1": "完好且仍裝有酒的酒囊",
	"bestiary/fluff-bestiary-mpp.json/monsterFluff/5/entries/1/entries/0/entries/1": "在巢穴中遭遇貝納羅斯魔時，其挑戰等級為18（20,000 XP）。",
	"bestiary/fluff-bestiary-mtf.json/monsterFluff/22/entries/2/entries/2/rows/2/1": "{@b 改良護甲。}發條構裝體的AC提高2。",
	"bestiary/fluff-bestiary-skt.json/monsterFluff/35/entries/0/entries/0/entries/4/entries/4": "駝鹿：{@spell find steed||尋獲坐騎}（以1個動作施展；僅限駝鹿）、{@spell haste||加速術}",
	"bestiary/bestiary-toa.json/monster/55/action/3/entries/0": "{@atk mw}命中{@hit 6}，觸及5尺，單一目標。{@h}7（{@damage 1d8 + 3}）點揮砍傷害；若以雙手持用則造成8（{@damage 1d10 + 3}）點揮砍傷害；此外再造成7（{@damage 2d6}）點火焰傷害。",
	"bestiary/bestiary-xmm.json/monster/156/trait/1/entries/1": "若魔像的創造者位於狂怒魔像60尺內，創造者可以採取一個動作進行一次{@dc 15}魅力（{@skill Persuasion|XPHB|遊說}）檢定，嘗試使魔像冷靜；魔像必須能聽見其創造者。檢定成功時，魔像不再狂怒，直到其下一回合開始；若此時魔像仍處於{@status Bloodied|XPHB|浴血}狀態，便再次檢查狂怒特質是否生效。",
	"bestiary/bestiary-xmm.json/monster/450/spellcasting/0/headerEntries/0": "吸血鬼施展{@spell Charm Person|XPHB|魅惑人類}，無需法術成分並以魅力作為施法屬性（法術豁免{@dc 17}），且持續時間為24小時。處於{@condition Charmed|XPHB|魅惑}狀態的目標會自願接受吸血鬼的啃咬，該次傷害不會終止法術。法術結束時，目標不會察覺自己曾被吸血鬼{@condition Charmed|XPHB|魅惑}。",
	"bestiary/bestiary-xphb.json/monster/12/action/2/entries/0": "{@atkr r}{@hitYourSpellAttack 加值等於你的法術攻擊調整值}，射程60尺。{@h}{@damage 1d10 + 3 + summonSpellLevel}點鈍擊傷害，且目標的{@variantrule Speed|XPHB|速度}降為0，直到巨蟲下一回合開始。",
}

MONSTER_TEXT_OVERRIDES: dict[str, str] = {
	"Red—5 years or less": "紅色—5歲或以下",
	"The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a {@dc 19} Dexterity saving throw or take 13 ({@damage 2d6 + 6}) bludgeoning damage and be knocked {@condition prone}. The dragon can then fly up to half its flying speed.": "龍拍動雙翼。龍身邊10尺內每個生物必須通過一次{@dc 19}敏捷豁免，否則受到13（{@damage 2d6 + 6}）點鈍擊傷害並陷入{@condition prone||倒地}。龍接著可以飛行至多等同其飛行速度一半的距離。",
	"The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a {@dc 23} Dexterity saving throw or take 15 ({@damage 2d6 + 8}) bludgeoning damage and be knocked {@condition prone}. The dragon can then fly up to half its flying speed.": "龍拍動雙翼。龍身邊15尺內每個生物必須通過一次{@dc 23}敏捷豁免，否則受到15（{@damage 2d6 + 8}）點鈍擊傷害並陷入{@condition prone||倒地}。龍接著可以飛行至多等同其飛行速度一半的距離。",
	"{@atk mw} {@hit 14} to hit, reach 5 ft., one target. {@h}15 ({@damage 2d6 + 8}) slashing damage.": "{@atk mw}命中{@hit 14}，觸及5尺，單一目標。{@h}15（{@damage 2d6 + 8}）點揮砍傷害。",
	"The dragon exhales paralyzing gas in a 60-foot cone. Each creature in that area must succeed on a {@dc 20} Constitution saving throw or be {@condition paralyzed} for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.": "龍呼出麻痺氣體，形成60尺錐形。區域內每個生物必須通過一次{@dc 20}體質豁免，否則陷入{@condition paralyzed||麻痺}1分鐘。生物可以在其每個回合結束時重複豁免，成功時終止自身的效應。",
	"{@atk mw} {@hit 6} to hit, reach 5 ft., one target. {@h}6 ({@damage 1d6 + 3}) piercing damage, and the target must make a {@dc 15} Constitution saving throw, taking 24 ({@damage 7d6}) poison damage on a failed save, or half as much damage on a successful one.": "{@atk mw}命中{@hit 6}，觸及5尺，單一目標。{@h}6（{@damage 1d6 + 3}）點穿刺傷害；目標必須進行一次{@dc 15}體質豁免，失敗受到24（{@damage 7d6}）點毒素傷害，成功則傷害減半。",
}

# Proper names which the pinned community source leaves in English.  Existing
# community forms are preferred where discoverable (for example, Leosin and
# Vizeran); otherwise these use the project's Taiwan Traditional Chinese
# transliteration rules.  Machine identifiers intentionally remain unchanged.
MONSTER_NAME_TRANSLATIONS: dict[str, str] = {
	"Nintra Siotta": "妮恩特拉·西奧塔",
	"Ram Sugar": "拉姆·舒格",
	"Aeshma": "艾什瑪",
	"Buer": "布耶爾",
	"Eriflamme": "艾瑞弗蘭",
	"Waeloquay": "維洛奎",
	"Shira": "希拉",
	"Sken Zabriss": "斯肯·札布里斯",
	"Skr'a S'orsk": "斯克拉·索斯克",
	"Three Earrings": "三耳環",
	"Othokent": "奧索肯特",
	"Leosin Erlanthar": "雷歐辛·厄蘭塔",
	"Spellix Romwod": "斯佩利克斯·羅姆沃德",
	"Lynx Creatlach": "林克斯·克里特拉赫",
	"Sir Ursas": "烏薩斯爵士",
	"Tarnhem": "塔恩赫姆",
	"Nimuel": "尼姆埃爾",
	"Wei Feng Ying": "魏鳳英",
	"Zala Morphus": "薩拉·墨菲斯",
	"Zorhanna Adulare": "佐哈娜·阿杜拉雷",
	"Warwyck Blastimoff": "沃威克·布拉斯提莫夫",
	"Whymsee": "懷姆希",
	"Szikzith": "斯齊克齊斯",
	"Rumpadump": "蘭帕丹普",
	"Vizeran DeVir": "維茲蘭·迪威爾",
	"Xazax the Eyemonger": "眼商札札克斯",
	"Y": "歪",
	"Yantha Coaxrock": "揚薩·寇克斯洛克",
	"Nellik": "妮莉克",
	"Qunbraxel": "昆布拉克塞爾",
	"Voalsh": "沃爾什",
	"Yanthdel Henlifel": "揚瑟爾·亨利菲爾",
	"Na": "娜",
	"Nyssa Otellion": "妮莎·歐泰利昂",
	"Rezran \"Snake Eyes\" Agrodro": "雷茲蘭「蛇眼」阿格羅卓",
	"Sangora": "桑戈拉",
	"Sarusanda Allester": "薩魯桑達·阿勒斯特",
	"Umberto Noblin": "翁貝托·諾布林",
	"Uvashar": "烏瓦沙爾",
	"Vaeve": "薇芙",
	"Valendar": "瓦倫達爾",
	"Obaya Uday": "歐芭雅·烏黛",
	"Soluun Xibrindas": "索倫·希布林達斯",
	"Tissina Khyret": "蒂西娜·凱瑞特",
	"Willifort Crowelle": "威利福特·克羅威爾",
	"Sundeth": "桑德斯",
	"Thwad Underbrew": "斯瓦德·安德布魯",
	"Torbit": "托比特",
	"Wyllow": "威洛",
	"Xarann A'Daragon": "札蘭·阿達拉貢",
	"Xorta": "佐塔",
	"Zox Clammersham": "佐克斯·克拉默沙姆",
	"Zress Orlezziir": "澤瑞絲·奧雷齊爾",
}

ITEM_NUMERIC_EQUIVALENT_CONTEXTS: dict[str, str] = {
	"items.json/item/2066/entries/3/items/0": "100 million miles is faithfully rendered as 1億英里",
	"items.json/item/2220/entries/4/entries/1/items/1": "1/7 days is faithfully rendered as 每7天1次",
	"bestiary/bestiary-bam.json/monster/71/trait/0/entries/0": "written English numbers are faithfully rendered as Chinese numerals",
	"bestiary/bestiary-bmt.json/monster/5/trait/0/entries/0": "38°C is an explanatory conversion of 100°F",
	"bestiary/bestiary-egw.json/monster/21/trait/1/entries/0": "Chinese large-number forms preserve 20,000 and 10,000",
	"bestiary/bestiary-mm.json/monster/310/variant/0/entries/1": "100% faithfully expresses no chance of failure",
	"bestiary/bestiary-mpmm.json/monster/93/trait/0/entries/0": "every foot is faithfully rendered as 每1尺",
	"bestiary/bestiary-mpmm.json/monster/146/trait/0/entries/0": "every foot is faithfully rendered as 每1尺",
	"bestiary/bestiary-mtf.json/monster/51/trait/1/entries/0": "every foot is faithfully rendered as 每1尺",
	"bestiary/bestiary-mtf.json/monster/74/trait/1/entries/0": "every foot is faithfully rendered as 每1尺",
	"bestiary/bestiary-wdh.json/monster/39/action/3/entries/1/items/3": "零下50 faithfully preserves -50",
	"bestiary/fluff-bestiary-bgdia.json/monsterFluff/37/entries/0/entries/0/entries/0": "in his forties is faithfully rendered as 40歲左右",
	"bestiary/fluff-bestiary-cos.json/monsterFluff/42/entries/0/entries/0/entries/0/entries/0": "five hundred is faithfully rendered as 500",
	"bestiary/fluff-bestiary-ftd.json/monsterFluff/7/entries/1/entries/4/entries/1/entries/0/rows/2/1": "a thousand is faithfully rendered as 1000",
	"bestiary/fluff-bestiary-ftd.json/monsterFluff/12/entries/1/entries/2/entries/2/entries/2/items/0/entry": "twelve hundred is faithfully rendered as 1200",
	"bestiary/fluff-bestiary-ftd.json/monsterFluff/76/entries/1/entries/4/entries/1/entries/0/rows/2/1": "a thousand is faithfully rendered as 1000",
	"bestiary/fluff-bestiary-mm.json/monsterFluff/380/entries/0/entries/0/entries/1": "written English measurements are faithfully rendered as Chinese numerals",
	"bestiary/fluff-bestiary-mpmm.json/monsterFluff/19/entries/0": "sixty-six is faithfully rendered as 66",
	"bestiary/fluff-bestiary-mpmm.json/monsterFluff/233/entries/2": "a thousand is faithfully rendered as 1000",
	"bestiary/fluff-bestiary-mpmm.json/monsterFluff/291/entries/5/entries/0": "two dozen is faithfully rendered as 24",
	"bestiary/fluff-bestiary-mtf.json/monsterFluff/157/entries/0/entries/1/entries/0": "two dozen is faithfully rendered as 24",
	"bestiary/fluff-bestiary-oota.json/monsterFluff/6/entries/0/entries/0/entries/4/entries/0": "one hundred and fifty is faithfully rendered as 150",
	"bestiary/legendarygroups.json/legendaryGroup/153/regionalEffects/1/items/0": "1 in 20 is faithfully rendered as 1/20",
}


class ContentLocalizer(CORE.Localizer):
	_SLOT_ABOVE_RE = re.compile(r"for each slot level above (\d+)(?:st|nd|rd|th)", re.IGNORECASE)
	_FULLWIDTH_NUMBER_TRANSLATION = str.maketrans("０１２３４５６７８９", "0123456789")

	def localize_string(self, english: str, translated: str, context: str) -> str:
		translation_overrides = {**ITEM_TRANSLATION_OVERRIDES, **MONSTER_TRANSLATION_OVERRIDES}
		if context.startswith("bestiary/") and english in MONSTER_TEXT_OVERRIDES:
			translation_overrides[context] = MONSTER_TEXT_OVERRIDES[english]
		if context in translation_overrides:
			self.report["sourceRepairsApplied"].append({
				"context": context,
				"from": self.normalize_text(translated),
				"to": translation_overrides[context],
			})
			translated = translation_overrides[context]
		translated = self.normalize_text(translated)
		if context.endswith("/template"):
			translated = translated.replace("\\xa0", "\u00a0")
		if not context.startswith("spells/"):
			translated = translated.translate(self._FULLWIDTH_NUMBER_TRANSLATION)
		if match := self._SLOT_ABOVE_RE.search(english):
			base_level = match.group(1)
			translated, count = re.subn(
				r"使用的法術位每(?:比[^，。；]+)?高一環",
				f"使用的法術位每比 {base_level} 環高一環",
				translated,
				count=1,
			)
			if not count:
				translated, _ = re.subn(
					r"法術位每(?:比[^，。；]+)?高一環",
					f"法術位每比 {base_level} 環高一環",
					translated,
					count=1,
				)

		for source, replacement in (
			*SPELL_EXACT_REPAIRS.get(context, ()),
			*CHARACTER_OPTION_EXACT_REPAIRS.get(context, ()),
			*ITEM_EXACT_REPAIRS.get(context, ()),
		):
			if source not in translated:
				raise ValueError(f"Stale spell source repair at {context}: {source!r} not found")
			translated = translated.replace(source, replacement)
			self.report["sourceRepairsApplied"].append({
				"context": context,
				"from": source,
				"to": replacement,
			})

		return super().localize_string(english, translated, context)


class ItemLocalizer(ContentLocalizer):
	"""Translate renderer-facing item fields without mutating item identities."""

	_EXTRA_VISIBLE_KEYS = {
		"additionalEntries",
		"entriesTemplate",
		"reqAttune",
		"detail1",
		"template",
	}
	_INHERITS_VISIBLE_KEYS = {
		"entries",
		"reqAttune",
		"detail1",
		"namePrefix",
		"nameSuffix",
		"nameRemove",
	}

	@staticmethod
	def _is_top_item_group(context: str) -> bool:
		return re.fullmatch(r"items\.json/itemGroup/\d+", context) is not None

	def localize_node(
		self,
		english,
		translated,
		context: str,
		category: str,
		matcher=None,
	):
		translated_for_base = translated
		if isinstance(english, dict) and isinstance(translated, dict) and self._is_top_item_group(context):
			# ``itemGroup.items`` contains canonical item UIDs, not prose.
			translated_for_base = {key: value for key, value in translated.items() if key != "items"}

		out = super().localize_node(english, translated_for_base, context, category, matcher)
		if not isinstance(english, dict) or not isinstance(translated, dict) or not isinstance(out, dict):
			return out

		for key in self._EXTRA_VISIBLE_KEYS:
			if key not in english or key not in translated:
				continue
			out[key] = super().localize_node(
				english[key],
				translated[key],
				f"{context}/{key}",
				category,
				matcher,
			)

		if isinstance(english.get("inherits"), dict) and isinstance(translated.get("inherits"), dict):
			out["inherits"] = deepcopy(english["inherits"])
			for key in self._INHERITS_VISIBLE_KEYS:
				if key not in english["inherits"] or key not in translated["inherits"]:
					continue
				out["inherits"][key] = super().localize_node(
					english["inherits"][key],
					translated["inherits"][key],
					f"{context}/inherits/{key}",
					category,
					matcher,
				)

		return out


class MonsterLocalizer(ContentLocalizer):
	"""Translate monster stat-block prose while retaining every mechanical field."""

	_VISIBLE_TREE_CANONICAL_KEYS = CORE.CANONICAL_KEYS | {
		"ability",
		"displayAs",
		"hidden",
		"slots",
		"lower",
		"upper",
		"charges",
		"number",
		"choose",
		"mode",
		"addAs",
		"addHeadersAs",
		"index",
		"replace",
		"replaceWith",
		"names",
		"flags",
		"scalar",
	}
	_NOTE_KEYS = {"from", "condition", "note", "preNote", "special"}

	@staticmethod
	def _replace_visible_proper_names(text: str) -> str:
		def replace_segment(segment: str) -> str:
			for english, localized in sorted(MONSTER_NAME_TRANSLATIONS.items(), key=lambda pair: len(pair[0]), reverse=True):
				pattern = re.compile(rf"(?<![A-Za-z]){re.escape(english)}(?P<possessive>['’]s)?(?![A-Za-z])")
				segment = pattern.sub(lambda match: f"{localized}{'的' if match.group('possessive') else ''}", segment)
			return segment

		# Preserve canonical identifiers inside 5etools inline tags.  These are
		# link/search keys; only surrounding player-visible prose is transliterated.
		out = []
		last = 0
		for match in CORE.TAG_RE.finditer(text):
			out.append(replace_segment(text[last:match.start()]))
			out.append(match.group(0))
			last = match.end()
		out.append(replace_segment(text[last:]))
		return "".join(out)

	def translate_name(self, english: str, translated: str, category: str) -> str:
		return MONSTER_NAME_TRANSLATIONS.get(english) or super().translate_name(english, translated, category)

	def localize_string(self, english: str, translated: str, context: str) -> str:
		return self._replace_visible_proper_names(super().localize_string(english, translated, context))

	def _localize_visible_tree(self, english, translated, context: str, category: str):
		if isinstance(english, str):
			if not isinstance(translated, str):
				self.report["typeShapeMismatches"].append({
					"context": context,
					"englishType": "str",
					"translatedType": type(translated).__name__,
				})
				return english
			return self.localize_string(english, translated, context)

		if isinstance(english, list):
			if not isinstance(translated, list):
				self.report["typeShapeMismatches"].append({
					"context": context,
					"englishType": "list",
					"translatedType": type(translated).__name__,
				})
				return deepcopy(english)
			if len(english) != len(translated):
				self.report["arrayShapeMismatches"].append({
					"context": context,
					"englishLength": len(english),
					"translatedLength": len(translated),
				})
			return [
				self._localize_visible_tree(child, translated[ix] if ix < len(translated) else None, f"{context}/{ix}", category)
				for ix, child in enumerate(english)
			]

		if isinstance(english, dict):
			if not isinstance(translated, dict):
				self.report["typeShapeMismatches"].append({
					"context": context,
					"englishType": "dict",
					"translatedType": type(translated).__name__,
				})
				return deepcopy(english)
			out = deepcopy(english)
			if isinstance(english.get("name"), str) and isinstance(translated.get("name"), str):
				out["ENG_name"] = english["name"]
				out["name"] = self.translate_name(english["name"], translated["name"], category)
			if isinstance(english.get("shortName"), str) and isinstance(translated.get("shortName"), str):
				out["ENG_shortName"] = english["shortName"]
				out["shortName"] = self.translate_name(english["shortName"], translated["shortName"], category)
			for key, english_value in english.items():
				if key in {"name", "shortName"} or key in self._VISIBLE_TREE_CANONICAL_KEYS or key not in translated:
					continue
				out[key] = self._localize_visible_tree(
					english_value,
					translated[key],
					f"{context}/{key}",
					category,
				)
			return out

		return deepcopy(english)

	def _localize_notes(self, english, translated, context: str, category: str):
		if isinstance(english, list):
			if not isinstance(translated, list):
				return deepcopy(english)
			return [
				self._localize_notes(child, translated[ix] if ix < len(translated) else None, f"{context}/{ix}", category)
				for ix, child in enumerate(english)
			]
		if not isinstance(english, dict) or not isinstance(translated, dict):
			return deepcopy(english)
		out = deepcopy(english)
		for key, english_value in english.items():
			if key not in translated:
				continue
			if key in self._NOTE_KEYS and isinstance(english_value, str) and isinstance(translated[key], str):
				out[key] = self.localize_string(english_value, translated[key], f"{context}/{key}")
			elif isinstance(english_value, (list, dict)):
				out[key] = self._localize_notes(english_value, translated[key], f"{context}/{key}", category)
		return out

	def _localize_copy_mods(self, english, translated, context: str, category: str):
		if isinstance(english, list):
			if not isinstance(translated, list):
				return deepcopy(english)
			return [
				self._localize_copy_mods(child, translated[ix] if ix < len(translated) else None, f"{context}/{ix}", category)
				for ix, child in enumerate(english)
			]
		if not isinstance(english, dict) or not isinstance(translated, dict):
			return deepcopy(english)
		out = deepcopy(english)
		for key, english_value in english.items():
			if key not in translated:
				continue
			if key in MONSTER_ENTRY_KEYS:
				if isinstance(english_value, str):
					continue
				out[key] = self._localize_visible_tree(english_value, translated[key], f"{context}/{key}", category)
			elif isinstance(english_value, (list, dict)):
				out[key] = self._localize_copy_mods(english_value, translated[key], f"{context}/{key}", category)
		return out

	def localize_node(self, english, translated, context: str, category: str, matcher=None):
		out = super().localize_node(english, translated, context, category, matcher)
		if not isinstance(english, dict) or not isinstance(translated, dict) or not isinstance(out, dict):
			return out

		for key in MONSTER_ENTRY_KEYS:
			if key not in english or key not in translated:
				continue
			out[key] = self._localize_visible_tree(english[key], translated[key], f"{context}/{key}", category)

		if "languages" in english and "languages" in translated:
			out["languages"] = self._localize_visible_tree(english["languages"], translated["languages"], f"{context}/languages", category)
		for key in {"ac", "hp", "speed", "resist", "immune", "vulnerable", "conditionImmune"}:
			if key not in english or key not in translated:
				continue
			out[key] = self._localize_notes(english[key], translated[key], f"{context}/{key}", category)

		if isinstance(english.get("_copy"), dict) and isinstance(translated.get("_copy"), dict):
			out["_copy"] = self._localize_copy_mods(english["_copy"], translated["_copy"], f"{context}/_copy", category)
		return out


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser()
	parser.add_argument("group", choices=("spells", "character-options", "items", "monsters"))
	parser.add_argument(
		"--source-dir",
		type=Path,
		required=True,
		help="root of the pinned 5etools-cn checkout containing data/ and data-bak/",
	)
	return parser.parse_args()


def read_json(path: Path):
	return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(value, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")


def write_item_sidecar_chunks(output: dict) -> list[str]:
	"""Write the large item sidecar as deterministic browser-loadable chunks."""
	output_dir = OUTPUT_ROOT / "items"
	output_dir.mkdir(parents=True, exist_ok=True)
	for stale_path in output_dir.glob("items-[0-9][0-9][0-9].json"):
		stale_path.unlink()
	for stale_path in (output_dir / "item-groups.json", output_dir / "items.json"):
		stale_path.unlink(missing_ok=True)

	meta = deepcopy(output.get("_meta", {}))
	chunk_files = []
	items = output.get("item", [])
	for start in range(0, len(items), ITEM_SIDECAR_CHUNK_SIZE):
		file_name = f"items-{start // ITEM_SIDECAR_CHUNK_SIZE:03d}.json"
		write_json(output_dir / file_name, {"_meta": meta, "item": items[start:start + ITEM_SIDECAR_CHUNK_SIZE]})
		chunk_files.append(file_name)

	group_file = "item-groups.json"
	write_json(output_dir / group_file, {"_meta": meta, "itemGroup": output.get("itemGroup", [])})
	chunk_files.append(group_file)
	return chunk_files


def sha256(path: Path) -> str:
	return hashlib.sha256(path.read_bytes()).hexdigest()


def get_spell_specs() -> list[tuple[str, tuple[str, ...]]]:
	spell_root = UPSTREAM_ROOT / "spells"
	return [
		*(
			(f"spells/{path.name}", ("spell",))
			for path in sorted(spell_root.glob("spells-*.json"))
		),
		*(
			(f"spells/{path.name}", ("spellFluff",))
			for path in sorted(spell_root.glob("fluff-spells-*.json"))
		),
	]


def get_monster_specs() -> list[tuple[str, tuple[str, ...]]]:
	bestiary_root = UPSTREAM_ROOT / "bestiary"
	return [
		*((f"bestiary/{path.name}", ("monster",)) for path in sorted(bestiary_root.glob("bestiary-*.json"))),
		*((f"bestiary/{path.name}", ("monsterFluff",)) for path in sorted(bestiary_root.glob("fluff-bestiary-*.json"))),
		("bestiary/legendarygroups.json", ("legendaryGroup",)),
	]


def get_group_config(group: str) -> dict:
	if group == "spells":
		return {
			"folder": "spells",
			"specs": get_spell_specs(),
			"sharedProps": {},
			"reportName": "spell-import-report.json",
		}
	if group == "character-options":
		return {
			"folder": "character-options",
			"specs": [
				("races.json", ("race", "subrace")),
				("fluff-races.json", ("raceFluff",)),
				("backgrounds.json", ("background",)),
				("fluff-backgrounds.json", ("backgroundFluff",)),
				("feats.json", ("feat",)),
				("fluff-feats.json", ("featFluff",)),
				("optionalfeatures.json", ("optionalfeature",)),
				("fluff-optionalfeatures.json", ("optionalfeatureFluff",)),
			],
			"sharedProps": {"fluff-races.json": ("raceFluffMeta",)},
			"reportName": "character-options-import-report.json",
		}
	if group == "items":
		return {
			"folder": "items",
			"specs": [
				("items.json", ("item", "itemGroup")),
				("items-base.json", ("baseitem", "itemProperty", "itemType", "itemTypeAdditionalEntries", "itemEntry", "itemMastery")),
				("magicvariants.json", ("magicvariant",)),
				("fluff-items.json", ("itemFluff",)),
			],
			"sharedProps": {},
			"reportName": "item-import-report.json",
		}
	if group == "monsters":
		return {
			"folder": "bestiary",
			"specs": get_monster_specs(),
			"sharedProps": {},
			"reportName": "monster-import-report.json",
		}
	raise ValueError(f"Unsupported content group: {group}")


def localize_spell_time(localizer, english: dict, translated: dict, localized: dict, context: str) -> None:
	"""Translate only renderer-facing condition/note strings inside spell time."""
	english_times = english.get("time")
	translated_times = translated.get("time")
	localized_times = localized.get("time")
	if not all(isinstance(value, list) for value in (english_times, translated_times, localized_times)):
		return
	if not (len(english_times) == len(translated_times) == len(localized_times)):
		localizer.report["arrayShapeMismatches"].append({
			"context": f"{context}/time",
			"englishLength": len(english_times),
			"translatedLength": len(translated_times),
		})
		return
	for ix, (english_time, translated_time) in enumerate(zip(english_times, translated_times)):
		if not isinstance(english_time, dict) or not isinstance(translated_time, dict):
			continue
		for key in ("condition", "note"):
			if not isinstance(english_time.get(key), str) or not isinstance(translated_time.get(key), str):
				continue
			localized_times[ix][key] = localizer.localize_string(
				english_time[key],
				localizer.normalize_text(translated_time[key]),
				f"{context}/time/{ix}/{key}",
			)


def build_file(
	localizer,
	english_data: dict,
	translated_data: dict,
	props: tuple[str, ...],
	relative: str,
	*,
	shared_props: tuple[str, ...] = (),
):
	output = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"conversion": "OpenCC s2twp; locked project terminology; canonical inline-tag reconciliation",
			"license": "CC BY-NC-SA 4.0",
		},
	}
	counts = {}
	for prop in props:
		english_entities = english_data.get(prop, [])
		translated_entities = translated_data.get(prop, [])
		output[prop] = []
		pairs = CORE.pair_top_entities(english_entities, translated_entities, prop, localizer.report)
		for ix, (english, translated) in enumerate(pairs):
			context = f"{relative}/{prop}/{ix}"
			if translated is None:
				localized = deepcopy(english)
				if isinstance(english.get("name"), str):
					localized["ENG_name"] = english["name"]
			else:
				localized = localizer.localize_node(english, translated, context, prop)
				if prop == "spell":
					localize_spell_time(localizer, english, translated, localized, context)
			output[prop].append(localized)
		counts[prop] = len(output[prop])
	for prop in shared_props:
		if prop not in english_data or prop not in translated_data:
			continue
		if isinstance(english_data[prop], dict) and isinstance(translated_data[prop], dict):
			output[prop] = {
				key: localizer.localize_node(
					value,
					translated_data[prop].get(key),
					f"{relative}/{prop}/{key}",
					prop,
				)
				for key, value in english_data[prop].items()
			}
		else:
			output[prop] = localizer.localize_node(
				english_data[prop],
				translated_data[prop],
				f"{relative}/{prop}",
				prop,
			)
	return output, counts


_VISIBLE_DIRECT_KEYS = CORE.DIRECT_VISIBLE_KEYS | {
	"m",
	"condition",
	"note",
	"label",
	"additionalEntries",
	"entriesTemplate",
	"reqAttune",
	"detail1",
	"template",
	"namePrefix",
	"nameSuffix",
	"nameRemove",
	*MONSTER_DISPLAY_KEYS,
}


def validate_content_shape(
	english,
	localized,
	context: str,
	failures: list[dict],
	*,
	parent_key: str | None = None,
	is_top_entity: bool = False,
	is_visible_branch: bool = False,
) -> None:
	"""Require every non-visible leaf to remain byte-for-byte equivalent."""
	if isinstance(english, list):
		if not isinstance(localized, list) or len(english) != len(localized):
			failures.append({"context": context, "reason": "array-shape"})
			return
		for ix, child in enumerate(english):
			validate_content_shape(child, localized[ix], f"{context}/{ix}", failures, parent_key=parent_key, is_visible_branch=is_visible_branch)
		return

	if isinstance(english, dict):
		if not isinstance(localized, dict):
			failures.append({"context": context, "reason": "object-shape"})
			return
		if is_top_entity and isinstance(english.get("name"), str) and localized.get("ENG_name") != english["name"]:
			failures.append({"context": f"{context}/name", "reason": "missing-english-name-backup"})
		allowed_extra = {"ENG_name", "ENG_shortName"}
		for key in localized.keys() - english.keys() - allowed_extra:
			failures.append({"context": f"{context}/{key}", "reason": "unexpected-key"})
		for key, value in english.items():
			if key not in localized:
				failures.append({"context": f"{context}/{key}", "reason": "missing-key"})
				continue
			validate_content_shape(
				value,
				localized[key],
				f"{context}/{key}",
				failures,
				parent_key=key,
				is_visible_branch=is_visible_branch or key in _VISIBLE_DIRECT_KEYS | CORE.CONTENT_CONTAINER_KEYS,
			)
		return

	if english == localized:
		return
	if isinstance(english, str) and isinstance(localized, str):
		if is_visible_branch or parent_key in _VISIBLE_DIRECT_KEYS | CORE.CONTENT_CONTAINER_KEYS:
			return
		failures.append({"context": context, "reason": "non-visible-string-changed"})
		return
	failures.append({"context": context, "reason": "mechanical-value-changed"})


def finalize_qa(localizer) -> dict:
	report = localizer.report

	numeric_raw = report.pop("numericDifferences")
	numeric_equivalent = []
	numeric_unresolved = []
	for item in numeric_raw:
		if item.get("context") in ITEM_NUMERIC_EQUIVALENT_CONTEXTS:
			is_equivalent = True
			reason = ITEM_NUMERIC_EQUIVALENT_CONTEXTS[item["context"]]
		else:
			is_equivalent, reason = CORE.classify_numeric_difference(item)
		annotated = {**item, "reason": reason}
		(numeric_equivalent if is_equivalent else numeric_unresolved).append(annotated)
	report["numericDifferencesRawCount"] = len(numeric_raw)
	report["numericEquivalentDifferences"] = numeric_equivalent
	report["numericUnresolved"] = numeric_unresolved

	untranslated_raw = report.pop("untranslatedVisibleStrings")
	def is_proper_name_list(item: dict) -> bool:
		parts = [part.strip() for part in item.get("english", "").split(",")]
		return len(parts) >= 5 and all(re.fullmatch(r"[A-Z][A-Za-z'’ -]*", part) for part in parts)

	def is_intentional_untranslated(item: dict) -> bool:
		english = item.get("english", "")
		return (
			CORE.is_intentional_untranslated(item)
			or is_proper_name_list(item)
			or english == "optional"
			or item.get("context") == "bestiary/fluff-bestiary-mabjov.json/monsterFluff/21/entries/1/entries/0"
			or re.fullmatch(r"\{\{[^{}]+\}\}(?:\s*\([^)]*\))?", english) is not None
			or re.fullmatch(r"(?:[AKQJ]\s*)?\{@color\s+[♦♥]\|#ff0000\}(?:\s*\(Cups\))?", english) is not None
		)

	intentional = [
		{
			**item,
			"reason": "proper-name list retained" if is_proper_name_list(item) else "mechanical/numeric text retained",
		}
		for item in untranslated_raw
		if is_intentional_untranslated(item)
	]
	report["untranslatedVisibleStringsRawCount"] = len(untranslated_raw)
	report["intentionalUntranslatedStrings"] = intentional
	report["untranslatedVisibleStrings"] = [
		item for item in untranslated_raw
		if not is_intentional_untranslated(item)
	]

	tag_shape_raw = report.pop("tagShapeMismatches")
	if report["tagCanonicalDifferences"]:
		report["tagShapeMismatches"] = tag_shape_raw
		report["tagShapeDifferencesResolved"] = []
	else:
		report["tagShapeMismatches"] = []
		report["tagShapeDifferencesResolved"] = [
			{**item, "reason": "translated tag order/shape differed; canonical multiset restored"}
			for item in tag_shape_raw
		]

	return report


def main() -> None:
	args = parse_args()
	source_root = args.source_dir.resolve()
	config = get_group_config(args.group)
	specs = config["specs"]
	localizer = (
		ItemLocalizer() if args.group == "items"
		else MonsterLocalizer() if args.group == "monsters"
		else ContentLocalizer()
	)

	guards = {}
	for relative, _ in specs:
		local_path = UPSTREAM_ROOT / relative
		backup_path = source_root / "data-bak" / relative
		translated_path = source_root / "data" / relative
		for path in (local_path, backup_path, translated_path):
			if not path.is_file():
				raise SystemExit(f"Missing required file: {path}")
		is_match = local_path.read_bytes() == backup_path.read_bytes()
		guards[relative] = {
			"localEnglishSha256": sha256(local_path),
			"sourceBackupSha256": sha256(backup_path),
			"translatedSourceSha256": sha256(translated_path),
			"byteIdentical": is_match,
		}
		if not is_match:
			raise SystemExit(f"English guard mismatch for {relative}; expected 5etools {UPSTREAM_TAG}")
		localizer.register_source_names(read_json(translated_path))

	for relative, _ in specs:
		localizer.register_tag_translations(
			read_json(UPSTREAM_ROOT / relative),
			read_json(source_root / "data" / relative),
		)

	outputs = {}
	counts = Counter()
	for relative, props in specs:
		output, file_counts = build_file(
			localizer,
			read_json(UPSTREAM_ROOT / relative),
			read_json(source_root / "data" / relative),
			props,
			relative,
			shared_props=config["sharedProps"].get(relative, ()),
		)
		outputs[relative] = output
		counts.update(file_counts)
		if not (args.group == "items" and relative == "items.json"):
			write_json(OUTPUT_ROOT / config["folder"] / Path(relative).name, output)

	item_chunk_files = write_item_sidecar_chunks(outputs["items.json"]) if args.group == "items" else []

	canonical_failures = []
	for relative, props in specs:
		english = read_json(UPSTREAM_ROOT / relative)
		localized = outputs[relative]
		for prop in props:
			english_entities = english.get(prop, [])
			localized_entities = localized.get(prop, [])
			if len(english_entities) != len(localized_entities):
				canonical_failures.append({"context": f"{relative}/{prop}", "reason": "array-shape"})
				continue
			for ix, (english_entity, localized_entity) in enumerate(zip(english_entities, localized_entities)):
				validate_content_shape(
					english_entity,
					localized_entity,
					f"{relative}/{prop}/{ix}",
					canonical_failures,
					parent_key=prop,
					is_top_entity=True,
				)
		for prop in config["sharedProps"].get(relative, ()):
			validate_content_shape(
				english.get(prop),
				localized.get(prop),
				f"{relative}/{prop}",
				canonical_failures,
				parent_key=prop,
			)

	qa = finalize_qa(localizer)
	blocking_qa_keys = (
		"unmatchedEnglishEntities",
		"unmatchedTranslatedEntities",
		"arrayShapeMismatches",
		"typeShapeMismatches",
		"tagShapeMismatches",
		"unmatchedTranslatedTags",
		"tagCanonicalDifferences",
		"diceDifferences",
		"numericUnresolved",
		"untranslatedVisibleStrings",
	)
	status = "pass" if not canonical_failures and not any(qa[key] for key in blocking_qa_keys) else "needs-review"

	index = {
		"_meta": {
			"locale": "zh-TW",
			"upstreamTag": UPSTREAM_TAG,
			"upstreamCommit": UPSTREAM_COMMIT,
			"translationSourceRepository": SOURCE_REPOSITORY,
			"translationSourceCommit": SOURCE_COMMIT,
			"license": "CC BY-NC-SA 4.0",
		},
		"files": [Path(relative).name for relative, _ in specs],
		"entityCounts": dict(counts),
	}
	if item_chunk_files:
		index["fileChunks"] = {"items.json": item_chunk_files}
	write_json(OUTPUT_ROOT / config["folder"] / "index.json", index)

	report = {
		"status": status,
		"source": {
			"repository": SOURCE_REPOSITORY,
			"commit": SOURCE_COMMIT,
			"license": "CC BY-NC-SA 4.0",
			"attribution": "Kiwee and contributors; DND Common Library; folk localization groups and independent translators",
		},
		"upstream": {"tag": UPSTREAM_TAG, "commit": UPSTREAM_COMMIT},
		"guards": guards,
		"counts": dict(counts),
		"canonicalFailures": canonical_failures,
		"qa": qa,
	}
	write_json(TRANSLATION_ROOT / config["folder"] / "generated" / config["reportName"], report)

	print(json.dumps({
		"status": status,
		"files": len(specs),
		"counts": dict(counts),
		"canonicalFailures": len(canonical_failures),
		**{key: len(qa[key]) for key in blocking_qa_keys},
		"numericDifferencesRaw": qa["numericDifferencesRawCount"],
		"numericEquivalentDifferences": len(qa["numericEquivalentDifferences"]),
		"resolvedTagShapeDifferences": len(qa["tagShapeDifferencesResolved"]),
	}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
	main()
