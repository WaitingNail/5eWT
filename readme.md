# 5eWT — Class 臺灣繁中覆蓋層

這是固定對應 `5etools-mirror-3/5etools-src@v2.33.3` 的私人、自用繁中覆蓋層。

## 已完成

- 2014 與 2024 的 Class 資料及說明文字。
- 奇械師、秘術師與協力者等非核心職業資料。
- Class 頁面專用介面、側欄、表格、篩選、來源與再版提示。
- 30 個職業、322 個子職業、677 個職業特性、1,441 個子職業特性。
- 9,228 組可見字串檢查；未翻譯正文、canonical 錯誤、inline tag 錯誤及未解決數值差異皆為 0。

## 一鍵套用

需要 Node.js 24、Git 與 Python 3。

```bash
npm run setup
```

此命令會：

1. 將固定版本的上游 clone 到 `vendor/5etools-src`。
2. 複製預建的 zh-TW sidecar、翻譯工具與 QA 資料。
3. 套用 Class runtime patch。
4. 執行語法、runtime、canonical、inline tag 與數值檢查。

之後可用：

```bash
npm run serve
```

若尚未安裝上游 Node 相依套件，請先執行 `npm --prefix vendor/5etools-src install`。也可直接用任何靜態 HTTP server 開啟 `vendor/5etools-src`。

## 重新匯入譯文

預建 sidecar 不需要 Python 套件即可使用。只有重新匯入外部初稿時才需要：

```bash
python -m pip install -r requirements-zh-tw.txt
npm run import:classes
npm run build:class-locale
npm run verify
```

詳細來源、人工校訂與剩餘刻意保留的英文，見 `translation/zh-TW/classes/README.md` 與 `translation/zh-TW/classes/final-qa-report.md`。

## 私人使用限制

初稿參考來源未找到清楚的再利用授權聲明；含非 SRD 書籍內容的譯文只應留在私人 repository 自用。請勿發布至公開 GitHub Pages、Release、公開 fork 或其他公開下載位置。
