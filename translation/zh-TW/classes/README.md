# Classes 臺灣繁中翻譯工作區

本目錄保存 5etools v2.33.3「Classes／職業」頁面的臺灣繁體中文翻譯、鎖定術語、人工校訂與 QA 報告。

## 完成範圍

- 2014 規則職業、子職業、職業特性、子職業特性與說明文字。
- 2024 規則職業、子職業、職業特性、子職業特性與說明文字。
- 奇械師、秘術師與三種協力者職業等非核心 Class 資料。
- Class 頁面專用介面、側欄、表頭、篩選控制、提示、來源與再版說明。
- 共 30 個原始 Class／fluff 資料檔，輸出為 30 個安全 sidecar 檔及索引。

資料量：

- 職業：30
- 子職業：322
- 職業特性：677
- 子職業特性：1,441
- 職業說明：30
- 子職業說明：156

## 翻譯來源與版本

- 上游：`5etools-mirror-3/5etools-src@v2.33.3`
- 上游 commit：`e5f3e77b303a92df10487207857200245e71957c`
- 初稿參考：`https://shuaishuaidnd.cn/data/class`
- 簡繁與臺灣用字初轉：OpenCC `s2twp`
- 術語：本專案鎖定翻譯記憶與人工校訂優先於外部初稿。

初稿來源網站未找到清楚的再利用授權聲明；含非 SRD 書籍內容的譯文只應存放於私人、自用 repository，不應發布至公開 Pages、Release、公開 fork 或其他公開下載位置。

## 安全架構

- 英文 `name`、`source`、頁碼、UID、網址 hash 與資料關聯鍵保持不變。
- 中文名稱與正文存放於 `data/zh-TW/class/` sidecar；`ENG_name`／`ENG_shortName` 保留英文查找備份。
- 5etools inline tag 的英文 lookup key 與來源參數保持不變，只翻譯可見文字。
- 2014 與 2024 同名條目依來源與等級分開對應，不混用規則正文。
- Runtime 載入 sidecar 後再覆蓋顯示資料，不直接破壞上游英文資料。

## 建置與驗證

```bash
python -m pip install -r requirements-zh-tw.txt
npm run zh-tw:import-classes
npm run zh-tw:build-class-locale
npm run zh-tw:test-class-body
npm run zh-tw:validate-classes
```

離線或要固定初稿版本時，可指定已下載的來源目錄：

```bash
python node/zh-tw/import-full-class-translations.py --source-dir /path/to/class-data
```

更新匯入清理規則後，若人工校訂的 `expected` guard 需要刷新：

```bash
python node/zh-tw/import-full-class-translations.py --source-dir /path/to/class-data --skip-corrections
python node/zh-tw/refresh-class-correction-guards.py
python node/zh-tw/import-full-class-translations.py --source-dir /path/to/class-data
```

## 最終 QA

`generated/full-class-validation-report.json` 的目前結果：

- 可見字串配對檢查：9,228
- 未翻譯正文：0
- canonical 欄位錯誤：0
- inline tag canonical 錯誤：0
- 未解決數值差異：0
- 人工校訂：227
- 中英混合提醒：1（插畫署名中的作者名 `Xarren`，刻意保留）

報告另保留 256 筆原始數字字面差異供稽核；它們已經正規化並確認為中文數字、英文拼寫數字、千分位、全形正號、範圍符號或上下文重述等表記差異，不是未解決的規則數值錯誤。

## 刻意保留的英文

- canonical lookup key、UID、來源縮寫與 5etools tag 參數。
- `ENG_name`／`ENG_shortName` 英文備份，供搜尋與資料關聯使用。
- 骰式、DC、AC、PB、GP、SRD 等規則縮寫。
- 作者、插畫家等署名；目前唯一觸發混合文字提醒的是 `Xarren`。

這些項目不會作為畫面正文漏譯計入。
