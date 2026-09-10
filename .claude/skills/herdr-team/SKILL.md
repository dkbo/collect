---
name: herdr-team
description: 備援與第二意見——本專案派工主幹已是 dkbo（.dkbo/LEADER.md）；只在不在 herdr 內（$HERDR_ENV≠1）而 dk-* 跑不起來時，用這裡的 Agent tool 最小流程；另含 agy（gemini-3.8-flash-high、唯讀、免費額度）一次性第二意見語法與額度紀律。使用者提到「叫 agy」「第二意見」「不在 herdr 怎麼派」時適用。
---

# herdr-team（備援 + agy）

## 0. 先分流

```bash
.dkbo/bin/dk-whoami   # leader → 讀 .dkbo/LEADER.md，用 dk-* 派工，本 skill 到此為止
```

`dk-*` 全部 `dk_require_herdr`，`$HERDR_ENV` 不是 1 就 `dk: not running inside herdr` 退出。**只有這種情況**（沒開 herdr、或臨時在別的終端）才用第 1 節的備援；正常情況一律回 dkbo，不要兩套並用。

## 1. 備援：Agent tool 最小流程（不在 herdr 內）

規模限制：一次一張、單波、不開 worktree；超過就停下請使用者到 herdr 內開任務。

| 目錄 | subagent_type | model／effort（上限 opus high） |
| --- | --- | --- |
| `src/babylon/`、`src/pages/Battle/` | `babylon-game-dev` | sonnet high；跨 net／WebRTC 才 opus high |
| 其餘 `src/pages/`、`src/store/`、`src/components/`、`src/lib/` | `react-ui-dev` | sonnet medium／high |
| `godot-src/`、`godot-candy-src/` | `godot-dev` | sonnet high；改 bridge 協定 opus high |
| RpgRoom 地圖 JSON | `rpg-map-builder` | sonnet medium |
| build／lint／匯出 | `build-runner` | sonnet low |
| 截圖／`/battle` 多人 | `web-verifier` | sonnet medium |
| 架構／安全（唯讀） | `arch-security-reviewer` | opus high |
| 找檔、找慣例（唯讀） | 內建 `Explore` | haiku／sonnet low |

- brief 沿用 dkbo 語彙寫在 scratchpad：目標、可改檔案 glob（=所有權）、驗收標準、獨佔資源、報告要有 `## 測試`。缺可改檔案或驗收標準不派。
- 驗收三檢查：驗收指令重跑、`git diff --name-only` ⊆ 可改檔案、report 疑慮逐條看；連兩次退回 → BLOCKED 回報使用者。
- 唯讀 agent 可並行；改檔 agent 同時只一支（Stop hook 是整棵樹驗）。`haiku` 只准唯讀格。
- 不 commit；備援做完的改動留工作樹，由使用者回 herdr 後用 `dk-task-new --no-worktree` 或手動 commit 收。

## 2. agy 一次性第二意見

dkbo 內 agy 已是 `DK_REVIEW_KINDS` 的一員（`dk-review` 會開 pane，M 檔 `gemini-3.8-flash-medium`、L 檔 `gemini-3.1-pro-high`）。下面是**不開 pane、不綁任務**時的一次性用法（例如審一份計畫或 decisions）：

```bash
S=<scratchpad>
agy --model gemini-3.8-flash-high --sandbox --output-format json \
  -p="$(cat AGENTS.md "$S/review-brief.md")" > "$S/agy.json" 2>"$S/agy.err"
[ "$(jq -r .status "$S/agy.json" 2>/dev/null)" = SUCCESS ] && jq -r .response "$S/agy.json" || echo "無第二意見（agy 不可用）"
```

- `-p` 會把下一個參數吃成 prompt：必須 `-p="…"`，其他旗標放前面。
- 不帶 `--effort`：Flash 模型名已含等級，另帶會回 `invalid model selection`。
- `agy -p` 讀不到 `.agents/`，要它遵守的規範得 cat 進 prompt。空 prompt 約 14K token，合併成一支問。
- 只餵 diff／結論／計畫；Firebase 金鑰、`.env`、測試帳號不進 prompt。
- 沒額度就回報「本次無第二意見（agy 不可用）」照原流程走，不重試、不換模型、不找替身；任何任務不得依賴 agy 才能往下。結論仍套 `superpowers:receiving-code-review` 逐條核實。

## 3. 額度紀律（兩種通道都適用）

- 員工／worker 預設 sonnet；opus high 只給角色檔 L 檔（babylon、godot、reviewer、pm）與被審查打回的實作。週上限逼近時 `--tier M` 不停工。
- 實作前先派 `Explore` 把 `檔案:行號` 找齊寫進 brief，不拿實作模型讀檔找位置。
- qa／web-verifier 回 `shot.mjs` 的 JSON summary，不貼整頁 snapshot。
- 不派 `fable`／`xhigh`／`max`；不改 `.dkbo/kinds/claude.sh`。
