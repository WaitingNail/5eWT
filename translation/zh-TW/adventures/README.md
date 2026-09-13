# 戰役翻譯工作分支

戰役／冒險翻譯使用 `codex/campaign-translations` 分支，以及獨立的 `5eWT-campaigns` worktree。此分支從主分支 `0522bcd1c712cecd4a79fa4a7b7f180bb8a97df9` 建立，包含 CoS、HotDQ、RoT，以及載具、配方、居家工藝和圖片來源的既有修正。

本次新增《深水城：龍金劫》（Waterdeep: Dragon Heist，WDH）。譯文、術語、來源保護的校訂及檢查資料都隨本分支提交。網站目前的部署工作流程只由 `main` 的推送或手動執行觸發。

同時工作的任務應各自使用分支與 worktree。合併戰役翻譯時，以 Git 合併最新主分支，檢查共同修改的檔案並重新驗證；不要用整個舊資料夾覆蓋另一個工作的成果。常見共同檔案是 `package.json`、冒險閱讀器和全站驗證腳本。

各模組的可重建資料與來源記錄：

- `cos/`：CoS。
- `tyranny/`：HotDQ／RoT。
- `wdh/`：WDH。
