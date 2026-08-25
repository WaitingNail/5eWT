# 5etools v2.33.3 繁中化來源與範圍盤點

## 結論

第一階段包含兩部分：

1. 5etools 網站介面、導覽、篩選器、按鈕、工具提示與系統訊息。
2. 官方 SRD 5.1 與 SRD 5.2.1 中可依 CC BY 4.0 使用的規則內容。

第一階段不包含其他 PHB、DMG、MM、擴充書籍或冒險模組中未由 SRD 釋出的正文、圖片與地圖。5etools 的 `srd`／`srd52` 旗標用於找出候選條目，但旗標本身不取代官方 SRD 的授權與正文校對。

## 私有覆蓋層

`WaitingNail/5eWT` 已改為 private，可作為使用者自用翻譯的覆蓋層。Class 等非 SRD 書籍內容若納入此層，仍須遵守以下界線：

- 不建立公開 GitHub Pages、公開 Release、公開 fork 或可供不特定人下載的 ZIP。
- 公開版與私人版輸出分開建置；公開版只包含介面與可依授權使用的 CC／SRD 內容。
- 英文 canonical key、來源代碼與頁碼維持原樣，私人譯文使用 sidecar 或 locale 檔保存。
- 本專案的 private 狀態不視為著作權授權；若日後改為 public，發布前須重新做授權範圍掃描。

## 上游版本

- Repository：`5etools-mirror-3/5etools-src`
- Release：`v2.33.3`
- Commit：`e5f3e77b303a92df10487207857200245e71957c`
- Release 日期：2026-08-03
- 上游程式碼授權：MIT

## CC／SRD 來源

| 文件 | 頁數 | 授權 | 官方來源 |
| --- | ---: | --- | --- |
| System Reference Document 5.1 | 403 | CC BY 4.0 | https://www.dndbeyond.com/srd |
| System Reference Document 5.2.1 | 364 | CC BY 4.0 | https://www.dndbeyond.com/srd |

網站發行包必須分別標示 5etools 程式碼與 SRD 規則內容的授權。繁中翻譯屬於對 SRD 的改作，署名需包含作品名稱、Wizards of the Coast LLC、官方來源、CC BY 4.0 連結，以及已進行繁中翻譯與介面改作的說明。

## 自動盤點結果

盤點排除 `data/generated` 與 Foundry 專用衍生檔，以避免將建置產物重複計數。

| 指標 | 結果 |
| --- | ---: |
| 掃描 JSON 檔案 | 482 |
| JSON 解析錯誤 | 0 |
| 明確帶有 `srd` 或 `srd52` 的條目出現次數 | 4,111 |
| SRD 5.1 條目出現次數 | 2,080 |
| SRD 5.2 條目出現次數 | 2,031 |
| 不重複英文名稱 | 2,085 |
| 估計需翻譯字串 | 26,201 |

完整明細位於：

- `translation/zh-TW/generated/srd-manifest.json`
- `translation/zh-TW/generated/srd-entity-index.csv`
- `translation/zh-TW/generated/srd-entity-terms.csv`

上述數字是 5etools 資料樹中的出現次數，可能包含同一規則在類別、職業特性或交叉索引中的重複資料。批量翻譯前應以 canonical key 去重，並以官方 SRD 的章節與條目名稱建立一對一來源記錄。

## 翻譯來源優先順序

1. 使用者核准並鎖定的本專案術語。
2. 可查證的 5eclone 既有繁中譯名。
3. 官方繁體中文譯名。
4. Foundry VTT D&D 5e 正體中文化。
5. 其他已記錄來源的繁中社群慣用譯名。
6. 無法可靠判斷時保留英文並標記 `Need Review`。

目前環境無法直接讀取 5eclone 網站資料，因此已先將可查證的既有 zh-TW 資料列為候選來源，不把候選譯名直接視為核准結果。

## 技術實作方向

- 介面採 locale key，不直接以全頁 DOM 字串取代作最終架構。
- 規則資料採 sidecar 翻譯檔，英文 canonical name、source 與資料關聯鍵維持不變。
- 列表同時支援繁中名稱與英文名稱搜尋。
- 2014 與 2024 的同名規則分開建 key；機制不同時不得共用正文。
- 缺少翻譯時回退英文，開發模式列出缺漏 key。
- 批量翻譯只接受 `srd`／`srd52` manifest 內且能回溯至官方 SRD 的項目。

## 第一批 QA 閘門

- 術語 CSV 欄位、重複英文 key、狀態值與疑似簡體字檢查。
- 所有來源 JSON 維持可解析。
- 5etools 標籤、數值、骰式、DC、距離、持續時間與來源縮寫不變。
- 首頁、法術、怪物、職業、物品與規則術語彙編頁進行視覺回歸測試。
- 最終發行包包含 MIT 與 CC BY 4.0 的獨立授權說明。
