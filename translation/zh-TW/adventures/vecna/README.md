# Vecna 雙書翻譯資料

繁體中文覆蓋層涵蓋 `VNotEE`（Vecna: Nest of the Eldritch Eye）與 `VEoR`（Vecna: Eve of Ruin）。新譯名採專案暫定狀態，沿用使用者允許先翻譯、之後統一修訂的流程；既有同來源條目名稱優先。

- `terminology.json`：鎖定名稱及標題；`heading-only` 不會成為一般正文替換詞。
- `contextual-terminology.json`：只有英文來源字串出現指定專名時才套用的變體；不改引用的英文識別欄位。
- `terminology-extraction.csv`：首次頁碼、來源位置、出現次數、代表原文與譯名狀態。
- `site-terminology.csv`、`chapter-labels.csv`：跨頁名稱來源及標題對照。
- `block-classification.csv`：每個可見文字欄位的來源與內容分類。分類信心值不是翻譯品質分數。
- `text-overrides.json`：逐段校訂，附英文原文保護；來源不同時拒絕套用。
- `site-name-corrections.json`：同步修正 Grottenelle Stonecutter 的怪物頁名稱，不改英文 ID。
- `*-import-review.json`、`coverage-summary.json`：結構、數值及覆蓋紀錄。

固定中文來源為 `tjliqy/5etools-cn` 的 `46b15d04f548c23c526084deae078e3568500349`；英文為 5etools v2.33.3，`e5f3e77b303a92df10487207857200245e71957c`。兩份英文備份須逐位元組相同。原作者與社群貢獻者署名保留；翻譯層沿用來源標示的 CC BY-NC-SA 4.0，這不表示原始遊戲內容另獲授權。

重建時準備來源目錄的 `data/adventures.json`，以及 `data/adventure/`、`data-bak/adventure/` 下兩本對應 JSON，安裝 `requirements-zh-tw.txt` 後執行：

```sh
python node/zh-tw/import-adventure-vecna.py --source-dir /path/to/pinned-source
python node/zh-tw/audit-adventure-vecna.py
npm run apply
npm run test:vecna
npm run verify
```

驗證範圍、人工校訂與保留項見 `reports/zh-tw-vecna-audit.md`。圖片中的英文未重繪；VNotEE 是無頁碼的數位來源，沒有虛構紙本頁碼。
