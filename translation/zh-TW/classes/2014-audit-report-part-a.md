# 2014 Class 規則審核報告（A 組）

## 範圍

- 檔案：`class-barbarian.json`、`class-bard.json`、`class-cleric.json`、`class-druid.json`、`class-fighter.json`、`class-monk.json`
- 版本：`edition: classic`／`classSource: PHB`
- 欄位：`class`、`subclass`、`classFeature`、`subclassFeature` 的可見 `entries`、`default` 與表格文字
- 核對項目：等級、次數、距離、骰式、DC、持續時間、傷害、正負號、上下限、否定與時機條件，以及 inline tag 類型與 canonical key

## 結果

共建立 **44 筆** guarded manual corrections：

| 檔案 | 2014 修正數 |
|---|---:|
| Barbarian | 9 |
| Bard | 6 |
| Cleric | 11 |
| Druid | 4 |
| Fighter | 11 |
| Monk | 3 |

除原先發現的等級、距離、時機、反應、對象範圍與文字複製錯誤外，最後一輪邊界值核對另修正：

- Bard、Cleric、Druid 的 Spell Slots 漏掉「可消耗等環或更高環法術位」。
- Bard 的 Infectious Inspiration 漏掉第二名生物也必須位於 60 尺內。
- Cleric 的 Artisan's Blessing 把「價值不超過 100 gp」誤成「低於 100 gp」。
- Druid 的 Natural Recovery 把「法術位環階總和小於或等於等級一半」誤成必須恰好等於。
- Fighter 的 Survivor 把「生命值不超過上限一半」誤成「不到一半」。

修正均位於 `translation/zh-TW/classes/manual-corrections/`，未直接編輯 generated sidecar。

## Guard 與 QA

執行：

```bash
PYTHONPATH=/tmp/zh-tw-opencc python node/zh-tw/import-full-class-translations.py --source-dir /tmp/shuaishuai-class
```

- Importer 成功；全專案 `manualCorrectionsApplied` 為 126 筆。
- 本報告 44 筆 2014 corrections 全部套用，expected guard 無失敗。
- 本報告 corrections 的英文原文與修正文 tag-type multiset 完全一致，未遺失 inline tag。
- `git diff --check` 通過。
- 全量報告的 1 個 array-shape mismatch 位於 Ranger，不在本審核範圍。
- 全量報告的 raw tag-shape 警告是上游譯文的 tag key／display 形狀差異；Importer 已在 generated sidecar 還原 canonical 英文 key。

## 仍需人工術語決策的可見英文

規則文字已無未處理的英文句子；Cleric 的 Peace Domain 神祇表仍有四個專名未決定繁中音譯：

- `/subclassFeature/109/entries/2/rows/0/0` — `{@deity Angharradh|Elven|SCAG}`
- `/subclassFeature/109/entries/2/rows/1/0` — `{@deity Berronar Truesilver|Dwarven|SCAG}`
- `/subclassFeature/109/entries/2/rows/3/0` — `{@deity Cyrrollalee|Halfling|SCAG}`
- `/subclassFeature/109/entries/2/rows/5/0` — `{@deity Gaerdal Ironhand|Gnomish|SCAG}`

這四項是專有名詞而非規則錯誤，應在神祇術語表鎖定音譯後統一處理。

Importer 另將 Druid Wild Shape／Circle Forms 表中的 11 個 CR filter tag 標成 untranslated visible string；其可見內容只有 `1/4`、`1/2`、`1` 至 `6` 等機械數值，並非英文漏譯，應保留 canonical filter 查詢。

## 尚需人工語義複核

- 無未解決的等級、次數、距離、骰式、DC、持續時間、傷害、上下限或否定條件差異。
- 若要進一步統一文風，可另做敘事性文字與術語潤飾；這不影響本輪規則數值審核結論。
