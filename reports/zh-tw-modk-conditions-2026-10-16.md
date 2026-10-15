# MoDK 狀態漏譯修正

## 查核結果

MoDK（Monsters of Drakkenheim）共 21 個狀態，先前均未提供中文顯示覆蓋。先前的 64 筆狀態／疾病／其他狀態檢查僅涵蓋固定版本的內建資料，未包含使用者另行匯入的合作來源。

狀態頁原本在合併匯入內容前翻譯內建資料；浮動說明載入器的匯入內容也未經規則翻譯。此次改在合併後處理，並為浮動說明補上同一套翻譯。只在已匯入 `MonstersOfDrakkenheim` 狀態時載入額外譯文，不自動加入該書或其餘內容。

## 原文依據

- Repository: `TheGiddyLimit/homebrew`
- Commit: `85bf7ed179a5b3ab980ba18310286e72beb1d344`
- File: `collection/Ghostfire Gaming; Monsters of Drakkenheim.json`
- Blob: `76e81b99a6bb3068bff694cf623eca9c2698adb2`
- Canonical source ID: `MonstersOfDrakkenheim`；來源縮寫：`MoDk`
- 僅擷取及翻譯該檔案的 21 個 condition；保留來源、頁碼、英文名稱、引用目標與擲骰數據。

每筆譯文保留經審閱的英文原文。匯入資料若與該原文不同，保留其原有顯示，避免來源獨立改版後套用過時規則。

## 名稱與規則辨義

| English | 中文 |
| --- | --- |
| Addled | 神智混亂 |
| Bewildered | 迷亂 |
| Bleeding | 流血 |
| Burning | 灼燒 |
| Clumsy | 笨拙 |
| Contamination | 汙染 |
| Dazed | 恍惚 |
| Defenseless | 無防備 |
| Distracted | 分心 |
| Drakkenheim Madness | 德拉肯海姆瘋狂 |
| Enfeebled | 衰弱 |
| Frozen | 凍結 |
| Helpless | 無助 |
| Immobilized | 定身 |
| Jinxed | 厄運 |
| Shocked | 震擊 |
| Sickened | 病弱 |
| Slowed | 緩速 |
| Staggered | 踉蹌 |
| Valor | 英勇 |
| Weakened | 虛弱 |

- Dazed：回合中移動或執行一個動作擇一，不能執行附贈動作；原文未禁止反應。
- Defenseless：以你為目標的攻擊檢定具有優勢；Helpless 才是命中即重擊。
- Enfeebled：力量相關攻擊、屬性與豁免檢定劣勢；Weakened：武器攻擊及法術傷害減半。
- Bleeding：回合結束失去生命值，未改寫成受到傷害。
- Frozen：鈍擊武器攻擊時才視為 Helpless；保留破冰檢定與 20 點鈍擊或火焰傷害的解除條件。
- Burning 同時涵蓋火焰與酸液；Shocked 不額外添加閃電傷害。
- Staggered 限制的是自己回合中的武器攻擊次數。
- 汙染等級、症狀表、突變、長休、移除、死亡與怪物化規則，以及瘋狂特質十筆均已翻譯。

狀態頁保留中英並列與原來源。來源限定的狀態免疫標籤沿用同一份詞彙；其他來源的同名條目不套用 MoDK 名稱。

## 驗證

`test-imported-conditions-i18n.mjs` 執行正式狀態頁、繼承的 ListPage 合併流程、BrewUtil 合併方法及浮動說明的正式匯入載入器；只替換網路與儲存資料輸入。

- 已匯入 MoDK 時 64 + 21 = 85 筆，21 筆中文名稱及內文均生效。
- 未匯入時仍維持內建 64 筆，不自動匯入內容。
- 英文與中文可用於名稱搜尋，英文 ID、來源、頁碼、引用目標、骰式與表格結構不變。
- 原文變動時不套用過時譯文，其他來源的同名條目不變，重複套用結果一致。
- 浮動說明可載入並渲染全部 21 筆譯文。
- 針對上述易混淆規則加入語意回歸檢查。
- 0020 至 0025 六份補丁可按順序套用於乾淨的固定上游版本。
- `npm run verify` 全站回歸檢查通過。

此為 MoDK 狀態範圍的完整修正，並非對所有第三方匯入書籍的翻譯完整性保證。
