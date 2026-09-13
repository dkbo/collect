# 決策紀錄（跨任務，一行一則，只寫會影響未來的）
- 2026-09-12 dkbo 由 0.3.0（未 commit）升到 0.5.1，並把 `settings.env` 的新鍵 `DK_REVIEW_TIER` 設為 `L` —— 審查是全隊最吃推理的位置卻與 dev 同預設 M，reviewer 唯讀單輪、加碼邊際成本遠低於一個 dev pane。原本先改 `roles/reviewer.md` 的 M 檔達成，已還原：上游 0.4.0 為同一提案加了這把鑰匙，並指出改角色檔會讓 `dk-review --tier M|L` 變成靜默 no-op、也讓 tier 在不同角色不同義。若錯：每波審查成本上升，不影響 dev 端與工期。
- 2026-09-13 `DK_REVIEW_MIN` 由 1 改為 2 —— 派了 `claude codex agy` 三個 kind 卻只要一位回覆就能裁定，領導每次都合法地靜默放行，多模型審查的實際生效率是 0（上游 0.4.0：密度先於天花板）。若錯：codex／agy 逾時或額度用完的波要走補位或熔斷流程，收尾變慢；全部熔斷時仍可 `review N skipped` 放行並在 report.md 遺留段標記。
