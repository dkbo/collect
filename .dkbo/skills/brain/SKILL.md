---
name: dkbo-brain
description: 只在使用者明確要求啟動 dkbo 團隊流程（或明確指名本篇）時使用。dkbo 大腦階段。不跑任務波次的一切：讀需求給建議、把請求分流成雜務／併波／延後／開新任務、派雜務員工、開評議波裁設計題、寫 decisions.md。
---
# dkbo 大腦

先讀 `.dkbo/LEADER.md`，再照本篇。

## 收到人的請求時分流
- 是進行中任務的一部分 → 調波次表（記 process.md），不改 brief 的需求與驗收。
- 獨立、不改程式（翻譯、畫圖、整理） → `dk-chore <角色> "<交代>"`。雜務不屬於任務，對雜務員工回話用 `herdr agent wait <agent> --until idle --timeout 300000 && herdr agent prompt <agent> "..."` —— 一定要先等它閒下來，直接 prompt 一個正在工作的 agent 會不會被吃掉目前沒人知道（領導這一側不用 dk-msg；員工那一側用 `dk-msg leader`，訊息記在 `tasks/_chores/messages.log`）；收到它的 `[DONE] from chore-…` 後看結果，再 `dk-chore-close <agent>`（`--code` 的會合併回 main）。若懷疑漏收（例如剛清過自己的上下文），看 `tasks/_chores/messages.log` 的 `[DONE]`；雜務檔一天一夾（`_chores/<日期>/`），堆多了跑 `dk-chore-tidy` —— 舊檔歸位、`messages.log` 整份進 `archive/YYYY-MM.log`，只在沒有雜務在跑時動得了（它會告訴你還有誰在跑）；
還活著的雜務是 `.dkbo/.sessions/chores/` 裡剩下的那些。雜務檔的 `status:` 是員工的欄位，
不是完成訊號，別拿它判斷。
- 獨立、改程式、範圍小 → 先評估：涉及檔案、是否落在在線成員所有權內、嚴重度。給三選一附建議：立刻修（`dk-chore <角色> --code`）/ 併入當前任務 / 延後進 `tasks/BACKLOG.md`。人選後執行；人說「照建議」就直接做。
- 範圍大 → 建議開新任務，問人。告訴人「叫 `/dkbo-plan`（`.dkbo/skills/plan/SKILL.md`）」，不要自己開。
- 角色檔不存在 → 先讀 `.dkbo/skills/add-role/SKILL.md` 並照做建立（Claude Code 可用 `/dkbo-add-role`），再派工。不用通用員工矇混。

## 雜務故障
- 收到雜務員工的 `[BLOCKED]`：雜務也有守望了（`dk-watch --chores`，由 `dk-chore` 起、最後一件雜務關掉後自己退）。切到該 pane 按審批即可。
- 跑了 `git clean -xdf` 之後雜務關不掉：`.dkbo/.sessions/chores/<agent>` 是正在跑的雜務的身分證，被 gitignore 所以會被一起清掉；雜務本身（pane、worktree、branch）沒事，但 `dk-chore-close` 從此找不到它。復原：`dk-chore-close <agent> --abandon`（清掉 pane、worktree、branch，不 merge）。

## 評議波（不綁定 diff 的設計題）
第一輪對 `settings.env` 的 `DK_REVIEW_KINDS` 每個 kind 各派一位：`dk-spawn reviewer a --isolated --kind <k1>`、`dk-spawn reviewer b --isolated --kind <k2>`…，題目寫在 brief，各自寫意見到 state。全部 DONE 後第二輪對每人 `dk-msg` 其他人的 state 路徑，每人只准一則反駁。你裁定，記 ruling 與 decisions.md。

## 不做什麼
不開任務、不寫 brief、不跑波。要開任務叫 `/dkbo-plan`（`.dkbo/skills/plan/SKILL.md`）；任務已經在跑、要推進它叫 `/dkbo-run`（`.dkbo/skills/run/SKILL.md`）。
