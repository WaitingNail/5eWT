# Classes 臺灣繁體中文工作區

本目錄保存 5etools v2.33.3「Classes／職業」頁面的完整臺灣繁體中文 sidecar、鎖定術語、人工修訂與驗證報告。

## 完成範圍

- 上游版本：`5etools-mirror-3/5etools-src@v2.33.3`（`e5f3e77b303a92df10487207857200245e71957c`）
- 30 筆職業（2014、2024、Artificer、Mystic、Sidekick）
- 322 筆子職業
- 677 筆職業特性
- 1,441 筆子職業特性
- 30 筆職業 fluff 與 156 筆子職業 fluff
- Class 頁面介面、表頭、來源／再版提示、搜尋顯示與動態規則文字

譯文先採用[蟀蟀的 DND 寶庫](https://shuaishuaidnd.cn/)可對應 v2.33.3 結構的社群譯文，再轉為臺灣繁體、恢復英文 canonical 查找鍵，並以本目錄的 guarded corrections 修正規則、術語與格式問題。使用者已同意先採用目前找到的譯法，後續仍可逐條修訂。

## 重要檔案

- `data/zh-TW/class/*.json`：完整 Class／fluff sidecar；英文原始資料保持不變。
- `data/zh-TW/class.json`：Class UI 與名稱／標題 locale。
- `manual-corrections/*.json`：經人工校對的 guarded corrections；`expected` 防止上游或來源改動時靜默套錯位置。
- `translation-memory.csv`：已鎖定的中英翻譯記憶。
- `generated/class-terms-full.csv`：完整 Class 術語表。
- `generated/full-class-import-report.json`：匯入、結構與來源差異報告。
- `generated/full-class-validation-report.json`：canonical、標籤、未譯正文與數字警告報告。
- 311 筆 manual corrections 已套用；保留的 mixed ASCII／數字警告均已逐筆人工複核。

## 重建與驗證

```bash
python -m pip install -r requirements-zh-tw.txt
npm run zh-tw:import-classes
npm run zh-tw:build-class-locale
npm run zh-tw:test-class-body
npm run zh-tw:validate-classes
```

若要從已下載的 30 個來源檔重建，可執行：

```bash
python node/zh-tw/import-full-class-translations.py --source-dir /path/to/class
```

## 資料安全規則

- 英文 `name`、`source`、頁碼、UID、網址 hash 與標籤 lookup key 不翻譯。
- 繁中譯文只存於 sidecar／locale；runtime 以 canonical 身分配對，不改原始英文實體。
- 數值、骰式、DC、距離、持續時間、動作類型及例外條件必須保留。
- 2014 與 2024 的同名條目分開維護。
- 驗證器必須保持 `canonicalFailures`、`nameBackupFailures`、`untranslatedProse` 與 `inlineTagCanonicalFailures` 全部為空。

## 看起來仍是英文、但必須保留的內容

- 5etools 標籤內的英文 canonical lookup key、UID、來源縮寫與網址 hash。
- 中文名稱旁的英文備援名稱，用於既有連結、搜尋與除錯。
- D&D、DC、AC、CR、d20、骰式及書籍來源縮寫等規則記號。
- 部分專名首次出現時的中英並列；這些不是未翻譯正文。

## 私人使用與來源

本工作區只供私人自用。未確認原社群譯文另有可再散布授權，因此不得把含非 SRD 書籍正文的內容發布至公開 Pages、Release、公開 fork 或其他公開下載位置。若未來改為公開發布，必須先逐項確認原文與譯文授權，或只保留可依法公開的 CC／SRD 內容。
