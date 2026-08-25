# 5eWT

5etools v2.33.3 的臺灣繁體中文私人翻譯覆蓋層。

## 目前進度

- 已鎖定上游：`5etools-mirror-3/5etools-src@v2.33.3`
- 已建立 CC／SRD 與介面翻譯盤點
- 已完成 Classes 資料盤點與第一批術語核准包
- Classes 正文會在術語核准後分批翻譯

## 使用方式

```bash
npm run bootstrap
npm run extract:classes
npm run validate:glossary
```

`bootstrap` 會把上游 v2.33.3 放到 `vendor/5etools-src`；上游檔案不納入本 repo。翻譯保留英文 canonical key，並以 sidecar／locale 覆蓋，避免破壞 5etools 的資料關聯。

本 repo 為私人自用工作區。未經另外授權的書籍譯文不得發布到公開 GitHub Pages、Release、公開 fork 或其他公開下載位置。
