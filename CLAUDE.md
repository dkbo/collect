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
| `web-verifier` | sonnet / medium | Playwright 截圖、Godot iframe、`/battle` 多人驗證，只讀 |
| `arch-security-reviewer` | opus / high | 架構審查、Firebase 規則、WebRTC signaling 安全，只讀 |

- **模型上限 `opus` + `effort: high`**：agent／skill frontmatter 已寫死，派工時只能往下調（`sonnet`、`medium`／`low`），不派 `fable`、`xhigh`、`max`。
- **agy（Antigravity CLI）只做第二意見**：唯讀、只用 `gemini-3.8-flash-high`、免費額度；沒額度就沒有第二意見，不重試不替補。語法見 `herdr-team`。
- `/architecture-review`、`/security-audit` 會 fork 到 `arch-security-reviewer`；其他 skill 的 `model`／`effort` 只作用於呼叫它的那一輪。
- 唯讀 agent（`arch-security-reviewer` / `web-verifier` / `build-runner`）可放心並行；改檔 agent 不同時改同一檔。

# Hooks（`.claude/settings.json`，規範不靠自律）

- `SessionStart`：Godot 源碼比 `public/godot`／`public/candy` 產物新、`.env.local` 缺 `VITE_FIREBASE_FIRESTORE_DB` 時注入提示。
- `PreToolUse` Bash：擋 `pkill -f`、沒帶 `--headless --import` 的手動 `godot --export-*`、手動複製進 `public/godot/maps/`、把 jpg/png 寫進 `src/`／`public/`。`mcp__playwright__*`：本機沒有 `/opt/google/chrome/chrome` 就直接擋下並指向 verify-web 的 chromium 備援。
- `PostToolUse`（Edit/Write）對剛改的單檔即時檢查：`src/` 的 TS/TSX 跑 `eslint --fix`；`.gd` 跑 `godot --check-only`；RpgRoom 地圖 JSON 驗合法性並**自動跑 sync:maps**；糖果關卡 JSON 驗合法性；`export_presets.cfg` 的 Threads 被改 ON 即擋下；改到 bridge 四個檔任一個會提醒另一邊要同步。
- `Stop` / `SubagentStop` 只在本 session 真的改過對應區塊時才驗：改 `src/` → `pnpm lint` + `pnpm typecheck`；改糖果 → `board_test.gd`；改 Godot 只提醒要匯出。沒過就把你叫回來。

腳本在 `.claude/hooks/`，狀態在 `.claude/.hook-state/`（已 gitignore）。vite 已設 `strictPort`，5173 被占用會直接報錯而不是換 port。

# Superpowers

已裝 `superpowers` plugin（`superpowers:<name>`）。它是**流程 skill**，本專案的規範與 agent team 才是主體。衝突時優先序：**AGENTS.md ＞ `.claude/agents/*` ＞ `.claude/skills/*` ＞ Superpowers**。

- `brainstorming`：**只在**需求模糊的新遊戲／新頁面／行為變更前用。明確的 `fix:`、已指定做法、樣式微調、地圖 JSON、Godot 匯出一律跳過。
- `systematic-debugging`：所有 `fix:` 類任務都套用（先重現、找根因，再改碼）。多人同步問題先用 web-verifier 以兩個獨立 context 重現。
- `test-driven-development`：只套**有測試框架的純邏輯**——目前只有糖果 `godot-candy-src/scripts/board.gd`（`tests/board_test.gd`）。`src/babylon/` 的 math／net 與 Zustand store 尚未裝 vitest，裝了才套；UI、3D 渲染、GDScript 場景不套，改用 web-verifier 截圖。
- `verification-before-completion`：完成定義以 hooks 為準（lint 零錯誤、tsc 乾淨、board_test 全綠、Godot 產物已匯出），不另立標準。
- `executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents`：派工一律走 `herdr-team` 的路由矩陣與專案 agent，**不要**派 general-purpose subagent。
- `requesting-code-review`：改派 `arch-security-reviewer`（架構／安全）；一般 diff 正確性由 hooks 與 Lead 核實。
- `using-git-worktrees` / `finishing-a-development-branch`：只在明確要求時用。commit / push 一律要使用者指示。
- **產出檔不得寫到 `docs/`（那是 build 產物）或 repo 根目錄**：plans → `.claude/plans/`，specs → `.claude/.superpower/specs/`，worktrees → `.claude/.superpower/worktrees/<branch>/`（皆已 gitignore）。
