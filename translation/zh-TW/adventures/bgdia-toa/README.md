# BGDIA／ToA 繁中翻譯資料

2026-09-22 依使用者「BGDIA跟TOA先翻譯」建立兩本完整文字覆蓋層，承接 `2c9234a8722360dc6cf0b59e7c0e5d20f3d6e926`，工作分支為 `codex/campaign-translations`。

| 模組 | 暫定書名 | 頂層區塊 | 文字欄位 | 朗讀框 | 來源保護校訂 |
| --- | --- | ---: | ---: | ---: | ---: |
| BGDIA | 博德之門：墜入阿弗納斯 | 18 | 4,417 | 163 | 147 |
| ToA | 湮滅之墓 | 14 | 6,270 | 287 | 183 |

頂層區塊包含序文、章節、附錄、地圖與製作名單；不是冒險章節數。沿用使用者允許先翻譯、再依回饋修訂的流程。既有站內條目名稱優先；新增名稱及書名列為 `project-proposed`。艾爾托瑞爾、琴薩河、鐵手套教團沿用使用者已鎖定的譯名。

## 來源

- 英文：5etools v2.33.3，commit `e5f3e77b303a92df10487207857200245e71957c`。
- 中文基稿：`tjliqy/5etools-cn`，commit `46b15d04f548c23c526084deae078e3568500349`。
- 先確認中文來源的英文備份與固定英文原檔逐位元組一致，再進行 OpenCC s2twp 轉換、站內術語對齊及語境校訂。
- 每本輸出記錄英文、中文基稿的 SHA-256。保留原作者與社群署名；翻譯層沿用來源標示的 CC BY-NC-SA 4.0。

## 可重建資料

- `terminology.json`：1,866 個標題／名稱。`heading-only` 不作為正文全域替換。
- `contextual-terminology.json`：283 組只在對應英文來源出現時才套用的名稱規則。只改顯示文字，不改引用識別。
- `text-overrides.json`：330 個精確來源與位置綁定的校訂，附理由；來源改變即拒絕套用。
- `preserved-literals.json`：35 個保留英文原句、口令、字謎、發音提示或網址的欄位；測試僅豁免列明字串，欄位其餘英文仍會檢查。
- `reviewed-numeric-equivalences.json`：21 個已核對的文字數字、月份、分數或正負號等值差異，綁定兩端字串 SHA-256。
- `chapter-labels.csv`、`site-terminology.csv`、`terminology-extraction.csv`：章節標籤、既有術語來源與首次出現位置。
- `block-classification.csv`：10,687 個原文／譯文欄位與啟發式內容分類；分類信心不是品質分數。
- `*-import-review.json`、`coverage-summary.json`：結構、引用、數值與覆蓋結果。

ToA 人名表的48個發音欄原樣保留。16C的謎詩附上原文，讓16D字母格能解出 `cover eyes`；鏡子的 `Khomara`／`Blackfire` 口令前後一致。BGDIA 的 `Warlock|...|Fiend` 子職業參數與 ToA 的 `skillCheck survival 1` 擲骰識別另行保護。

## 重建與驗證

準備固定來源的 `data/adventures.json`，及兩本對應的 `data/adventure/adventure-*.json`、`data-bak/adventure/adventure-*.json`，並安裝 `requirements-zh-tw.txt`：

```sh
python node/zh-tw/import-adventure-bgdia-toa.py --source-dir /path/to/pinned-source
python node/zh-tw/audit-adventure-bgdia-toa.py
npm run apply
npm run test:bgdia-toa
npm run verify
```

驗證範圍、主要校訂及限制見 `reports/zh-tw-bgdia-toa-audit.md`。這次完成完整基稿整合及疑點校訂；不是出版等級的全書逐句人工審校。圖片內嵌文字未重繪。本次翻譯分支提交不代表正式站部署。

## 2026-09-25 使用者核准的名稱修訂

Omu → 奧姆；Liara Portyr → 莉亞菈・波特爾；Portyr → 波特爾；Duke Thalamra Vanthampur → 薩納姆娜·范薩普爾公爵；Vanthampur → 范薩普爾。

涵蓋冒險正文、目錄、角色卡、背景敘述及衍生表格，共 360 個文字欄位。`../../approved-project-names.json` 保存核准拼寫，`../../approved-project-name-validation.json` 記錄相對於 e80830c 的逐欄比較：所有變更均為核准名稱，資料結構與其他純量值一致。重新產生分類／術語清單及匯入報告，7 筆因名字而改變的數值等值校驗碼在確認原文不變、譯文只有核准名稱替換後更新。
