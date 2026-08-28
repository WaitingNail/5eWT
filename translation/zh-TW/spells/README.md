# 法術繁體中文化

本目錄記錄 5etools-src `v2.33.3` 的法術翻譯來源、轉換方式與 QA 報告。

- 法術：936 筆，涵蓋 2014、2024 與本版本所收錄的其他來源。
- 法術補充敘述：89 筆。
- 顯示名稱、正文、升環說明、材料敘述、施法時間備註與傷害標籤均採繁體中文 sidecar。
- 英文名稱、來源、頁碼、雜湊、法術環級、學派、距離、持續時間、骰式、篩選值與 inline-tag 目標保持 canonical。
- 清單與搜尋同時保留中文顯示名稱及英文名稱。
- 法術卡的環階／學派、施法時間、施法距離、成分與持續時間，以及法術篩選器和表格欄位均使用繁體中文顯示；底層機械值不變。

產生：

```bash
.venv-zh-tw/bin/python node/zh-tw/import-content-translations.py spells --source-dir ../5etools-cn-source
```

驗證：

```bash
node node/zh-tw/validate-content-translations.mjs
node node/zh-tw/test-content-i18n.mjs
```

授權與來源見 [SOURCE-ATTRIBUTION.md](SOURCE-ATTRIBUTION.md)。
