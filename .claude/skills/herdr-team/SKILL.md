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

以下 `$S` = 本 session 的 scratchpad 目錄。

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

每格都寫死 model 與 effort，不留給預設；agent frontmatter 的值是「難」級預設，易／中級派工時用 `--model`／`--effort` 往下調。`haiku` 不進矩陣：審查會給假安全感、寫檔容易反覆修；只允許在唯讀 worker 的 `--fallback-model` 尾端出現。

## 2. 通道：預設無頭，pane 只在三種情況

```
(a) 使用者要看它跑、或要直接跟它對話
(b) 多輪追問，且 claude 的 --resume 不夠用（agy 沒有 resume）
(c) agy 要讀專案 skill，且不想每次把 SKILL.md cat 進 prompt
```

## 3. claude worker（實測語法，沿用 sport-frontend-panova）

```bash
claude -p --model sonnet --effort medium --agent babylon-game-dev \
  --permission-mode acceptEdits \
  --output-format json "$(cat "$S/brief.md")" > "$S/out.json" 2>"$S/out.err"
jq -r '.subtype, .is_error, .total_cost_usd, .session_id, .result' "$S/out.json"
```

- 先驗 `.subtype == "success"` 且 `.is_error == false` 再讀 `.result`；`.permission_denials` 非空表示有動作被擋。
- `--agent` 與 `--json-schema` 互斥：帶 agent 時 `.result` 回 Markdown。
- 唯讀 worker 加 `--disallowedTools Edit Write NotebookEdit`。
- 寫檔 worker **不帶** `--fallback-model`（primary 是 opus 時最多 `--fallback-model sonnet`）；唯讀 worker 可 `sonnet,haiku`。
- 追問用 `claude -p --resume <session_id> "…"`，不重派。
- worker 的 Stop hook（`.claude/hooks/verify-on-stop.sh`）已在改過 `src/` 時跑 lint + typecheck + vitest、改過糖果時跑 board_test，Lead 不重跑；`pnpm build` 與 Godot 匯出仍派 `build-runner`。
- **同一棵樹同時只跑一支會寫檔的 worker**——多支會各自觸發 `verify-on-stop.sh` 並搶 `.claude/.hook-state/`。

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

## 5. brief 四段

`$S/brief-<角色>.md`：**目標**（一句、可驗收）／**邊界**（能碰哪些檔；唯讀者明寫只讀不改）／**證據**（每條附 `檔案:行號`）／**產出**（寫到哪個檔、什麼格式）。

## 6. 額度紀律

- worker 預設 `sonnet` + `medium`；`opus high` 只給矩陣標粗體的難級格與被審查打回的實作。週上限逼近時 opus 格降 sonnet high，不停工。
- 每次 `claude -p` 重載約 14K token：追問走 `--resume`，相關小任務合併成一支 worker。
- 單點 grep Lead 自己做；多檔掃描才派。
- 收工累加 `.total_cost_usd` 回報派了幾支。

## 7. 回收與硬性規則

- worker 與 agy 的結論都套 `superpowers:receiving-code-review` 逐條核實。成品進 `src/`／`godot-*-src/` 只有兩條路：claude worker 寫、或 Lead 在直做門檻內套。
- agy 一律唯讀；要它改的東西改成產 patch 到 `$S`。
- 產出檔只寫 `$S`。不關不是自己開的 pane。
