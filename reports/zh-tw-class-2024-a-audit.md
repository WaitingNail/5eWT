# 2024 Class 繁中規則稽核（A 組）

## 範圍

- 英文基準：5etools-src v2.33.3 `data/class`。
- 稽核對象：Barbarian、Bard、Cleric、Druid、Fighter、Monk 中 `source == XPHB` 的職業表、職業特性、子職業與子職業特性。
- 2024 子職業：Berserker、Wild Heart、World Tree、Zealot；Dance、Glamour、Lore、Valor；Life、Light、Trickery、War；Land、Moon、Sea、Stars；Battle Master、Champion、Eldritch Knight、Psi Warrior；Mercy、Shadow、Elements、Open Hand。
- 稽核重點：可見數字、等級、使用次數、距離、骰值、表格、規則邊界、動作／速度等標籤，以及會改變玩法的語意。這不是文風重譯。

## 方法與結果

1. 依實體及 JSON path 將英文與繁中資料逐項配對。
2. 比對所有非字串 scalar 與表格結構；六個職業的 XPHB 結構化數值為 **0 筆不一致**。
3. 比對字串中的阿拉伯數字、骰式、距離與等級，並人工覆核以中文數字呈現的英文數詞。
4. 人工通讀 XPHB 規則段落及規則標籤，確認遺漏、倒置、邊界詞（例如 *up to*、*no more than*）及擅增內容。

本輪新增 **48 筆** guarded corrections；各 correction 均含 `path`、舊值 `expected`、新值 `value` 與 `reason`。同檔既有的 2014 corrections 均保留。

| 職業 | 本輪修正數 |
|---|---:|
| Barbarian | 7 |
| Bard | 5 |
| Cleric | 4 |
| Druid | 14 |
| Fighter | 8 |
| Monk | 10 |
| **合計** | **48** |

## 確定修正

### Barbarian（7）

- `/classFeature/39/entries/0`：修正疊字，並明確保留「所選攻擊不能具有劣勢」。
- `/classFeature/45/entries/1`：Persistent Rage 的結束條件由錯誤的「除非」改回「如果」。
- `/subclassFeature/82/entries/2/entries/0`、`/subclassFeature/82/entries/3/entries/0`、`/subclassFeature/84/entries/1/entries/0`：修正 Speed 與攀爬／游泳／飛行速度交叉引用標籤互換。
- `/subclassFeature/94/entries/0`：Zealous Presence 補回 *other creatures*，不能選擇自己。
- `/subclassFeature/95/entries/2/entries/0`：修正 Rage of the Gods 的 Speed／Fly Speed 標籤互換。

### Bard（5）

- `/classFeature/28/entries/0`：Bardic Inspiration 是「一枚 d6」，不是「數顆」。
- `/classFeature/28/entries/1/entries/2/name`：*At Higher Levels* 是角色高等級時，不是升環施法標題。
- `/classFeature/29/entries/1/entries/2/entries/0`：補回起始四道法術都必須是 1 環。
- `/subclassFeature/57/entries/0`：修正 Agile Strikes 的徒手打擊、附贈動作與反應標籤。
- `/subclassFeature/62/entries/0`：修正 Inspiring Movement 中盟友的反應與速度標籤。

### Cleric（4）

- `/classFeature/27/entries/0`：Thaumaturge 是選擇奧秘「或」宗教，不是兩者皆得。
- `/classFeature/39/entries/0`：Divine Intervention 移除原文沒有的「1 反應」，並恢復不能施展反應施法時間法術的限制。
- `/subclassFeature/203/entries/1`：Trickery Domain 的敘述移除原文沒有的劫富與偷竊內容。
- `/subclassFeature/212/entries/0`：修正 War Priest 的短休／長休恢復文字及標籤。

### Druid（14）

- `/classFeature/20/entries/0`：Magician 的最低加值恢復為 `+1`。
- `/classFeature/22/entries/1/entries/2/entries/0`：補回起始四道法術都必須是 1 環。
- `/classFeature/23/entries/0`：Warden 的中甲能力是 armor training，不是武器式「熟練」。
- `/classFeature/25/entries/1/entries/1/entries/1`：Wild Shape 恢復「已知形態數增加」及「自第 8 級起」兩項規則。
- `/classFeature/25/entries/1/entries/2/rows/0/3`、`/classFeature/25/entries/1/entries/2/rows/1/3`：表格中的 `No` 譯為「否」。
- `/classFeature/25/entries/1/entries/3/entries/1/items/1/entries/0`：Wild Shape 補回也會獲得該生物熟練項目的規則。
- `/subclassFeature/56/entries/1`：Natural Recovery 恢復可恢復法術位環階總和「不得超過」上限，而非必須恰好等於上限。
- `/subclassFeature/68/entries/1`、`/subclassFeature/69/entries/1/entries/0`：修正 Sea 子職業的 Speed／Swim Speed／Fly Speed 標籤。
- `/subclassFeature/72/entries/3/rows/4/1`：Star Map 的水晶描述移除擅增的投影功能，改回刻有星圖。
- `/subclassFeature/73/entries/1`：Starry Form 移除英文 v2.33.3 沒有的「死亡時結束」。
- `/subclassFeature/76/entries/0`、`/subclassFeature/78/entries/0`：修正「巨巨龍」及「巨巨龍座座」疊字。

### Fighter（8）

- `/classFeature/36/entries/0`：Tactical Master 恢復正確的 Push、Sap、Slow 武器精通鍵值。
- `/subclassFeature/105/entries/0`：Improved Critical 恢復「徒手打擊」，不再誤寫成「重擊」。
- `/subclassFeature/110/entries/1/entries/0`：Survivor 的 Defy Death 修正死亡豁免／優勢標籤及疊字。
- `/subclassFeature/112/entries/3/entries/0/entries/0`：Eldritch Knight 補回起始三道法術都必須是 1 環。
- `/subclassFeature/112/entries/3/entries/0/entries/1`：補回被整段遺漏的 7 級範例（五道法師法術，1、2 環）。
- `/subclassFeature/117/entries/0`：Improved War Magic 恢復「以兩次攻擊換施展一道 1 或 2 環法術」及正確動作時機。
- `/subclassFeature/122/entries/0`：Telekinetic Movement 恢復超微型物件可移至手中或從手中移走。
- `/subclassFeature/125/entries/0`：修正 malformed DC 標籤，保留 DC 公式與水平移動至多 10 尺。

### Monk（10）

- `/classFeature/34/entries/0`：修正 Bonus Unarmed Strike 的附贈動作／徒手打擊標籤。
- `/classFeature/41/entries/0`：Patient Defense 恢復替代用法語意，並修正撤離／閃避標籤。
- `/classFeature/48/entries/0`：Slow Fall 的觸發時點是「正在墜落」，不是即將承受傷害。
- `/classFeature/50/entries/0`：Stunning Strike 補回豁免成功後，下一次攻擊的優勢只持續至下一回合開始前。
- `/classFeature/55/entries/0`：Acrobatic Movement 補回「移動期間不會墜落」。
- `/subclassFeature/60/entries/1/entries/1/entries/0`：Elemental Strikes 是移動目標「至多 10 尺」，不是固定 10 尺。
- `/subclassFeature/61/entries/0`：修正「四象四象法門」疊字。
- `/subclassFeature/64/entries/0`：修正 Stride of the Elements 的 Speed／Fly Speed／Swim Speed 標籤。
- `/subclassFeature/65/entries/2/entries/0`：Destructive Stride 移除原文沒有的「數量不限」，恢復選定生物及每生物每回合一次的限制。
- `/subclassFeature/73/entries/2/entries/0`：Open Hand 的推離距離恢復為「至多 15 尺」。

## 仍需人工複核

- 本輪只納入實體本身 `source == XPHB` 的 2024 PHB 規則；掛在 XPHB 職業下、但來源為 FRHoF、RHW 等其他書籍的後續子職業不在此輪範圍。
- 專案全域仍可能有翻譯後顯示文字與 canonical tag 名稱不同的警告；本輪只修正會改變規則引用或顯示結果的確定錯誤，建議另做全 Class 標籤正規化 QA。
- 文風、術語偏好與標點未做全面統一；本輪優先確保規則、數字及條件不失真。
