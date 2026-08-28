# 角色選項繁體中文化

本目錄記錄 5etools-src `v2.33.3` 的種族、背景、專長與選用特性翻譯來源、轉換方式及 QA 報告。

- 種族 160 筆、亞種 98 筆、種族補充敘述 221 筆。
- 背景 161 筆、背景補充敘述 160 筆。
- 專長 276 筆、專長補充敘述 41 筆。
- 選用特性 213 筆、選用特性補充敘述 1 筆。
- 合計 1,331 筆；其中 1,326 筆具名條目均有繁中顯示名稱，另有 5 筆上游本來就沒有名稱的亞種機械記錄。
- 英文名稱、來源、頁碼、雜湊、先決條件機械值、熟練項、傷害／狀態欄位、骰式與 inline-tag 目標保持 canonical。
- 清單與搜尋同時保留中文顯示名稱及英文名稱；同名同來源的亞種會以其基礎種族再區分，避免套錯翻譯。
- 種族體型／速度／生物類型、背景技能摘要、專長類別／屬性／先決條件，以及選用特性類型與等級均以繁體中文顯示。

產生：

```bash
npm run zh-tw:import-character-options
```

驗證：

```bash
npm run zh-tw:validate-character-options
npm run zh-tw:test-content
```

授權與來源見 [SOURCE-ATTRIBUTION.md](SOURCE-ATTRIBUTION.md)。
