# Class 繁中化最終 QA

## 驗證摘要

- 上游：5etools v2.33.3
- 職業 30、子職業 322
- 職業特性 677、子職業特性 1,441
- 職業 fluff 30、子職業 fluff 156
- 可見字串配對檢查：9,228
- 人工 guarded corrections：311
- 未翻譯正文：0
- canonical identity 變更：0
- canonical 欄位失敗：0
- inline tag canonical 失敗：0

## 已逐筆複核的警告

### Mixed ASCII：52

這些不是未翻譯正文：

- 22 筆 Bard 故事表／2024 Tales 的中文名稱加英文標籤。
- 18 筆修正後仍刻意在括號保留英文拼寫的神名、地名、派系名或設定詞。
- 11 筆其他已妥善括號化的專名、設定名或職能名稱。
- 1 筆 Xarren 英文署名。

### 可見數字：260

267 筆原始警告已逐筆人工核對並修正 5 個實質問題；重建後的 260 筆均為格式差異或偵測誤報，例如英文數字詞改為阿拉伯／中文數字、環階寫法、標籤顯示文字、範圍連字號或為清楚起見重複距離。

### 來源結構差異

- 1 個陣列長度差異：Hollow Warden 的社群譯文多出一項；匯入器忽略多出的來源項目，英文 v2.33.3 的四項結構完整保留。
- 130 個來源 tag shape 差異：皆在來源譯文與 v2.33.3 標籤形狀比較階段記錄；輸出經 semantic tag reconstruction 後，canonical 與 inline tag 驗證失敗數均為 0。
- 匯入器列出的 103 個「未翻譯可見字串」都是骰式或 filter tag 等不可翻譯記號，不是英文正文。

## 尚未納入此 Class 批次

Class 專屬頁面、側欄、篩選欄位、正文與 fluff 已完成；全站共用的篩選框架仍有英文控制文字，例如 Filter、Reset、Save、Cancel、Show All、Select by Date、Confirm 與 Clear。它們位於共用的 `filter-box.js`／SourceFilter，而不是 Class 專屬資料，留待全站 UI 批次處理。

英文 canonical lookup key、UID、來源縮寫、網址 hash、D&D／DC／AC／CR／d20／骰式及英文備援名稱必須保留，以維持連結、搜尋與資料相容。
