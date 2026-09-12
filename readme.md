# 5eWT — 5etools 臺灣繁中覆蓋層

這是固定對應 `5etools-mirror-3/5etools-src@v2.33.3` 的私人、自用繁中覆蓋層。

## 已完成範圍

- 全站共用介面與繁中 runtime：672 筆訊息，56／56 個產生式 HTML 頁面接入。
- 2014、2024 與非核心 Class：30 個職業、322 個子職業、677 個職業特性、1,441 個子職業特性。
- 核心規則資料：48 個動作、64 個狀態／疾病／狀態詞、36 個技能、8 種感官及 243 條核心／變體規則。
- 2014 Quick Reference：5 章、46 個 canonical headers、395 個具名正文區塊。
- 法術：936 筆法術與 89 筆補充敘述，涵蓋 2014、2024 與此版本收錄的其他來源。
- 法術清單、篩選器、搜尋、表格欄位與法術卡均顯示繁中，並保留英文名稱供搜尋。
- 角色選項：160 種族、98 亞種、221 種族敘述、161 背景、160 背景敘述、276 專長、41 專長敘述、213 選用特性及 1 筆選用特性敘述。
- 種族／物種、背景、專長與選用特性的清單、篩選器、摘要欄位、卡片及正文均顯示繁中，並支援英文名稱搜尋。
- 清單、篩選、書籍檢視、來源視窗與 Quick Reference 均可顯示繁中；名稱與正文同時支援繁中／英文搜尋。
- 英文 `name`、source、UID、URL hash、篩選值與 inline tag lookup 保持 canonical。

- CoS《施特拉德的詛咒》：26個章節／附錄區塊、5,882個可顯示文字欄位、684個朗讀框；沿用既有全站譯名，支援中英標題／搜尋與原英文連結。詳見 `reports/zh-tw-cos-audit.md`。

## 一鍵套用

套用預建翻譯只需要 Node.js 24 與 Git；重新匯入外部初稿時才需要 Python 3。

```bash
npm run setup
```

此命令會：

1. 將固定版本的上游 clone 到 `vendor/5etools-src`。
2. 複製預建的 zh-TW sidecar、全站 locale、翻譯工具與 QA 資料。
3. 套用共用介面、Class、核心規則、Quick Reference、法術與角色選項 runtime patch。
4. 執行全站介面、Class、規則、Quick Reference、法術、角色選項、canonical、inline tag、骰式與數值檢查。

之後可用：

```bash
npm run serve
```

若尚未安裝上游 Node 相依套件，請先執行 `npm --prefix vendor/5etools-src install`。也可直接用任何靜態 HTTP server 開啟 `vendor/5etools-src`。

## 重新匯入譯文

預建 sidecar 不需要 Python 套件即可使用。只有重新匯入外部初稿時才需要：

```bash
python -m pip install -r requirements-zh-tw.txt
npm run import:classes
npm run build:class-locale
npm run import:rules
npm run build:site-locale
npm run verify
```

詳細來源、授權、人工校訂與刻意保留的英文，見：

- `translation/zh-TW/classes/README.md`
- `translation/zh-TW/classes/final-qa-report.md`
- `translation/zh-TW/rules/README.md`
- `translation/zh-TW/rules/SOURCE-ATTRIBUTION.md`
- `translation/zh-TW/spells/README.md`
- `translation/zh-TW/spells/SOURCE-ATTRIBUTION.md`
- `translation/zh-TW/character-options/README.md`
- `translation/zh-TW/character-options/SOURCE-ATTRIBUTION.md`

## 私人使用限制

Class 初稿參考來源未找到清楚的再利用授權聲明；規則、法術與角色選項初稿依 CC BY-NC-SA 4.0 使用並已附署名。內容包含非 SRD 書籍資料，只應留在私人 repository 自用。請勿發布至公開 GitHub Pages、公開 Release、公開 fork 或其他公開下載位置。私人 repository 本身不會擴張你對原作內容的授權。

本次發布確認：2026-09-12，使用者在確認現有倉庫與 GitHub Pages 為公開狀態後，明確指示發布 CoS 翻譯。本次部署依該指示執行，來源署名與權利資訊保留；詳見 `reports/zh-tw-cos-audit.md`。
