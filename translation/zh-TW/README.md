# zh-TW 翻譯工作區

此目錄保存 5etools v2.33.3 的臺灣繁體中文翻譯記憶、術語與自動盤點結果。

## 目前狀態

- `glossary-proposed.csv`：175 個核心介面與 D&D 規則術語；驗證器會鎖定唯一英文 key 與核准狀態。
- `style-guide.md`：本專案翻譯與技術規則草案。
- `generated/srd-manifest.json`：SRD 條目統計與來源版本。
- `generated/srd-entity-index.csv`：每個 `srd`／`srd52` 條目的檔案與 JSON Pointer。
- `generated/srd-entity-terms.csv`：2,085 個不重複英文名稱，待後續補入譯名。
- `classes/`：2014 與 2024 Classes 全量翻譯、人工修正與 QA 報告。
- `site/`：672 筆全站共用介面訊息與 locale 建置說明。
- `rules/`：動作、狀態／疾病、技能、感官、核心／變體規則與 2014 Quick Reference 的匯入來源、署名與 QA 報告。
- `spells/`：936 筆法術與 89 筆法術補充敘述的繁中 sidecar、來源署名、動態欄位中文化與機械值 QA 報告。
- `character-options/`：1,331 筆種族／亞種、背景、專長、選用特性與補充敘述的繁中 sidecar、來源署名與機械值 QA 報告。

## 重新產生盤點

```bash
npm run zh-tw:extract
npm run zh-tw:extract-classes
```

## 驗證核心術語表

```bash
npm run zh-tw:validate-glossary
```

術語核准後，將 `status` 改為 `approved`，再建立鎖定翻譯記憶。任何 `conflict` 項目在核准前不得用於批量翻譯正文。

## 完整驗證

```bash
npm run zh-tw:verify
```

此命令會驗證術語、Class、法術與角色選項全量 sidecar、共用介面、核心規則 runtime、canonical 欄位／inline tags，以及 Quick Reference／法術／角色選項的英文 hash 與雙語搜尋。

`rules/`、部分 `classes/`、`spells/` 與 `character-options/` 資料包含非 SRD 書籍內容，只能用於私人、自用 repository；授權與署名界線見各子目錄說明。
