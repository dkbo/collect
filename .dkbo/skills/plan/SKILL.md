---
name: dkbo-plan
description: 只在使用者明確要求啟動 dkbo 團隊流程（或明確指名本篇）時使用。dkbo 計畫階段。開新任務、寫 brief（目標、驗收標準、檔案所有權、波次表）、過 dk-brief-check 機械閘後派 AI 審計畫，走到關卡①給人確認後停。不派工、不跑波。
---
# dkbo 計畫

先讀 `.dkbo/LEADER.md`，再照本篇。

## 開任務
1. `dk-task-new <short> "<顯示名>" [--from <檔>]`。它**只建任務資料夾**：不切 worktree、不開 tab（`.task.env` 的 `DK_WORKTREE`／`DK_BASE`／`DK_TASK_TAB` 是空的，brief 標頭寫「交棒時建立」），那些延到 `/dkbo-run` 的 `dk-leader <short> --run` 才做 —— 計畫完可能不做，不先付成本。計畫階段你就是領導，reviewer 填在你的 workspace 右側。
2. 寫 `request.md`：把人講的原話**逐字**抄進去，不摘要、不改寫。有外部文件就把相關段落整段貼進來（連結會死）。`--from` 指到真的檔案時它已經幫你複製好了。
3. 寫 `brief.md`：目標 ≤3 行、驗收標準、檔案所有權（成員範圍不得重疊）、共用契約擁有者、波次表。波次表一列一位成員（標難度 S/M/L；**S 只給純機械的工作**：i18n key、改數字或字串、照指定內容貼上，碰到邏輯、閘或規則文件至少 M），審查欄只填在該波第一列，三種寫法：`預設`（用 settings.env 的 kind）、`skip: <理由>`（純文件波）、`kinds: <k1> [k2] [k3]`（指定 1–3 個 kind 當第二、三意見）。成員欄填 `<角色>[-<別名>]`（即 state 檔名，不含任務短名），可改欄以逗號分隔 glob，`dir/**` 代表整棵子樹。有 plan 檔時不重寫內容，只對應驗收、劃所有權、把 task 分組成波。
4. `dk-brief-check`（機械閘，零 token）。FAIL 就修 brief 重跑；WARN（一波 dev 超過 tab 1 格數）建議拆波。
5. `dk-brief-review`（AI 閘）：派 2–3 個 kind 讀 request 與 brief。它自己會先跑一次 `dk-brief-check`，沒過就不派人。派完結束這個 turn，等 reviewer 的 `[DONE]`。
6. 收齊（達 `DK_REVIEW_MIN` 位、或所有人都回覆了）後裁定：`dk-process "brief-review verdict p1: 可以開工 / p2: 要改 2 處"`。採納的意見改進 brief，有爭議或意見矛盾時以需求原文為準並記 `ruling:`（格式見 `.dkbo/LEADER.md`）。**改完 brief 要重跑 `dk-brief-check`** —— 改所有權很容易改出重疊。然後逐個關掉 reviewer：`dk-wave-close --agent <任務短名>-reviewer-p1`。
7. 關卡①：把 `request.md`、`brief.md` 與裁定摘要三份給人確認。只給 brief 的話，人看不出你有沒有從一開始就聽錯 —— 而那正是 reviewer 結構上抓不到的那一類錯。人點頭後執行 `dk-task-new <short> --gate1`（它會檢查計畫審查的結果、裁定有沒有交代每一位 reviewer、reviewer pane 有沒有關乾淨，然後記 process、INDEX 改 running）。

## 做完就停
計畫完決定不做：`dk-task-close --abandon "<原因>"`。這時什麼都還沒切，它只標 INDEX、commit 記憶、清掉綁定。
關卡①過了、`--gate1` 記完，這個階段就結束。告訴人「brief 已定案，要開始跑波叫 `/dkbo-run`（`.dkbo/skills/run/SKILL.md`）」，然後結束這個 turn。不要自己接著 `dk-wave-open`。
