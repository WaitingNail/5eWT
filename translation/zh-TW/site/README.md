# 5etools 共用介面繁體中文目錄

這個目錄是全站共用介面文字的唯一人工維護來源，涵蓋導覽、清單、篩選、搜尋、設定、預發佈／自製內容管理、書籍／冒險閱讀、擲骰、列印與匯出，以及常用頁面標題與描述。

## 檔案與產生流程

- `messages.json`：人工維護的來源；每筆訊息包含穩定鍵、英文回退文字與繁體中文翻譯。
- `data/zh-TW/site.json`：供 Node 產生器使用的建置產物。
- `js/zh-tw/site-i18n-data.js`：供瀏覽器以 classic script 同步載入的建置產物。
- `js/zh-tw/site-i18n.js`：瀏覽器 runtime。

從儲存庫根目錄執行：

```sh
node node/zh-tw/build-site-locale.mjs
node node/zh-tw/test-site-i18n.mjs
```

建置會拒絕空白翻譯、無效穩定鍵、缺失或多出的插值參數、未標記的 HTML、不安全的 HTML，以及同一英文別名對應到互相衝突的翻譯。

## 訊息格式

```json
"search.pagination": {
  "en": "Page {page}/{pages} ({count} results)",
  "zh-TW": "第 {page}/{pages} 頁（{count} 筆結果）"
}
```

穩定鍵是程式介面，不是顯示文字；一旦被呼叫端採用就不要任意更名。`en` 同時是英文回退及舊有英文 literal 的遷移別名。插值名稱必須逐字保留。

含受信任標記的訊息必須加上 `"isHtml": true`。建置器會確認英文與中文保留相同的標籤結構：

```json
"common.hotkey-hint": {
  "en": "Press <kbd>{key}</kbd>.",
  "zh-TW": "按下 <kbd>{key}</kbd>。",
  "isHtml": true
}
```

## Runtime API

```js
I18nZhTwSite.t("search.pagination", "Page {page}/{pages} ({count} results)", {
  page: 1,
  pages: 3,
  count: 42,
});

I18nZhTwSite.tEnglish("Search");
I18nZhTwSite.tHtml("common.hotkey-hint", "Press <kbd>{key}</kbd>.", {key: "F"});
I18nZhTwSite.tEnglishHtml("Preload All <small>(5GB+)</small>");
```

- `t(key, englishFallback?, params?)` 優先查穩定鍵；缺少翻譯時回退到呼叫端英文、目錄英文，最後才回傳鍵本身。
- `tEnglish(english, params?)` 支援逐步遷移既有英文 literal；查無別名時原樣回退英文。
- `tHtml` 與 `tEnglishHtml` 保留目錄內受信任的 HTML，但會逸出所有插值值。不要把未受信任的內容直接寫進翻譯字串。
- 開發環境會針對每個缺漏鍵記錄並警告一次；可用 `getMissingKeys()`、`clearMissingKeys()` 與 `configure({isDev, logger})` 檢查或調整。

## 不可翻譯的 canonical 值

介面翻譯只能改顯示層。下列值必須維持上游原文或識別碼：URL/hash、來源代碼、UID、`data-sort`/`sortIdent`、篩選器的持久化 header/item 值、導覽樹 key、檔名與 JSON 欄位名稱。篩選器應翻譯 `headerDisplayName` 或渲染結果，而不是改動儲存及分享連結使用的 canonical 值。
