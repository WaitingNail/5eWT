# 非核心 Class 規則翻譯稽核

範圍：`class-artificer.json`、`class-mystic.json`、`class-sidekick.json`（上游 `v2.33.3`）。逐條對照英文規則與繁中 sidecar，優先檢查等級、距離、次數、上限／下限、否定條件、術語混淆、標籤對調及明顯機翻垃圾。

## Guarded corrections

| 檔案 | Corrections | 主要修正 |
|---|---:|---|
| Artificer | 33 | 25 尺誤作 30 尺、5級誤作6級、法術位最低環階、炮臺狀態免疫、鋼鐵守衛復活距離、`flask` 混雜字、法術／速度標籤對調、物品名稱與子職術語一致性 |
| Mystic | 22 | `discipline` 與 `talent` 混譯、生命值支付規則、法術位誤作施法能力、法術位環階誤作角色等級 |
| Sidekick | 9 | 防禦者5尺條件錯置、自選法術遺漏、額外攻擊的6／15級顯示矛盾、20級使用次數 |
| **合計** | **64** | 全部採 `expected` + `value` 防呆格式 |

Corrections 位於 `translation/zh-TW/classes/manual-corrections/`。已以目前未修正 sidecar 驗證 64 個 `expected` guard 全數吻合，且三個檔案均無重複 JSON Pointer。

## 另由 importer 統一處理

Artificer 的魔法物品方案表仍有 30 個可見 `No` 與 3 個不自然的 `Varies → 多類`。這類精確、可泛用的短字串改由 importer 統一映射為 `否` 與 `視物品而定`，不重複建立逐格 corrections。

依主線協作要求，本次未執行 importer；待主線完成全域術語與標籤重建後，再由整合流程套用並執行完整驗證。
