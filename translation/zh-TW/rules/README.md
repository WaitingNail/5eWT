# 核心規則與 Quick Reference 臺灣繁中翻譯

本目錄記錄 5etools v2.33.3 核心規則 sidecar 的來源、匯入方式與 QA。實際輸出位於 `data/zh-TW/rules/`，不會改寫上游英文資料。

## 完成範圍

- 動作：48 筆。
- 狀態、疾病與 2024 狀態詞：30＋29＋5，共 64 筆。
- 狀態說明圖文：13 筆。
- 技能：36 筆。
- 感官：8 筆。
- 變體／核心規則：230 筆；另有 13 筆 generated 規則資料。
- Quick Reference：401 個具名物件，其中 395 個以 `ENG_name` 對應，reference root 與五個章節標題依位置對應。

2014 `PHB` 與 2024 `XPHB` 條目一律以來源分開配對，不共用正文。

## 安全匯入方式

`node/zh-tw/import-core-rules.py` 固定使用：

- 英文骨架：`5etools-mirror-3/5etools-src@v2.33.3`，commit `e5f3e77b303a92df10487207857200245e71957c`。
- 中文初稿：`tjliqy/5etools-cn@46b15d04f548c23c526084deae078e3568500349`。
- 簡繁轉換：OpenCC `s2twp`。
- 術語優先序：鎖定 Class 翻譯記憶、專案核准的第一候選術語、外部初稿。

匯入器先確認來源 repository 的 `data-bak/` 與本地 v2.33.3 英文檔逐位元相同，再依「陣列種類＋`ENG_name`＋`source`」配對。輸出從英文物件複製，只覆蓋 `name`、`entries`、表格文字等可見邊界；英文名稱另存於 `ENG_name`。`source`、`page`、UID、SRD flags、資料順序及 inline tag canonical lookup payload 保持英文原值。

Quick Reference 的中文來源曾調整章節順序，因此匯入器以 395 個具名物件的身份重建英文 canonical 順序；reference headers 也依英文順序輸出，而不是直接按中文陣列位置合併。

## 重新匯入

```bash
python -m pip install -r requirements-zh-tw.txt
python node/zh-tw/import-core-rules.py
```

離線重建可指定已下載、同時含 `data/` 與 `data-bak/` 的目錄：

```bash
python node/zh-tw/import-core-rules.py --source-dir /path/to/5etools-cn-pinned-tree
```

## QA 結果

完整機器可讀報告位於 `generated/core-rules-import-report.json`。目前結果：

- 八個英文 guard 全部逐位元相同。
- 預期條目數全部相符；Quick Reference 395／395 個具名資料區塊完成對應。
- unmatched entity、結構錯位及 canonical 欄位錯誤皆為 0。
- inline tag canonical 差異、骰式差異、未解決數值差異皆為 0。
- 124 筆數值表記差異均已判定為等值，例如中文數字、重複敘述、正負值寫法、分數／小數及區間格式。
- 47 筆刻意保留的英文只包含純骰式、數值表格儲存格與 `mph` 等規則單位；未解決可見英文為 0。

匯入器另以逐路徑 guard 修正初稿中的可驗證問題，例如賭博本金 `10 gp` 被誤寫為 `100 gp`、Quick Reference 被動感知基準值遺漏，以及少數 inline reference 被移除。

## 授權與使用限制

中文初稿及本專案對其所作的繁中改作依 CC BY-NC-SA 4.0 授權；完整署名見 [SOURCE-ATTRIBUTION.md](SOURCE-ATTRIBUTION.md)。其中包含未由 SRD 釋出的書籍內容，只應放在私人、自用 repository，不應公開部署、公開發布 Release 或提供公開下載。即使 repository 設為私人，仍須遵守非商業、署名與相同方式分享條款。
