# WDH 翻譯資料

《深水城：龍金劫》（Waterdeep: Dragon Heist）的繁中覆蓋層。沿用使用者既定的工作方式：優先使用全站既有名稱；沒有對照的名稱採用明確標示的專案暫定譯名，之後可依回饋統一修訂。

- `terminology.json`：人物、地點、派系、規則名稱及變體。`heading-only` 表示不可將該標題當成正文中的通用替換詞。
- `terminology-extraction.csv`：術語出現次數、首次頁碼、來源上下文、譯名狀態與變體。
- `site-terminology.csv`：此次採用的全站名稱與來源檔案。
- `chapter-labels.csv`：具名標題與英文識別名稱。
- `block-classification.csv`：逐文字欄位的內容類型、來源頁碼與分類信心值。此信心值不是翻譯品質分數。
- `text-overrides.json`：含原文保護的逐段校訂。原文變動時停止重新匯入，避免套用到錯誤段落。
- `site-name-corrections.json`：Nat、Kaevja Cynavern 與 Rishaal 的修正；重新匯入 WDH 時同步套用於相應怪物及補充敘述名稱。
- `reviewed-numeric-equivalences.json`：人工核對的數字寫法差異，包含原文及譯文雜湊。
- `wdh-import-review.json`、`coverage-summary.json`：匯入與覆蓋檢查結果。

完整範圍、來源署名、主要修正、保留內容及驗證方式見 `reports/zh-tw-wdh-audit.md`。
