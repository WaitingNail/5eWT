# 5eWT：完整 Class 臺灣繁體中文覆蓋層

這是 5etools v2.33.3 的私人 zh-TW overlay，已完成 Classes／職業範圍的 2014、2024 與非核心內容。

## 已完成

- 30 筆職業、322 筆子職業
- 677 筆職業特性、1,441 筆子職業特性
- 30 筆職業 fluff、156 筆子職業 fluff
- Class 頁面、側欄、表格、篩選欄位、來源／再版提示及動態文字
- Artificer、Mystic、三種 Sidekick
- 2,023 筆鎖定翻譯記憶與 311 筆人工 guarded corrections

英文 canonical name、來源、UID、標籤 lookup key 與網址 hash 均保持不變；繁中內容以 sidecar／locale 套用。

## 安裝

需要 Git 與 Node.js。

~~~bash
npm run bootstrap
npm run apply
npm run verify
~~~

接著可進入 vendor/5etools-src，依上游 5etools 的方式安裝依賴及啟動本機網站。

apply 可重複執行：它會重新複製完整 sidecar；runtime patch 已套用時不會再次套用。

## 重新匯入譯文

只有在要從翻譯來源重建 sidecar 時才需要 Python 與 OpenCC：

~~~bash
npm run setup:python
npm run import:classes
npm run build:class-locale
npm run verify
~~~

來源檔也可透過 import:classes 後加上 --source-dir /absolute/path 指定。人工 corrections 有 expected guard；來源或上游結構不同時會停止，不會靜默套錯位置。

## 驗證結果

- 可見字串配對：9,228
- 未翻譯正文：0
- canonical identity 變更：0
- canonical 欄位失敗：0
- inline tag canonical 失敗：0
- Class body／fluff runtime 測試：通過

Mixed ASCII 與數字格式警告均已逐筆人工複核。仍刻意保留的英文包括中英並列專名、Bard 故事表英文標籤、Xarren 署名、D&D／DC／AC／CR／d20、骰式、來源縮寫與英文 canonical 備援名稱。詳情見 translation/zh-TW/classes/final-class-qa.md。

全站共用篩選框架的 Filter、Reset、Save、Cancel、Show All、Select by Date、Confirm、Clear 等控制文字不屬於 Class 專屬檔案，留待全站 UI 批次處理。

## 私人使用與來源

譯文先參考 [蟀蟀的 DND 寶庫](https://shuaishuaidnd.cn/) 的社群譯文，再轉為臺灣繁體並進行規則校對。目前未確認該社群譯文另有可再散布授權，因此此 overlay 只供私人自用；不要發布到公開 Pages、Release、公開 fork 或其他公開下載位置。

上游固定為 5etools-src v2.33.3，commit e5f3e77b303a92df10487207857200245e71957c。
