---
name: herdr-team
description: Use when 要派工而不是自己動手——決定派哪個專案 agent、用哪個 model/effort（上限 opus high），或找 agy 要第二意見（唯讀、只用 gemini-3.8-flash-high、免費額度，沒額度就沒有第二意見）。含 Lead 直做門檻、路由矩陣、claude -p／agy 實測語法、額度紀律。使用者提到「派工」「叫 agy」「第二意見」「開一支 worker」「並行跑」時也適用。
---

# Lead 調度（claude ＋ agy）

## 0. 分界

本 session = Lead：拆解 → 分類（類型 × 難度）→ 查表 → 寫 brief → 派 → 收 → 核實。

**直做門檻**：單檔、≤30 行、不碰 `src/babylon/net/`、`src/core/`、`src/store/`、Godot bridge 協定 → Lead 自己改。超過就派。

| 層 | 帳號 | 做什麼 | 寫檔 |
| --- | --- | --- | --- |
| Lead | Claude Max | 決策、brief、核實 | 只在直做門檻內 |
| claude worker（專案 agent） | 同上 | 探勘、實作、驗證、審查——**所有正式工作** | 可 |
| agy | 免費方案，只用 `gemini-3.8-flash-high` | **只做第二意見**：審 worker 的 diff／結論／計畫 | 不可 |

**模型上限 `opus` + `effort: high`**——`fable`、`xhigh`、`max` 一律不派，agent 與 skill 的 frontmatter 已寫死，不要在派工時覆寫成更高。

**agy 沒額度就沒有第二意見**——不重試、不換模型、不找替身，回報「本次無第二意見（agy 不可用）」後照原流程走。任何任務不得依賴 agy 才能往下。

兩個目錄，用途不混：

- `$S` = 本 session 的 scratchpad，**隨 session 消失**：agy 的 prompt／輸出、截圖、臨時腳本。
- `.claude/state/`（gitignore）= 要活過 session 與 compact 的東西：`briefs/<slug>/task-N.md`、`reports/<slug>/task-N.md`、`progress/<slug>.md`（ledger）。`<slug>` = plan 檔名去掉 `.md`；單一任務沒有 plan 就用 `YYYY-MM-DD-<短名>`。目錄不存在就 `mkdir -p`。
- **派到 worktree 時 `.claude/state/` 一律寫主 repo 的絕對路徑**（`/home/bal/project/collect/.claude/state/…`）：它是 gitignore，worktree checkout 出來是空的，worker 寫在自己樹裡 Lead 讀不到，brief／report／ledger 直接斷鏈。

## 1. 路由矩陣（照表查）

難度：**易** 單檔、規則明確、可機械執行；**中** 2–5 檔、需懂既有慣例、不跨層；**難** 跨層（Babylon 遊戲 ↔ net 同步 ↔ WebRTC/Firestore、React ↔ Godot bridge）、要設計決策。

| 任務 | agent | 易 | 中 | 難 |
| --- | --- | --- | --- | --- |
| Babylon 遊戲／多人同步（`src/babylon/`、`src/pages/Battle/`） | `babylon-game-dev` | sonnet medium | sonnet high | **opus high** ＋ agy 第二意見 |
| React 頁面／Zustand store／UI（`src/pages/`、`src/store/`、`src/components/`、`src/lib/`） | `react-ui-dev` | Lead 直做 | sonnet medium | sonnet high；被審查打回才升 opus high |
| Godot GDScript／匯出（`godot-src/`、`godot-candy-src/`） | `godot-dev` | sonnet medium | sonnet high | opus high ＋ agy 第二意見（改 bridge 協定必派） |
| RPG 地圖 JSON／場景圖轉 JSON | `rpg-map-builder` | sonnet low | sonnet medium | sonnet medium |
| build／lint／godot 匯出／地圖同步 | `build-runner` | sonnet low | sonnet low | sonnet low |
| 瀏覽器驗證／截圖／`/battle` 多人 | `web-verifier` | sonnet low | sonnet medium | sonnet medium（瓶頸是工具輸出量不是推理） |
| 架構／安全審查（唯讀） | `arch-security-reviewer` | 不派 | sonnet medium | **opus high** ＋ agy 第二意見 |
| 探勘／找檔／多檔掃描（唯讀，只要結論不要檔案內容） | 內建 `Explore` | haiku | sonnet low | sonnet medium |

每格都寫死 model 與 effort，不留給預設；agent frontmatter 的值是「難」級預設，易／中級派工時往下調。`haiku` 只准出現在唯讀格：`Explore` 的易級與唯讀 worker 的 `--fallback-model` 尾端；審查會給假安全感、寫檔容易反覆修，不派。

**先探勘再實作**：實作 agent 是 opus／sonnet high，不要拿它讀檔找位置。多檔定位派 `Explore`，把找到的 `檔案:行號` 寫進實作 brief 的「證據」段。

## 2. 通道：預設 Agent tool，`claude -p` 與 pane 是例外

| 通道 | 何時 | 代價 |
| --- | --- | --- |
| **Agent tool**（`subagent_type: <專案 agent>`，`model`／`effort` 往下調） | 預設。所有 worker 與唯讀審查 | 不重 spawn、不重載 CLAUDE.md／MCP、結果直接回、可並行、可 `SendMessage` 追問、可 `isolation: "worktree"` |
| `claude -p`（第 3 節） | 要跨 session `--resume`、要不同 `--permission-mode`、或要 `--output-format json` 拿 `total_cost_usd` | 每支重載約 14K token ＋ MCP 啟動；一律加 `--strict-mcp-config` |
| pane（herdr） | (a) 使用者要看它跑或直接對話 (b) 多輪追問且 `--resume` 不夠（agy 沒有 resume） (c) agy 要讀專案 skill 且不想每次 cat 進 prompt | 佔畫面、要手動收 |

並行規則（hooks 已配合）：

- 唯讀 agent（`Explore`、`web-verifier`、`arch-security-reviewer`、`build-runner`）隨時可並行、可 background；它們不會觸發驗證（SubagentStop 已不掛 verify）。
- 同一棵樹的 in-process 改檔 agent 可並行，前提是**不改同一檔**；改動由主 session 收工時一次驗（`verify-on-stop.sh` 只掛 Stop）。
- 要真正互不干擾（各自 lint／test）就用 Agent tool 的 `isolation: "worktree"`。派之前先確認三件事：
  - `node_modules`／`.env.local` 不用管，hook 會自動 symlink 主 repo 的（`_common.sh` 的 `ensure_worktree_deps`）。
  - brief 裡 `.claude/state/` 的路徑要寫成主 repo 絕對路徑（見「路徑約定」）；worktree 內那個目錄是空的。
  - 要起 dev server 就在 brief 指定 `PORT=5174`（或更高）並把同一個 port 寫進 `shot.mjs` 的 `--url`；`strictPort` 不會幫你跳 port，撞到 5173 直接報錯。
  - Godot 工單不要派進 worktree：`.godot/` import 快取與 `public/godot/maps/` 都 gitignore，第一次要整包重 import，而 `export:godot` 本來就是獨佔鎖、沒有並行的好處。
- `claude -p` 寫檔 worker 是獨立 session，會各自觸發 Stop 驗證且共用 `.claude/.hook-state/`：**同一棵樹同時只跑一支**。

**三道鎖**：兩張工單能不能同波，三個都成立才算。

| 鎖 | brief 欄位 | 沒驗會怎樣 |
| --- | --- | --- |
| 時間 | 依賴哪張工單的產出 | 對著不存在的簽名寫 |
| 空間 | `Files` 不相交 | 後寫的靜默覆蓋先寫的，兩邊都回報成功 |
| 資源 | 下面清單不重疊 | 第二支把第一支的環境弄掉，第一支的驗證結果變假 |

本專案的獨佔資源清單（固定，brief 的邊界段要寫用到哪些）：`dev:5173`（strictPort，一個 dev server；worktree 裡用 `PORT=5174 pnpm dev` 可以另開一支，鎖就換成 `dev:5174`）、`export:godot`（`public/godot/`，`pnpm godot:export`）、`export:candy`（`public/candy/`）、`maps`（`public/godot/maps/`，sync:maps）、`build:docs`（`pnpm build` 寫 `docs/`）、`firebase:battle`（/battle 多人驗證的房間；兩支 web-verifier 同時測會互相加入）。純改 `src/` 不跑 build／匯出的工單資源為 `[]`。

**隱性編譯鎖**：`verify-on-stop.sh` 跑的是整 repo 的 `tsc -b` 與 vitest。一支 worker 處在 TDD 紅燈，另一支 headless worker 的 Stop 就會被連帶擋下。同波有 TDD 工單時：改序列，或給它 `isolation: "worktree"`。

## 3. claude worker（實測語法，沿用 sport-frontend-panova）

```bash
B=.claude/state/briefs/<slug>/task-N.md
claude -p --model sonnet --effort medium --agent babylon-game-dev \
  --permission-mode auto --strict-mcp-config \
  --output-format json "讀 $B 並照做。" > "$S/out.json" 2>"$S/out.err"
jq -r '.subtype, .is_error, .total_cost_usd, .session_id, .result' "$S/out.json"
```

- **`--permission-mode auto`，不用 `acceptEdits`**：acceptEdits 不涵蓋 Bash，worker 每次 `pnpm`／`godot`／`node` 都會進 `.permission_denials`；`.claude/` 底下的 Write 也會被當 sensitive 卡住。auto 交給 classifier 判，真正危險的仍會被擋。
- brief 走檔案，prompt 只給路徑：重派或 `--resume` 時不必重貼；Lead 的 context 也不必再抄一次。
- `--strict-mcp-config` 不帶 `--mcp-config` ＝ 零 MCP server：worker 用不到 context7 以外的 MCP，省啟動時間與工具列表 token。
- 先驗 `.subtype == "success"` 且 `.is_error == false` 再讀 `.result`；`.permission_denials` 非空表示有動作被擋。
- `--agent` 與 `--json-schema` 互斥：帶 agent 時 `.result` 回 Markdown。
- 唯讀 worker 加 `--disallowedTools Edit Write NotebookEdit`。改檔 agent 的 frontmatter 已 `disallowedTools: Agent`，worker 不能再派工，派工只在 Lead。
- 寫檔 worker **不帶** `--fallback-model`（primary 是 opus 時最多 `--fallback-model sonnet`）；唯讀 worker 可 `sonnet,haiku`。
- 追問用 `claude -p --resume <session_id> "…"`，不重派。
- worker 的 Stop hook（`.claude/hooks/verify-on-stop.sh`）已在改過 `src/` 時跑 lint + typecheck + vitest、改過糖果時跑 board_test，Lead 不重跑；`pnpm build` 與 Godot 匯出仍派 `build-runner`。

## 4. agy 第二意見

一次性（預設）——把相關 skill／規範內文一起餵進去，`agy -p` 讀不到 `.agents/`（實測）：

```bash
agy --model gemini-3.8-flash-high --sandbox --output-format json \
  -p="$(cat AGENTS.md "$S/review-brief.md")" > "$S/agy.json" 2>"$S/agy.err"
[ "$(jq -r .status "$S/agy.json" 2>/dev/null)" = SUCCESS ] && jq -r .response "$S/agy.json" || echo "無第二意見（agy 不可用）"
```

- **`-p` 會把下一個參數吃成 prompt**：必須 `-p="…"`，其他旗標放 `-p` 之前。
- **不要帶 `--effort`**：Flash 的模型名已含等級（`-low`／`-medium`／`-high`），另帶會回 `invalid model selection`。
- 回 `.status`／`.response`／`.usage.total_tokens`。空 prompt 一次約 14K token（2026-09-06 實測），所以第二意見合併成一支、不要拆小題反覆問。
- 只餵 diff／結論／計畫；Firebase 金鑰、`.env`、測試帳號不進 agy 的 prompt。

要看或要追問才開 pane：

```bash
name=$(.claude/skills/herdr-team/scripts/spawn-agy.sh gemini-3.8-flash-high)   # → worker-agy-N
herdr agent prompt "$name" "讀 $S/review-brief.md 並照做。只讀不改，結果寫 $S/out-$name.md，最後印 DONE-$name。" --wait --timeout 600000
herdr agent read "$name" --source recent-unwrapped --lines 40 | grep -q "DONE-$name" && cat "$S/out-$name.md"
herdr agent list | jq -r '.result.agents[] | select(.name=="'"$name"'") | .pane_id' | xargs -r herdr pane close
```

- `--wait` 回 `blocked` 是核准／提問畫面：`agent read` 看內容再問使用者，不要自己按。
- 派前後 `git status --porcelain` 比 diff，確認 agy 沒改檔。

## 5. brief 六段

寫到 `.claude/state/briefs/<slug>/task-N.md`，Agent tool 的 prompt 只給路徑加一句「讀它並照做」。六段缺 `Files` 或 `Verify` 就不派——缺了驗收無據。

| 段 | 寫什麼 |
| --- | --- |
| **目標** | 一句、可驗收 |
| **Files** | 允許改的檔案清單（glob 可）。worker 的 diff 必須是它的子集；要超出先停下回報 |
| **邊界** | 禁區（同波其他工單佔用的檔）、用到的獨佔資源（第 2 節清單）、唯讀者明寫只讀不改、MODEL／effort |
| **證據** | 每條附 `檔案:行號`，由 `Explore` 先找齊 |
| **Verify** | 驗收指令逐字，worker 跑、Lead 再跑一次。Stop hook 已涵蓋的 lint／typecheck／vitest 不重寫，寫的是這張工單特有的（某個 test 檔、`shot.mjs` 的某條、`board_test.gd`） |
| **產出** | report 寫到 `.claude/state/reports/<slug>/task-N.md`，四節：做了什麼／改了哪些檔／怎麼驗證／殘留問題 |

**ledger**（工單超過 3 張才啟用）：`.claude/state/progress/<slug>.md`，append-only，一張工單 APPROVED 就加一行 `Task N: complete (<agent>, <model>, <一句>)`；BLOCKED 也記。compact 或新 session 接手時先 `cat` 它，不回頭翻 report。

## 6. 額度紀律

- worker 預設 `sonnet` + `medium`；`opus high` 只給矩陣標粗體的難級格與被審查打回的實作。週上限逼近時 opus 格降 sonnet high，不停工。
- 預設走 Agent tool，不重載；真要 `claude -p`（每支約 14K）時追問走 `--resume`，相關小任務合併成一支 worker。
- 單點 grep Lead 自己做；多檔掃描派 `Explore`（haiku／sonnet low），不派實作 agent 去讀檔。
- web-verifier 的瓶頸是工具輸出量：叫它用 `shot.mjs` 的 JSON summary 回報，不要貼整頁 snapshot。
- 收工累加 `.total_cost_usd` 回報派了幾支。

## 7. 回收與硬性規則

- **驗收 = 三個機械檢查，Lead 不讀實作邏輯**：(1) brief 的 Verify 逐字再跑一次；(2) `git diff --name-only` ⊆ Files；(3) report 第 4 節殘留問題與 QUESTION 逐條看。三個都過 → APPROVED；任一不過 → 附上哪一條退回同一支（`SendMessage`／`--resume`）；**連兩次退回 → BLOCKED**，回報使用者，不換模型硬推。
- LLM 審查不逐工單做：難級工單在波尾派一次 `arch-security-reviewer` 看整波 diff，加 agy 第二意見；易／中級靠 hooks 與三檢查。agy 的結論仍套 `superpowers:receiving-code-review` 逐條核實再採納。
- 成品進 `src/`／`godot-*-src/` 只有兩條路：claude worker 寫、或 Lead 在直做門檻內套。
- agy 一律唯讀；要它改的東西改成產 patch 到 `$S`。
- 臨時檔只寫 `$S`，要留的寫 `.claude/state/`，兩者都不進 repo 根目錄或 `docs/`。不關不是自己開的 pane。
