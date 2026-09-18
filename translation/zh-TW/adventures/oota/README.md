# 《逃離深淵》翻譯資料

繁體中文覆蓋層涵蓋 Out of the Abyss（OotA）的17章、4個附錄、後記及製作名單，共23個區塊。工作分支為 `codex/campaign-translations`，使用獨立 worktree，不直接更新 `main` 或部署。

沿用使用者允許先翻譯、再依回饋修訂的流程。已有同來源條目名稱優先；本書新增人物、場所與標題的譯名為專案暫定。引用、房間編號、來源與原文頁碼保留英文資料身分。

- `terminology.json`：鎖定標題與名稱；`heading-only` 不用作正文全域替換。
- `contextual-terminology.json`：英文來源出現對應詞時才套用的變體規則；只處理可見文字，保護既有引用名稱與識別欄位。
- `site-terminology.csv`、`chapter-labels.csv`：既有名稱的跨頁來源與標題對照。
- `terminology-extraction.csv`：首次頁碼、位置、出現次數、代表原文及譯名狀態。
- `block-classification.csv`：5,910個文字欄位的原文／譯文及內容分類；分類信心值不是翻譯品質評分。
- `text-overrides.json`：117筆帶原文比對保護的校訂；英文變動時拒絕套用。
- `reviewed-numeric-equivalences.json`：兩筆 `forty-eight`／`48` 等值寫法，綁定兩端字串 SHA-256。
- `site-name-corrections.json`：目前為空；本次未改動既有怪物頁名稱。
- `oota-import-review.json`、`coverage-summary.json`：結構、數字、引用及覆蓋紀錄。

英文來源固定為5etools v2.33.3（`e5f3e77b303a92df10487207857200245e71957c`）；中文基稿固定為 `tjliqy/5etools-cn` 的 `46b15d04f548c23c526084deae078e3568500349`，經 OpenCC s2twp、全站術語比對及來源保護校訂。英文備份必須與固定英文原檔逐位元組相同。

重建時準備來源目錄的 `data/adventures.json`，以及 `data/adventure/adventure-oota.json`、`data-bak/adventure/adventure-oota.json`；安裝 `requirements-zh-tw.txt` 後執行：

```sh
python node/zh-tw/import-adventure-oota.py --source-dir /path/to/pinned-source
python node/zh-tw/audit-adventure-oota.py
npm run apply
npm run test:oota
npm run verify
```

保留原作者與社群來源署名。翻譯層沿用來源標示的 CC BY-NC-SA 4.0，不表示原始遊戲內容另獲授權。圖片內嵌文字未重繪；原文口令與卓爾語保留拼寫及中文解釋。驗證範圍與限制見 `reports/zh-tw-oota-audit.md`。
