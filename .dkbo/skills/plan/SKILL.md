---
name: dkbo-plan
description: 只在使用者明確要求啟動 dkbo 團隊流程（或明確指名本篇）時使用。dkbo 計畫階段。開新任務、寫 brief（目標、驗收標準、檔案所有權、波次表）、跑 dk-brief-check、走到關卡①給人確認後停。不派工、不跑波。
---
# dkbo 計畫

先讀 `.dkbo/LEADER.md`，再照本篇。

## 開任務
1. `dk-task-new <short> "<顯示名>" [--from <plan.md>]`。
2. 寫 `brief.md`：目標 ≤3 行、驗收標準、檔案所有權（成員範圍不得重疊）、共用契約擁有者、波次表。波次表一列一位成員（標難度 S/M/L），審查欄只填在該波第一列，三種寫法：`預設`（用 settings.env 的 kind）、`skip: <理由>`（純文件波）、`kinds: <k1> [k2] [k3]`（指定 1–3 個 kind 當第二、三意見）。成員欄填 `<角色>[-<別名>]`（即 state 檔名，不含任務短名），可改欄以逗號分隔 glob，`dir/**` 代表整棵子樹。有 plan 檔時不重寫內容，只對應驗收、劃所有權、把 task 分組成波。
3. `dk-brief-check`。FAIL 就修 brief 重跑；WARN（一波 dev 超過 tab 1 格數）建議拆波。全 OK 才給人。
4. 關卡①：把 brief 給人確認。人點頭後執行 `dk-task-new <short> --gate1`（記 process、INDEX 改 running）。

## 做完就停
關卡①過了、`--gate1` 記完，這個階段就結束。告訴人「brief 已定案，要開始跑波叫 `/dkbo-run`（`.dkbo/skills/run/SKILL.md`）」，然後結束這個 turn。不要自己接著 `dk-wave-open`。
