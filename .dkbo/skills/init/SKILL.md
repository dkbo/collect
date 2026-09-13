---
name: dkbo-init
description: 第一次在專案啟用 dkbo 時執行。偵測已安裝的 AI CLI、選領導與員工的工具、改寫角色檔的 kind 與三檔、佈線入口檔、預填 PROJECT.md、檢查 MCP 需求。
---
# dkbo init

逐步做，每步用 AskUserQuestion 或等人回答，一次問一題。

0. 前置檢查：`git status --porcelain .dkbo AGENTS.md CLAUDE.md .claude .agents`。有輸出就停下，請人先 commit（員工的 worktree 只看得到已 commit 的檔案）。
1. 偵測工具：執行 `bash -c '. .dkbo/lib/common.sh; . .dkbo/lib/kinds.sh; dk_kinds_available'`。對每個結果檢查登入狀態：`claude --version`、`codex login status`、`agy models | head -1`。列出可用者。
2a. 問**領導** kind：預設偵測目前 pane 正在跑的 CLI（`herdr agent get "$HERDR_PANE_ID"` 的 `agent` 欄；讀不到就用 claude），只列第 1 步可用且已登入者。寫進 `settings.env` 的 `DK_LEADER_KIND`。這只影響 `dk-leader` 開出的第二位領導用哪個工具與哪組旗標（它取該 kind `KIND_DEFAULT_TIERS` 的 L 檔）—— 你自己這一位領導是人啟動的，dkbo 開不出來也不會改它。
2b. 問**員工**主模型：預設 claude。若人選其他 kind，對 `.dkbo/roles/*.md` 每一檔：把 `kind:` 改成該 kind，並用 `.dkbo/kinds/<kind>.sh` 的 `KIND_DEFAULT_TIERS` 覆寫 `tiers:` 三檔（reviewer 沒有 S）。逐角色列出改後的值讓人確認或修改。同步更新 `.dkbo/roles/README.md` 的表。
3. 寫 `.dkbo/settings.env`（八鍵，所有值加引號）：`DK_LEADER_KIND`（第 2a 步的答案）、`DK_TEST_CMD`（從 PROJECT.md / package.json 等找測試指令，讓人確認；沒有就留空）、`DK_REVIEW_KINDS`（第二、第三意見工具：只列可用且已登入者，主模型放第一個，1 至 3 個，空白分隔）、`DK_REVIEW_MIN`（預設 1）、`DK_REVIEW_TIMEOUT_MIN`（預設 20）、`DK_TAB1_SLOTS`（4 或 6，看螢幕寬）、`DK_WAVE_TIMEOUT_MIN`（整波逾時分鐘，預設 60，0 表示關閉）、`DK_REVIEW_TIER`（reviewer 檔位 M 或 L，預設 M；問人要不要升 L —— reviewer 是唯讀單輪的短 context，加碼成本遠低於 dev pane，但先確認 `DK_REVIEW_KINDS` 已經有第二個 kind：換一個模型抓到的錯誤類別，跟同一個模型想得更久抓到的不是同一批）。逐鍵讓人確認。不再改寫 LEADER.md 的 prose。
3b. 入口檔佈線：`install.sh` 已寫好 `AGENTS.md`（`讀 .dkbo/ENTRY.md 並依其行事。`）與 `CLAUDE.md`（`@AGENTS.md`），但它跑在本 skill 之前、那時還不知道領導是誰，所以不會無條件生出其他入口檔。依 `DK_LEADER_KIND` 確保對應入口檔存在：`claude` → `CLAUDE.md`、`codex` → `AGENTS.md`（兩者 install 已做，只需確認）、`agy` → 建 `GEMINI.md` 一行 `讀 .dkbo/ENTRY.md 並依其行事。`。已存在就不動。`DK_REVIEW_KINDS` 裡的 kind 同樣要有入口檔（reviewer 也要讀得到 ENTRY.md）。
4. 預填 `.dkbo/PROJECT.md`：先讀既有的 `CLAUDE.md`、`AGENTS.md`、`.claude/rules/*.md`（若存在），從中抽技術棧、測試指令、慣例；再看 package.json / pyproject.toml / go.mod / Cargo.toml / Makefile 補齊。保持 ≤40 行，不重複既有指令檔已寫的規則，只寫事實。給人確認後存檔。
4b. 衝突掃描：比對既有指令檔與 `.dkbo/PROTOCOL.md`、`.dkbo/LEADER.md` 會打架的規則，至少查這幾類：要求使用 subagent 或平行 agent、要求直接 commit/push 到 main、禁止建分支或 worktree、要求每次改動都問人。逐條列出「既有規則 vs dkbo 規則」，讓人決定改哪一邊。不自動修改既有檔案。
5. MCP 檢查：對每個已選 kind 執行 `bash -c '. .dkbo/lib/common.sh; . .dkbo/lib/kinds.sh; dk_kind_load <kind>; kind_mcp_list'`，比對所有角色檔 `mcp:` 清單。缺的列出，並印出對應指令範本（`claude mcp add <name> -- <cmd>` / `codex mcp add <name> -- <cmd>` / `agy mcp add <name> <cmd>`）讓人自己執行。不要代寫含認證的設定。
6. 結束時列出：可用工具、領導 kind、員工主模型、settings.env 的七個值、已佈線的入口檔、PROJECT.md 行數、缺少的 MCP。
