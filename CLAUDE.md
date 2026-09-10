# Claude Instructions

Read AGENTS.md first.

# 團隊流程 = dkbo（2026-09-10 起）

派工工具是 `.dkbo/`（[dkbo-team](https://github.com/dkbo/dkbo-team) v0.1.0，herdr pane 為底）。**每個 session 開頭先跑 `.dkbo/bin/dk-whoami`**：印 `leader` 就讀 `.dkbo/LEADER.md` 照它行事；印 `employee …` 就讀自己的角色檔與 `.dkbo/PROTOCOL.md`。規則本體只在 `.dkbo/`，這裡只寫本專案的對應與例外。

- **領導不寫碼、不改業務檔**：所有實作、驗證、審查都 `dk-spawn` 員工；領導只寫 brief、拆波、裁定、記憶檔（`process.md`、`decisions.md`、`PROJECT.md`）。舊的「≤30 行直做門檻」作廢。唯一例外：`.dkbo/`、`.claude/`、`CLAUDE.md`、`AGENTS.md` 這類規則檔由領導直接維護。
- **角色 → 目錄**（`.dkbo/roles/README.md` 為準）：`babylon`（`src/babylon/`、`src/pages/Battle/`）、`react`（其餘 `src/pages/`、`src/store/`、`src/components/`、`src/lib/`）、`godot`（`godot-src/`、`godot-candy-src/`）、`mapbuilder`（RpgRoom 地圖 JSON）、`qa`（shot.mjs 截圖、build／匯出、`/battle` 多人）、`reviewer`（每波審查，含架構／安全）、`netcore`（`src/core/`、`firestore.rules`、bridge 協定的共用契約擁有者）、`designer`（mockup／spec，不改碼）、`assets`（WebP 與素材）、`it`、`pm`。各領域架構重點仍在 `.claude/agents/<name>.md`，角色檔會指定要讀哪份；`.claude/agents/` 不再用 Agent tool 派。
- **brief 檔案所有權就是三道鎖的空間鎖**；資源鎖（`dev:5173`／`dev:5174`、`export:godot`、`export:candy`、`maps`、`build:docs`、`firebase:battle`）與依賴寫在波次表「做什麼」欄，同波不得重疊。Godot 與 Babylon net／bridge 協定是「共用契約」，擁有者是 `netcore`：其他角色用 QUESTION 要介面，不自行改。
- **模型上限 `opus` + `effort: high`**：角色檔三檔已寫死，`--tier` 只能選 S/M/L，不改 `kinds/claude.sh` 派 `fable`／`xhigh`／`max`。`haiku` 不進團隊。
- **審查 kinds `claude codex agy`**（`settings.env`）：agy 免費額度、只做意見；`[TIMEOUT]`／額度用完就熔斷，照 LEADER.md 補位或 `review N skipped`，不重試不替補。
- **commit 政策**：任務分支 `dk/<short>`（worktree `.worktrees/<short>`）上每波 `wave N:` commit 由領導自動做；合併回 `master`（`dk-task-close`，關卡③）與任何 push 一律要使用者拍板。`build: 部屬`（`pnpm build` 寫 `docs/`）不在任務內做。
- **Agent tool 只剩兩種用途**：領導寫 brief 前派內建 `Explore`（haiku／sonnet low，唯讀）把 `檔案:行號` 找齊；不在 herdr 內（`$HERDR_ENV` 不是 1）時退回 `.claude/skills/herdr-team` 的備援流程。員工端已由 PROTOCOL 禁 subagent。
- 記憶：任務記憶在 `.dkbo/tasks/<日期-短名>/`（進版控）；`.claude/state/` 舊 brief／report 目錄退役；plans 仍放 `.claude/plans/`，`dk-task-new --from <plan>` 直接吃。
- MCP 只留 `context7`（`.mcp.json`）；角色檔 `mcp: []`，`dk-spawn` 不會缺 MCP。

# Hooks（`.claude/settings.json`，規範不靠自律）

員工是獨立 Claude Code session，在任務 worktree 內各自觸發下列 hooks；`dk-wave-close` 另在 worktree 跑 `DK_TEST_CMD`（eslint + tsc + vitest）當第三道閘。

- `SessionStart`：Godot 源碼用 git 歷史比產物（不用 mtime）判斷是否過期、`.env.local` 缺 `VITE_FIREBASE_FIRESTORE_DB` 時注入提示。
- `PreToolUse` Bash：擋 `pkill -f`、沒帶 `--headless --import` 的手動 `godot --export-*`、手動複製進 `public/godot/maps/`、把 jpg/png 寫進 `src/`／`public/`。
- `PostToolUse`（Edit/Write）對剛改的單檔即時檢查：`src/` 的 TS/TSX 跑 `eslint --cache --fix`；`.gd` 跑 `godot --check-only`；RpgRoom 地圖 JSON 驗合法性並**自動跑 sync:maps**；糖果關卡 JSON 驗合法性；`export_presets.cfg` 的 Threads 被改 ON 即擋下；改到 bridge 四個檔任一個會提醒另一邊要同步。
- `Stop`（不掛 SubagentStop）只在這棵樹真的改過對應區塊時才驗：改 `src/` → eslint（共用快取）+ `pnpm typecheck` + vitest；改糖果 → `board_test.gd`；改 Godot 只提醒要匯出。失敗輸出只回尾段，沒過就把你叫回來。
- worktree 內跑 hook 時缺 `node_modules`／`.env.local` 會自動 symlink 主 repo 的（`_common.sh`）；驗證一律直呼 `node_modules/.bin/<tool>`，不走 `pnpm exec`（pnpm 11 會想 purge symlink 的 `node_modules`）。
- `permissions.allow` 已放行員工常用的 `dk-*`、`pnpm`、`node`、`godot`、唯讀 `git`，避免 acceptEdits 模式下每個 Bash 都卡審批；其他指令卡住時 dk-watch 會推 `[BLOCKED]` 給領導。

腳本在 `.claude/hooks/`，共用函式在 `_common.sh`，狀態與 eslint 快取在 `.claude/.hook-state/`（已 gitignore，每棵樹一份）。vite 已設 `strictPort`，5173 被占用會直接報錯而不是換 port。

# Superpowers

已裝 `superpowers` plugin（`superpowers:<name>`）。它是**流程 skill**，本專案的規範與 dkbo 才是主體。衝突時優先序：**AGENTS.md ＞ `.dkbo/`（LEADER／PROTOCOL／roles）＞ `.claude/agents/*` ＞ `.claude/skills/*` ＞ Superpowers**。

- `brainstorming`：**只在**需求模糊的新遊戲／新頁面／行為變更前用，且由領導在開任務前做，產出直接餵 brief 的目標與驗收標準。明確的 `fix:`、已指定做法、樣式微調、地圖 JSON、Godot 匯出一律跳過。
- `systematic-debugging`：所有 `fix:` 類任務都套用（先重現、找根因，再改碼）；領導把「先重現」寫成波 1 的 qa 列（多人同步用兩個獨立 context），再開修復波。
- `test-driven-development`：只套**純邏輯層**——`src/babylon/` 的 math／net、Zustand store（vitest，`*.test.ts` 同目錄）與糖果 `board.gd`（`tests/board_test.gd`）。UI、3D 渲染、GDScript 場景不套，改用 qa 截圖。細節見 `test-generation` skill。
- `verification-before-completion`：完成定義以 hooks 與 `dk-wave-close` 三檢查為準（lint 零錯誤、tsc 乾淨、vitest／board_test 全綠、Godot 產物已匯出、dev report 有 `## 測試`），不另立標準。
- `executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents`：一律換成 dkbo 的波次（`dk-task-new --from <plan>` → 波次表 → `dk-wave-open`／`dk-spawn`），**不要**派 general-purpose subagent。
- `requesting-code-review`：由每波 `dk-review` 取代；架構／安全重點已寫在 `reviewer` 角色檔。
- `using-git-worktrees` / `finishing-a-development-branch`：worktree 由 `dk-task-new` 建在 `.worktrees/<short>`，分支 `dk/<short>`；結案走 `dk-task-close`，不另起 worktree、不自己 merge。
- **產出檔不得寫到 `docs/`（那是 build 產物）或 repo 根目錄**：plans → `.claude/plans/`，specs → `.claude/.superpower/specs/`，任務 brief／process／report／state → `.dkbo/tasks/<日期-短名>/`（dk 腳本管）。
- `writing-plans` 產的 plan 每張 task 要能直接對應 brief 的一列波次：帶可改檔案 glob、驗收條、依賴與獨佔資源，顆粒 20–60 分鐘；`dk-task-new --from` 不重寫內容，只劃所有權與分波。
@AGENTS.md
