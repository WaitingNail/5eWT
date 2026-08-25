# Classes 繁中化工作區

本目錄保存 5etools v2.33.3「Classes／職業」頁面的臺灣繁體中文翻譯盤點、術語核准資料與後續 sidecar 譯文。

## 文件盤點

- 上游版本：`5etools-mirror-3/5etools-src` `v2.33.3`
- 結構資料：15 個 `class-*.json`
- 說明文字：15 個 `fluff-class-*.json`
- 職業記錄：30（包含 2014、2024、奇械師、秘術師與協力者職業）
- 子職業記錄：322
- 職業特性：677
- 子職業特性：1,441
- 職業／子職業說明文字：約 29,265 個英文詞
- JSON 解析錯誤：0

## 區塊分類

- `HEADING_LABEL`：職業頁介面、欄名、分類名稱。
- `RULE`：職業與子職業特性、施法、升級、資源與多職規則。
- `TABLE`：職業等級表、法術位、已知法術與資源進度。
- `SPELL_ITEM_MONSTER_ENTRY`：職業條目與交叉引用的法術、物品或選項。
- `NARRATIVE`：職業與子職業的背景說明文字。
- `MIXED`：同一特性中混合規則、表格與敘述的區塊。

## 術語結果

- `generated/class-terms.csv`：1,987 個按類別去重的術語。
- `generated/class-terms-need-review.csv`：衝突、缺譯或低信心術語。
- `generated/class-approval-shortlist.csv`：31 個第一批必須核准的職業名稱與衝突詞。
- `class-ui-glossary.csv`：Class 頁面共用介面與欄位譯名。
- `generated/class-term-manifest.json`：資料量、來源與解析結果。

現有譯名先以 5eclone 的 `ENG_name` 精確對應結果為候選；找不到時才使用專案核心術語或保留待譯。所有候選目前都不是鎖定譯名。

## 建議批次

1. Class 頁介面與共用欄位。
2. 2014 PHB／SRD 核心職業與其 SRD 子職業。
3. 2024 XPHB 核心職業。
4. TCE、XGE 等擴充來源職業與子職業。
5. UA、秘術師與協力者等非核心內容。
6. 職業與子職業說明文字（fluff）。

## 資料安全規則

- 英文 `name`、`source`、頁碼、UID 與 5etools 標籤保持不變。
- 繁中名稱以 sidecar 顯示欄位或 locale key 儲存，不直接破壞英文查找鍵。
- 數值、骰式、DC、距離、持續時間、動作類型與例外條件不得改動。
- 2014 與 2024 的同名條目分開維護；只有規則與原文相同時才共用譯文。
- 私有書籍譯文不得發布至公開 Pages、Release 或公開 fork。

## 術語閘門

開始批量翻譯正文前，需先核准 `generated/class-approval-shortlist.csv`。建議優先確認：

- `Rogue`：5eclone 候選「遊蕩者」；替代「盜賊」。
- `Warlock`：5eclone 候選「契術師」；替代「邪術師」。
- `Mystic`：尚無 5eclone 精確對應，建議「秘術師」，待核准。
- `Bladesinging`、`Improved Critical`、`Psionic Power`、`Psychic Blades` 等一詞多譯項目。

核准後，將選定譯名寫入鎖定翻譯記憶，再開始正文翻譯與規則 QA。
