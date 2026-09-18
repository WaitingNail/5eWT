# 戰役翻譯工作分支

戰役／冒險翻譯使用 `codex/campaign-translations` 分支，以及獨立的 `5eWT-campaigns` worktree。此分支從主分支 `0522bcd1c712cecd4a79fa4a7b7f180bb8a97df9` 建立，包含 CoS、HotDQ、RoT，以及載具、配方、居家工藝和圖片來源的既有修正。

《深水城：龍金劫》（WDH）、《維克那：妖眼魔窟》與《維克那：毀滅前夕》已由其他工作合併至主分支。本次接續整合《逃離深淵》（Out of the Abyss，OotA），以已核對的主分支 `e0cb9d2096143a5c640914d0132bbf3b2ffdcdd7` 為基底，保留其他工作的工具頁翻譯、神話遭遇、編織說明、註腳及先決條件修正。譯文、術語、來源保護的校訂及檢查資料都隨戰役分支提交；本次不更新 `main`，也不手動觸發部署。

同時工作的任務應各自使用分支與 worktree。合併戰役翻譯時，以 Git 合併最新主分支，檢查共同修改的檔案並重新驗證；不要用整個舊資料夾覆蓋另一個工作的成果。常見共同檔案是 `package.json`、冒險閱讀器和全站驗證腳本。

各模組的可重建資料與來源記錄：

- `cos/`：CoS。
- `tyranny/`：HotDQ／RoT。
- `wdh/`：WDH。
- `vecna/`：VNotEE／VEoR。
- `oota/`：Out of the Abyss。
