# zh-TW 翻譯工作區

此目錄保存 5etools v2.33.3 的臺灣繁體中文翻譯記憶、術語與自動盤點結果。

## 目前狀態

- `glossary-proposed.csv`：174 個核心介面與 D&D 規則術語，狀態尚未鎖定。
- `style-guide.md`：本專案翻譯與技術規則草案。
- `generated/srd-manifest.json`：SRD 條目統計與來源版本。
- `generated/srd-entity-index.csv`：每個 `srd`／`srd52` 條目的檔案與 JSON Pointer。
- `generated/srd-entity-terms.csv`：2,085 個不重複英文名稱，待後續補入譯名。
- `classes/`：Classes 頁面的資料盤點、1,987 個術語候選與第一批核准清單。

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

## 下一個閘門

核准下列高影響詞組後，才開始批量翻譯：

- `Wisdom`／`Perception`
- `Species`／`Race`
- `Incapacitated`、`Grappled`、`Prone`、`Frightened`
- `Necrotic`、`Resistance`
- `Rogue`、`Warlock`
- `Opportunity Attack`
