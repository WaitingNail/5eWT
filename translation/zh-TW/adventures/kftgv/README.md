# 《金庫之鑰》繁體中文覆蓋層

2026-09-25 依使用者要求加入 Keys from the Golden Vault（KftGV）。沿用先整合翻譯、再接受術語修訂的既有授權；書名及新名稱列為 project-proposed，使用者指定名稱優先。

## 範圍與來源

- 13 篇劫案，另含導言和製作名單，共 15 個頂層區塊。
- 4,448 個可見文字欄位、302 個朗讀框、39 個地圖資料項目。
- 英文固定於 5etools v2.33.3 / `e5f3e77b303a92df10487207857200245e71957c`。
- 中文基稿為 tjliqy/5etools-cn / `46b15d04f548c23c526084deae078e3568500349`；英文備份與上述英文 JSON 逐位元組一致。
- 經 OpenCC s2twp、站內術語對齊、全文未譯字串掃描，以及規則和語境疑點校訂。保留來源作者署名和來源翻譯授權標示 CC BY-NC-SA 4.0。
- 本次是完整基稿整合與重點校訂，不宣稱出版等級的逐句人工審校；圖片內嵌英文未重繪。

## 可重建資料

- `terminology.json`：1277 個名稱與標題；`heading-only` 不作為一般正文替換。
- `contextual-terminology.json`：57 組依英文來源欄位觸發的顯示名稱規則。
- `text-overrides.json`：116 處綁定原文與路徑的校訂，來源變動即拒絕套用。
- `preserved-literals.json`：52 處口令、組織縮寫、真名及字母謎題；僅列明字串可豁免未譯檢查。
- `numeric-equivalence-review.json`：18 個中文數字、樓層和時間寫法的等值差異，綁定雙端 SHA-256。
- `contextual-review.json`：126 個語意候選欄位；包括 master／host 等多義詞的保留對照。
- `tag-order-review.json`：22 個基稿引用順序差異；最終引用識別和數值由獨立測試核對。
- CSV 及 coverage/import review 提供來源位置、術語出處、內容分類與覆蓋數量；分類信心不是品質分數。

OAK 三字母鎖與 Oak 畫像保留對應原文；魔法真名一律保留完整拼寫，包括一般字典可能誤翻的 Knob。口令 farrl'v hrak、quixotic、atka ignari 等保留，相關語言、意義及效果以中文說明。

## 重建

準備固定來源的 `data/adventures.json`、`data/adventure/adventure-kftgv.json`、`data-bak/adventure/adventure-kftgv.json`，並安裝 `requirements-zh-tw.txt`：

```sh
python node/zh-tw/import-adventure-kftgv.py --source-dir /path/to/pinned-source
python node/zh-tw/audit-adventure-kftgv.py
npm run apply
npm run test:kftgv
npm run verify
```

數值與語意審查檔為人工核對紀錄，來源或譯文改變時需重新審查，不能自動認可新差異。測試使用實際 Renderer 和 BookUtil，核對全部章節、原始引用、標題錨點、搜尋與載入回退。正式網站由 main 的 GitHub Pages 工作流程發布。
