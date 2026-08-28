# 物品繁中 sidecar

本目錄記錄 5etools v2.33.3 物品翻譯的固定來源、生成方式與 QA 結果。實際網站資料位於 `data/zh-TW/items/`。

## 範圍

- 2,428 筆物品
- 109 筆物品群組
- 230 筆基礎物品
- 26 筆物品詞條
- 67 筆物品類型
- 2 筆類型補充規則
- 13 筆共用物品詞條
- 8 筆武器精通
- 214 筆魔法物品變體
- 948 筆物品補充敘述

合計 3,097 筆規則資料與 948 筆補充敘述。所有 4,020 個具名頂層實體均有繁中顯示名稱；物品詞條的 26 個名稱則由其翻譯後的規則區塊取得。

由於物品主資料較大，生成器會依 `index.json` 的 `fileChunks` 清單輸出固定 300 筆一組的分片；瀏覽器會在記憶體中依序合併，對 canonical 資料、網址與畫面行為沒有差異。

## 安全邊界

- `name`、`source`、網址 hash、`{@...}` 標籤的 canonical 目標及所有規則鍵仍以英文原典為準。
- `_displayName`、正文、同調條件、類型、稀有度、詞條與精通名稱只用於畫面顯示。
- 魔法變體先以英文規則組裝，再組合繁中顯示名稱，避免翻譯破壞基礎物品配對。
- 缺少或結構不符的 sidecar 會回退到英文原典，不會輸出半套規則資料。

## 重新產生與驗證

```bash
npm run import:items -- --source-dir ../5etools-cn
npm run validate:items
npm run test:items
```

生成報告位於 `generated/item-import-report.json`。目前報告狀態為 `pass`：實體配對、結構、canonical 標籤、骰式與數值皆無未解差異，可見欄位亦無整段原文未翻譯項目。

本資料包含非 SRD 內容，僅供私人、自用 repository 與受限制的私人預覽環境。來源與授權詳見 `SOURCE-ATTRIBUTION.md`。
