# Claude Instructions

Read AGENTS.md first.

# 團隊流程 = dkbo（2026-09-10 起）

派工工具是 `.dkbo/`（[dkbo-team](https://github.com/dkbo/dkbo-team) v0.14.0，herdr pane 為底）。**每個 session 開頭先跑 `.dkbo/bin/dk-whoami`**：印 `employee …` 就讀自己的角色檔與 `.dkbo/PROTOCOL.md`；印 `leader` **不代表你就是領導**（0.7.0 起領導不自動接管），照使用者原本的要求做事，要用團隊流程時請他叫其中一個 skill。規則本體只在 `.dkbo/`，這裡只寫本專案的對應與例外。

- **領導拆成三個階段**（各自先讀 `.dkbo/LEADER.md` 共同規範）：`/dkbo-brain`（諮詢、分流、雜務 `dk-chore`、評議波）、`/dkbo-plan`（`dk-task-new`＋`request.md` 逐字落檔、寫 brief、`dk-brief-check` 機械閘、`dk-brief-review` 派 2–3 個不同 kind 審計畫並裁定、關卡①後停）、`/dkbo-run`（`dk-wave-open`／`dk-spawn`／`dk-review`／裁定／`dk-wave-close`／結案）。三者不互相自動跳轉，該換階段就告訴使用者叫哪一個並結束 turn。`dk-resume` 是唯讀看板，隨時可跑，看了不等於接管。

- **領導不寫碼、不改業務檔**：所有實作、驗證、審查都 `dk-spawn` 員工；領導只寫 brief、拆波、裁定、記憶檔（`process.md`、`decisions.md`、`PROJECT.md`）。舊的「≤30 行直做門檻」作廢。唯一例外：`.dkbo/`、`.claude/`、`CLAUDE.md`、`AGENTS.md` 這類規則檔由領導直接維護。
- **角色 → 目錄**（`.dkbo/roles/README.md` 為準）：`babylon`（`src/babylon/`、`src/pages/Battle/`）、`react`（其餘 `src/pages/`、`src/store/`、`src/components/`、`src/lib/`）、`godot`（`godot-src/`、`godot-candy-src/`）、`mapbuilder`（RpgRoom 地圖 JSON）、`qa`（shot.mjs 截圖、build／匯出、`/battle` 多人）、`reviewer`（每波審查，含架構／安全）、`netcore`（`src/core/`、`firestore.rules`、bridge 協定的共用契約擁有者）、`designer`（mockup／spec，不改碼）、`assets`（WebP 與素材）、`it`、`pm`。各領域架構重點仍在 `.claude/agents/<name>.md`，角色檔會指定要讀哪份；`.claude/agents/` 不再用 Agent tool 派。
- **brief 檔案所有權就是三道鎖的空間鎖**；資源鎖寫在所有權表的**「獨佔資源」欄**（`dev:5173`／`dev:5174`、`export:godot`、`export:candy`、`maps`、`build:docs`、`firebase:battle`，逗號分隔），同一波兩人宣告同一個 `dk-brief-check` 直接 FAIL；依賴仍寫波次表「做什麼」欄。Godot 與 Babylon net／bridge 協定是「共用契約」，擁有者是 `netcore`：其他角色用 QUESTION 要介面，不自行改 —— 0.9.0 起**共用契約寫成表格**（契約｜擁有者｜消費者｜形狀／簽名｜變更流程），擁有者與消費者都必須出現在檔案所有權表，否則 `dk-brief-check` FAIL。另有 `## 全域約束` 段（橫切所有波的硬要求，一行一條，會流進每一份切片）：本專案常填的是「路徑用 `@/*`、自訂 class 用 `@apply`、圖片只收 WebP、非同步寫在 store action」，真的沒有才寫「無」（留空是 FAIL）。
- **模型上限 `opus` + `effort: high`**：角色檔三檔已寫死，`--tier` 只能選 S/M/L，不改 `kinds/claude.sh` 派 `fable`；0.13.0 起 `KIND_MODEL_EFFORTS` 雖收 `xhigh`／`max`，本專案不用、`--effort` 不手動覆寫到那兩檔。`haiku` 不進團隊。
- **審查 kinds `claude codex agy`、法定人數 `DK_REVIEW_MIN="2"`**（`settings.env` 八鍵，領導自己也是 `DK_LEADER_KIND="claude"`、整波逾時 `DK_WAVE_TIMEOUT_MIN="60"`）：MIN=2 表示**至少兩個不同 kind 的意見進裁定**才算審查完成 —— 換一個模型抓到的錯誤類別，跟同一個模型想得更久抓到的不是同一批；agy 免費額度、只做意見。`[BLOCKED]`（按一下審批就活）與 `[LIMIT]`（額度用完，按審批救不回來、該 kind 當場熔斷）是兩件事，處置不同；`[TIMEOUT]`／熔斷照 `.dkbo/skills/run/SKILL.md` 補位（`dk-review --kinds "<未熔斷者>"`）或 `review N skipped`，不重試不替補。
- **審查檔位 `DK_REVIEW_TIER="L"`**（0.4.0 新增的第八鍵；本專案早設 L，0.14.0 起出廠預設也改 L）：`dk-review` 從它取檔位，claude 主審拿 `opus/high`、codex `gpt-5.5/high`、agy `gemini-3.1-pro/high`，`--tier` 仍可逐次覆寫。**不要改 `roles/reviewer.md` 的 tier 定義**去達成同一件事（tier 在別處一律是「切片難度」，改了會讓 `--tier M|L` 變成靜默 no-op）。另：碰 `src/babylon/net/`／`src/core/`／`firestore.rules`／bridge 四檔的波，波次表的成員難度標 `L`（讓 babylon／godot／netcore 吃到 `opus/high`），不要留預設 M。
- **修復迴圈兩輪，第二輪換腦袋**（0.9.0）：BUG →（dev）FIXED，內文要附一句根因 → qa 再驗仍失敗 → 領導 `dk-spawn <成員> --handoff "<原因>"`（隱含 `--resume`，自己落 `ruling:`，首輪提示叫接手的人讀上一位的 state／report、不要照它的路再走一次）→ 再驗仍失敗才 ESCALATE。角色檔與 `PROTOCOL.md` 都已改成兩輪。
- **Minor 要領導自己落盤才活得過這一波**：`dk-review` 收到 reviewer 的 `## Minor` 後，領導逐條 `dk-process "minor N: <一句> <file:line>"`；整枝評議（`dk-review --task`）的切片會帶上本任務累積的 Minor 請 reviewer triage，逐波審查不帶。`dk-task-close` 對「有 minor 但結案 report 沒提」只警告不擋。
- **時間看得見**（0.9.2）：`dk-resume` 的「本波」段印 `任務已進行 Xh Ym`／`本波已進行 Ym`、每位在線員工附 `等了 N min`，用來判斷該不該催或熔斷，不再憑感覺；`dk-wave-close` 成功關波時記一行 `wave N 耗時 Mm（dev Am、審查 Rm）`；`dk-timeline [<任務>]` 只讀 `process.md` 印一張表（零 token、不寫檔），`dk-task-close` 會把它填進 report 的 `## 時間` 段。全部從既有時間戳算出來，員工與領導都不用多填欄位。
- **任務改開 tab、交棒才實體化**（0.11.0）：`dk-task-new` 只建 `.dkbo/tasks/<t>/`，不切 worktree；叫 `/dkbo-run` 時 `dk-leader <short> --run` 才切 `dk/<short>` worktree、在原 workspace 開 label `dk/<short>` 的 tab 並交棒給那裡的執行領導，原 session 就可以空出來開下一個 `/dkbo-plan`。失敗整組 rollback，重跑冪等。**專案層熔斷**（0.12.0）：某 kind 撞額度後在 `dk-resume` 兩波之間也看得到，恢復用 `dk-kind up <kind>`；`dk-wave-open N --refresh` 只清逾時標記。`settings.env` 的 `DK_REPOS`／`DK_SETUP_CMD` 本專案留空（單 repo、hooks 已 symlink `node_modules`）。
- **commit 政策**：任務分支 `dk/<short>`（worktree `.worktrees/<short>`）上每波 `wave N: <成員>` commit 由 `dk-wave-close` 四道閘全過後自動做（要自訂訊息用 `-m`），領導不手動 commit；結案時 `dk-task-close` 另把任務記憶（`.dkbo/tasks/<t>/`、`tasks/INDEX.md`、`decisions.md`）commit 進主樹，不碰其他改動。合併回 `master`（`dk-task-close`，關卡③）與任何 push 一律要使用者拍板。`build: 部屬`（`pnpm build` 寫 `docs/`）不在任務內做。
- **Agent tool 只剩兩種用途**：領導寫 brief 前派內建 `Explore`（haiku／sonnet low，唯讀）把 `檔案:行號` 找齊；不在 herdr 內（`$HERDR_ENV` 不是 1）時退回 `.claude/skills/herdr-team` 的備援流程。員工端已由 PROTOCOL 禁 subagent。
- 記憶：任務記憶在 `.dkbo/tasks/<日期-短名>/`（進版控）；`.claude/state/` 舊 brief／report 目錄退役；plans 仍放 `.claude/plans/`，`dk-task-new --from <plan>` 直接吃並把需求原文逐字複製成 `request.md`（計畫審查要拿它對 brief，沒填的空殼會被閘 1 擋在關卡①前）。
- MCP 只留 `context7`（`.mcp.json`）；角色檔 `mcp: []`，`dk-spawn` 不會缺 MCP。

# Hooks（`.claude/settings.json`，規範不靠自律）

員工是獨立 Claude Code session，在任務 worktree 內各自觸發下列 hooks；`dk-wave-close` 另在 worktree 跑 `DK_TEST_CMD`（eslint + tsc + vitest）當第三道閘，第四道是拿 worktree 的真實 git diff（含未 commit 與未追蹤）比對本波的檔案所有權，改到不屬於自己的檔（含在 worktree 內動 `.dkbo/`）就關不掉這一波；裁定行那道閘還要求交代每一位派出去的 reviewer（沒回來的寫 `skipped`）。

- `SessionStart`：Godot 源碼用 git 歷史比產物（不用 mtime）判斷是否過期、`.env.local` 缺 `VITE_FIREBASE_FIRESTORE_DB` 時注入提示。
- `PreToolUse` Bash：擋 `pkill -f`、沒帶 `--headless --import` 的手動 `godot --export-*`、手動複製進 `public/godot/maps/`、把 jpg/png 寫進 `src/`／`public/`。
- `PostToolUse`（Edit/Write）對剛改的單檔即時檢查：`src/` 的 TS/TSX 跑 `eslint --cache --fix`；`.gd` 跑 `godot --check-only`；RpgRoom 地圖 JSON 驗合法性並**自動跑 sync:maps**；糖果關卡 JSON 驗合法性；`export_presets.cfg` 的 Threads 被改 ON 即擋下；改到 bridge 四個檔任一個會提醒另一邊要同步。
- `Stop`（不掛 SubagentStop）只在這棵樹真的改過對應區塊時才驗：改 `src/` → eslint（共用快取）+ `pnpm typecheck` + vitest；改糖果 → `board_test.gd`；改 Godot 只提醒要匯出。失敗輸出只回尾段，沒過就把你叫回來。
- worktree 內跑 hook 時缺 `node_modules`／`.env.local` 會自動 symlink 主 repo 的（`_common.sh`）；驗證一律直呼 `node_modules/.bin/<tool>`，不走 `pnpm exec`（pnpm 11 會想 purge symlink 的 `node_modules`）。
- 員工的 claude 跑 `--permission-mode auto --add-dir <主樹>`（0.2.2 起；`acceptEdits` 下員工連讀自己的切片、寫 state 都卡審批）。`permissions.allow` 仍放行常用的 `dk-*`、`pnpm`、`node`、`godot`、唯讀 `git`；其他指令卡住時 dk-watch 會推 `[BLOCKED]` 給領導。

腳本在 `.claude/hooks/`，共用函式在 `_common.sh`，狀態與 eslint 快取在 `.claude/.hook-state/`（已 gitignore，每棵樹一份）。vite 已設 `strictPort`，5173 被占用會直接報錯而不是換 port。

# Superpowers

已裝 `superpowers` plugin（`superpowers:<name>`）。它是**流程 skill**，本專案的規範與 dkbo 才是主體。衝突時優先序：**AGENTS.md ＞ `.dkbo/`（LEADER／PROTOCOL／roles）＞ `.claude/agents/*` ＞ `.claude/skills/*` ＞ Superpowers**。

- `brainstorming`：**只在**需求模糊的新遊戲／新頁面／行為變更前用，且由領導在開任務前做，產出直接餵 brief 的目標與驗收標準。明確的 `fix:`、已指定做法、樣式微調、地圖 JSON、Godot 匯出一律跳過。
- `systematic-debugging`：所有 `fix:` 類任務都套用（先重現、找根因，再改碼），方法本體是 `.dkbo/methods/debugging.md`（六段：先重現、往回找第一個說謊的地方、一次改一件事、二分法、寫下排除了什麼、修好的定義），員工首輪提示與角色檔都指過去；領導把「先重現」寫成波 1 的 qa 列（多人同步用兩個獨立 context），再開修復波。
- `test-driven-development`：只套**純邏輯層**——`src/babylon/` 的 math／net、Zustand store（vitest，`*.test.ts` 同目錄）與糖果 `board.gd`（`tests/board_test.gd`）。UI、3D 渲染、GDScript 場景不套，改用 qa 截圖。細節見 `test-generation` skill。
- `verification-before-completion`：完成定義以 hooks 與 `dk-wave-close` 四道閘為準（審查裁定且交代每位 reviewer、dev report 的 `## 測試` 分 `### 紅`／`### 綠` 兩節、每節至少兩行（指令＋輸出），沒測試的波兩節都寫 `不適用: <理由>`、lint 零錯誤＋tsc 乾淨＋vitest／board_test 全綠、變更檔不越界；另加 Godot 產物已匯出），不另立標準。
- `executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents`：一律換成 dkbo 的波次（`/dkbo-plan` 的 `dk-task-new --from <plan>` → 波次表 → `/dkbo-run` 的 `dk-wave-open`／`dk-spawn`），**不要**派 general-purpose subagent。
- `requesting-code-review`：由每波 `dk-review` 取代，開工前還多一道 `dk-brief-review`（2–3 個不同 kind 讀 `request.md` + brief，回答「做出來會不會是人要的東西」，裁定後才准過關卡①）；架構／安全重點已寫在 `reviewer` 角色檔。
- `using-git-worktrees` / `finishing-a-development-branch`：worktree 由 `/dkbo-run` 交棒時的 `dk-leader <short> --run` 建在 `.worktrees/<short>`（0.11.0 起 `dk-task-new` 只建任務資料夾），分支 `dk/<short>`；結案走 `dk-task-close`，不另起 worktree、不自己 merge。
- **產出檔不得寫到 `docs/`（那是 build 產物）或 repo 根目錄**：plans → `.claude/plans/`，specs → `.claude/.superpower/specs/`，任務 brief／process／report／state → `.dkbo/tasks/<日期-短名>/`（dk 腳本管）。
- `writing-plans` 產的 plan 每張 task 要能直接對應 brief 的一列波次：帶可改檔案 glob、驗收條、依賴與獨佔資源，顆粒 20–60 分鐘；`dk-task-new --from` 不重寫內容，只劃所有權與分波；plan 裡橫切全部波的硬要求記得抄進 brief 的 `## 全域約束`。
@AGENTS.md
