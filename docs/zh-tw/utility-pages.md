# 獨立資料與工具頁翻譯（第 1–10 項）

本批不匯入或更動完整規則書。生成表格雖摘自規則書與冒險書，僅處理 `tables.html` 的獨立表格資料。

| 頁面 | 本批範圍 |
| --- | --- |
| trapshazards.html | 37 個陷阱、73 個危害，含觸發、效果、應對、先攻與持續時間 |
| objects.html | 37 個物件，含特殊生命值及動作 |
| decks.html | 35 份牌組、765 張牌，含抽牌介面與牌面文字資料 |
| tables.html | 2,339 張獨立表格、22 組表格 |
| lifegen.html | 12 個職業、13 個背景、100 項小物及隨機人生事件介面 |
| encountergen.html | 42 組遭遇，共 93 個子表 |
| lootgen.html | 個別／寶藏／龍藏／寶石／藝術品／魔法物品資料與工具介面 |
| names.html | 10 類、61 個姓名表及含義 |
| crcalculator.html | 25 個怪物特徵及計算介面 |
| statgen.html | 擲骰、標準陣列、購點、自訂、升級及選擇介面 |

## 資料來源與準則

- 英文結構：`5etools-mirror-3/5etools-src` v2.33.3，commit `e5f3e77b303a92df10487207857200245e71957c`。
- 中文底稿：`tjliqy/5etools-cn`，commit `46b15d04f548c23c526084deae078e3568500349`。沿用專案的 CC BY-NC-SA 4.0 標示及既有術語表，以 OpenCC s2twp 正規化後修訂。
- `translation/zh-TW/utility-pages/overrides.json` 保存精確路徑修訂。匯入器另記錄受限定的結構與來源抄錄修正；不以中文數字反推原始規則。
- 姓名產生器保留原名拼寫，翻譯分類、名字含義、美德名及介面。作品出處縮寫、骰式、數值及姓名構字片段亦可保留。圖片內嵌文字未重新繪製。
- 保留 canonical `name/source/id`、UID、牌組／花色識別、擲骰範圍與機械數值；顯示用名稱另存 `_displayName` 等欄位。
- 主標題及命名的小標題採中英對照，敘述翻成繁中。原始檔案雜湊與比對結果記於生成報告；「原樣保留字串」不等於未翻譯正文，不據此宣稱整站毫無英文。

## 執行與重建

`npm run apply` 會套用 `0016-zh-tw-utility-pages-runtime.patch`，重建工具訊息表，套用既有頁面漏譯修訂，並注入兩份工具翻譯腳本。

實際 `DataUtil.loadJSON` 接上限定檔案的翻譯層，涵蓋物件、牌組、表格的專用載入器及工具頁；不依賴畫面顯示後再搜尋替換文字。

重新匯入需先取得上述固定版本中文底稿：

```sh
python node/zh-tw/import-utility-pages.py --source-dir /path/to/pinned-cn-source
npm run apply
npm run verify
```

完整回歸包含 `test-utility-pages-i18n.mjs`：真實載入器與渲染器、所有人生事件表分支、原始識別／規則數值保留，以及本輪補齊的物件、神話遭遇、工藝與先決條件文字。瀏覽器端操作另外以部署後公開站點驗證。

戰役整合：本批以 `codex/campaign-translations` 的 `20830e7aeb5a16ee1eb634b03cb5ab5849329d2e` 為基底，包含 `veor` 及 `vnotee` 兩本 Vecna 冒險及其既有驗證，不覆蓋分支內容。
