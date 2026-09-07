# Claude Instructions

Read AGENTS.md first.

# Agents Team

**本 session 是 Lead**：拆解、分類、派工、核實；只有單檔 ≤30 行且不碰 `src/babylon/net/`、`src/core/`、`src/store/`、Godot bridge 協定的小修才自己改。**派工前一律先 `Skill('herdr-team')`**——誰做、哪個模型、怎麼叫 agy、怎麼收，都只寫在那支 skill。完整職責以 `.claude/agents/<name>.md` 為準。

| Agent | 預設 model / effort | 何時派 |
| --- | --- | --- |
| `babylon-game-dev` | opus / high | `src/babylon/`、`src/pages/Battle/`：遊戲邏輯、多人同步 |
| `react-ui-dev` | sonnet / high | `src/pages/`、`src/store/`、`src/components/`、`src/lib/` |
| `godot-dev` | sonnet / high | `godot-src/`、`godot-candy-src/`、Web 匯出 |
| `rpg-map-builder` | sonnet / medium | RpgRoom 地圖 JSON、場景圖轉 JSON |
| `build-runner` | sonnet / low | `pnpm lint` / `pnpm build` / godot 匯出，失敗只回報 |
| `web-verifier` | sonnet / medium | `verify-web/scripts/shot.mjs` 截圖、Godot iframe、`/battle` 多人驗證，只讀 |
| `arch-security-reviewer` | opus / high | 架構審查、Firebase 規則、WebRTC signaling 安全，只讀 |
| 內建 `Explore` | haiku / sonnet low | 多檔定位、找慣例，只要結論；實作前先派它把 `檔案:行號` 找齊 |

- **預設用 Agent tool 派**（不重載、可並行、可 worktree）；`claude -p` 只在要 `--resume` 時用，且加 `--permission-mode auto --strict-mcp-config`。
- **brief 六段、驗收三檢查**：brief 必有 `Files` 與 `Verify`，缺就不派；驗收只做 Verify 重跑、`git diff --name-only` ⊆ Files、看 report 殘留問題，Lead 不讀實作邏輯。連兩次退回 → BLOCKED 回報使用者。LLM 審查只在難級工單波尾派一次。
- brief／report／ledger 放 `.claude/state/`（gitignore，活過 session）；scratchpad 只放用完即棄。
- **模型上限 `opus` + `effort: high`**：agent／skill frontmatter 已寫死，派工時只能往下調（`sonnet`、`medium`／`low`），不派 `fable`、`xhigh`、`max`。`haiku` 只准唯讀格。
- **agy（Antigravity CLI）只做第二意見**：唯讀、只用 `gemini-3.8-flash-high`、免費額度；沒額度就沒有第二意見，不重試不替補。語法見 `herdr-team`。
- `/architecture-review`、`/security-audit` 會 fork 到 `arch-security-reviewer`；其他 skill 的 `model`／`effort` 只作用於呼叫它的那一輪。
- 唯讀 agent 隨時可並行；改檔 agent 已 `disallowedTools: Agent`（不能再派工）。同波要過三道鎖：時間（依賴）、空間（`Files` 不相交）、資源（`dev:5173`／`export:godot`／`export:candy`／`maps`／`build:docs`／`firebase:battle` 不重疊）；TDD 紅燈的工單改序列或給 `isolation: "worktree"`。
- MCP 只留 `context7`（`.mcp.json`）：filesystem／memory／github 與內建工具或 `gh` 重複，playwright 本機沒 Chrome 起不來。

# Hooks（`.claude/settings.json`，規範不靠自律）

- `SessionStart`：Godot 源碼用 git 歷史比產物（不用 mtime）判斷是否過期、`.env.local` 缺 `VITE_FIREBASE_FIRESTORE_DB` 時注入提示。
- `PreToolUse` Bash：擋 `pkill -f`、沒帶 `--headless --import` 的手動 `godot --export-*`、手動複製進 `public/godot/maps/`、把 jpg/png 寫進 `src/`／`public/`。
- `PostToolUse`（Edit/Write）對剛改的單檔即時檢查：`src/` 的 TS/TSX 跑 `eslint --cache --fix`；`.gd` 跑 `godot --check-only`；RpgRoom 地圖 JSON 驗合法性並**自動跑 sync:maps**；糖果關卡 JSON 驗合法性；`export_presets.cfg` 的 Threads 被改 ON 即擋下；改到 bridge 四個檔任一個會提醒另一邊要同步。
- `Stop`（**不掛 SubagentStop**，唯讀 subagent 不會被拖去驗）只在這棵樹真的改過對應區塊時才驗：改 `src/` → eslint（共用快取）+ `pnpm typecheck` + vitest；改糖果 → `board_test.gd`；改 Godot 只提醒要匯出。失敗輸出只回尾段，沒過就把你叫回來。
- worktree 內跑 hook 時缺 `node_modules`／`.env.local` 會自動 symlink 主 repo 的（`_common.sh`）。

腳本在 `.claude/hooks/`，共用函式在 `_common.sh`，狀態與 eslint 快取在 `.claude/.hook-state/`（已 gitignore）。vite 已設 `strictPort`，5173 被占用會直接報錯而不是換 port。

# Superpowers

已裝 `superpowers` plugin（`superpowers:<name>`）。它是**流程 skill**，本專案的規範與 agent team 才是主體。衝突時優先序：**AGENTS.md ＞ `.claude/agents/*` ＞ `.claude/skills/*` ＞ Superpowers**。

- `brainstorming`：**只在**需求模糊的新遊戲／新頁面／行為變更前用。明確的 `fix:`、已指定做法、樣式微調、地圖 JSON、Godot 匯出一律跳過。
- `systematic-debugging`：所有 `fix:` 類任務都套用（先重現、找根因，再改碼）。多人同步問題先用 web-verifier 以兩個獨立 context 重現。
- `test-driven-development`：只套**純邏輯層**——`src/babylon/` 的 math／net、Zustand store（vitest，`*.test.ts` 同目錄）與糖果 `board.gd`（`tests/board_test.gd`）。UI、3D 渲染、GDScript 場景不套，改用 web-verifier 截圖。細節見 `test-generation` skill。
- `verification-before-completion`：完成定義以 hooks 為準（lint 零錯誤、tsc 乾淨、board_test 全綠、Godot 產物已匯出），不另立標準。
- `executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents`：派工一律走 `herdr-team` 的路由矩陣與專案 agent，**不要**派 general-purpose subagent。
- `requesting-code-review`：改派 `arch-security-reviewer`（架構／安全）；一般 diff 正確性由 hooks 與 Lead 核實。
- `using-git-worktrees` / `finishing-a-development-branch`：只在明確要求時用。commit / push 一律要使用者指示。
- **產出檔不得寫到 `docs/`（那是 build 產物）或 repo 根目錄**：plans → `.claude/plans/`，specs → `.claude/.superpower/specs/`，worktrees → `.claude/.superpower/worktrees/<branch>/`，派工 brief／report／ledger → `.claude/state/`（皆已 gitignore）。
- `writing-plans` 產的 plan 每張 task 要能直接抄成 herdr-team 的 brief：帶 `Files`、`Verify`、依賴與資源，顆粒 20–60 分鐘。
