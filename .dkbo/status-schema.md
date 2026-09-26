# dk-status JSON schema（`schema_version` 1）

`dk-status --json` 印 **list 文件**（所有任務的摘要），`dk-status --json <任務>` 印 **detail 文件**（一個任務的完整記憶）。`<任務>` 可以是資料夾名（`YYYY-MM-DD-<短名>`）或短名（同短名有多個時取日期最晚的那個）。stdout 只有一行 JSON；exit 0 成功、1 找不到任務（stderr `dk: no task '<x>'`）、2 用法錯。

dk-status 只讀：不寫、不建、不刪任何檔，不呼叫 herdr，不需要在 herdr 裡跑。它讀的全是 `.dkbo/` 底下的檔：`VERSION`、`.sessions/kinds-down`、`tasks/INDEX.md`，以及每個任務資料夾的 `.task.env`、`brief.md`、`process.md`、`messages.log`、`state/*.md`、`.panes`、`.repos`。任一個檔不存在時對應欄位給 `null` 或 `[]`，不報錯。

## 相容規則

- **只加欄位不升 `schema_version`；改名、刪欄、改型別、改語意才升。**
- 消費端遇到不認識的欄位要忽略，不要因此報錯 —— 新版 dkbo 加了欄位，舊 dashboard 照樣能讀。
- 消費端應先看 `schema_version`：不認得的版本就別照舊解析。

## 三件要知道的事

1. **`kinds_down[].until` 是跑 dk-status 那台機器的本地時間**（`YYYY-MM-DDTHH:MM`，經 `dk_epoch_to_local` 換算，不帶時區）。dashboard 跑在別的時區、或要算倒數，請用 `until_epoch`（Unix 秒）。
2. **messages 內文含換行時，續行沒有時間戳**：`messages.log` 一則一行，內文若夾了換行，第二行起第 1 欄不是時間戳，會被略過並計進 `skipped_lines.messages`（那則訊息的 `text` 只有第一行）。`process.md` 同理計進 `skipped_lines.process`。空行也算一行被略過。
3. **閘門結果去 `events[]` 找**（對應 request 的「閘門狀態」）。`kind` 是 process 行第 2 欄去掉尾端冒號：
   - `wave-close`：`dk-wave-close` 的結果。`wave-close N tests ok (…) K agents closed` 是測試閘過、波關閉；`wave-close N tests failed (…)`（沒有 `agents closed`）是測試閘擋下、波沒關；帶 `agents closed` 的 `failed` 行是 `--force` 強關。各波的整理結果在 detail 的 `waves[].closed_at`／`tests`／`tests_ok`。
   - `violation`：所有權閘擋下的改動，`violation unowned: <路徑>` ＝ 這一波沒有任何成員可以改那個檔。
   - `unreported`：`unreported <路徑> (owner <成員>)` ＝ 成員改了自己擁有的檔、但 state 的 `touched` 漏報（只警告，不擋）。
   - `review`：審查閘。`review N spawned …`（派審）、`review N verdict …`（裁定，複看會有多則，取最後一則即 `waves[].review_verdict`）、`review N skipped: …`（本波不審）；`review task …` 是整枝評議。

## 時間戳

型別寫 `ts` 的欄位都是 `YYYY-MM-DDTHH:MM`（本地時間，同 `dk_now`），來源是 process.md／messages.log 行首。沒有來源就是 `null`，不是 0。

## list 文件

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `schema_version` | int | 否 | — | 本文件的版本，目前 1 |
| `dkbo_version` | str | 可 | `.dkbo/VERSION` | 內容去掉所有空白與換行；沒有檔就 `null` |
| `generated_at` | ts | 否 | 系統時鐘 | 產生這份 JSON 的時間（`dk_now`） |
| `kinds_down` | [kinds_down 項] | 否 | `.sessions/kinds-down` | 專案層熔斷中、恢復時間未到的 kind，依 `kind` 升冪；過期列不列 |
| `tasks` | [任務摘要] | 否 | `tasks/` | 每個符合 `YYYY-MM-DD-<短名>` 的資料夾一筆，依資料夾名升冪；不含 `_chores`、`BACKLOG.md` |

### kinds_down 項

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `kind` | str | 否 | kinds-down 第 1 欄 | 被熔斷的 kind（claude／codex／agy…） |
| `until` | str | 否 | 第 2 欄經 `dk_epoch_to_local` | 恢復時間，**本地時間** `YYYY-MM-DDTHH:MM` |
| `until_epoch` | int | 否 | 第 2 欄 | 恢復時間（Unix 秒），跨時區用這個 |
| `exact` | bool | 否 | 第 3 欄 | `true`＝從畫面解析到確切恢復時間；`false`＝猜的（現在＋5 小時） |
| `recorded_at` | str | 否 | 第 4 欄 | 記錄時間（`dk_now` 格式；欄缺則空字串） |
| `from_task` | str | 否 | 第 5 欄 | 記錄它的任務資料夾名 |
| `agent` | str | 否 | 第 6 欄 | 撞到額度的 agent 名 |
| `reason` | str | 否 | 第 7 欄起 | 命中的畫面文字 |

### 任務摘要

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `dir` | str | 否 | 資料夾名 | 任務資料夾名，也是 detail 模式可用的引數 |
| `short` | str | 否 | `.task.env` `DK_SHORT` | 短名；沒有 `.task.env` 就取資料夾名日期之後那段 |
| `display` | str | 可 | `.task.env` `DK_DISPLAY` | 顯示名稱 |
| `date` | str | 否 | 資料夾名 | `YYYY-MM-DD` |
| `status` | str | 否 | `tasks/INDEX.md` | `planning`／`running`／`done`／`abandoned`／`unknown`；取名稱欄等於 `display` 的那一列（`\|` 存成 `／`，同 `dk_index_set`），沒有那一列或狀態不在前四種就是 `unknown` |
| `index_note` | str | 可 | `tasks/INDEX.md` | 那一列的「一句結論」原文（常見 `—`、`merged <sha>`）；沒有那一列就 `null` |
| `branch` | str | 可 | `.task.env` `DK_BRANCH` | 任務分支 |
| `worktree` | str | 可 | `.task.env` `DK_WORKTREE` | 主 repo 的 worktree 路徑（結案後已刪） |
| `task_tab` | str | 可 | `.task.env` `DK_TASK_TAB` | 任務根 tab 的 herdr id，給 dashboard 對上即時狀態 |
| `repo_names` | [str] | 否 | `.repos` 第 1 欄 | 本任務的 repo 名，主 repo 在第一個；單 repo 是 `["main"]` |
| `current_wave` | int | 可 | `.task.env` `DK_WAVE` | 目前開著的波號；沒有開著的波就 `null` |
| `waves_planned` | int | 否 | `brief.md` 波次表 | 波次表裡不同波號的個數 |
| `waves_closed` | int | 否 | `process.md` | 有 `wave-close N tests … K agents closed` 行的不同波號個數 |
| `created_at` | ts | 可 | `process.md` | 第一筆 `task-new` |
| `gate1_at` | ts | 可 | `process.md` | 最後一筆 `gate1 approved`（關卡①放行） |
| `closed_at` | ts | 可 | `process.md` | 最後一筆 `task-close merged …`／`task-close in-tree …`／`task-close abandoned: …`；`merge-failed`、`local-changes:` 不算結案 |
| `close_result` | str | 可 | `process.md` | 同一行 `task-close ` 之後的原文（如 `merged 82bd82b`、`abandoned: <原因>`） |
| `updated_at` | ts | 可 | `process.md` | 最後一行合法時間戳 |
| `panes_open` | int | 否 | `.panes` | 列數（非空行）＝還開著的 pane 數 |
| `counts` | object | 否 | 見下 | 各類計數 |

`counts` 的鍵：

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `rulings` | int | 否 | `process.md` | 第 2 欄為 `ruling:` 的行數 |
| `autonomous_rulings` | int | 否 | `process.md` | 其中本文以 `[自主]` 開頭的行數（領導自主裁定） |
| `minors` | int | 否 | `process.md` | `minor: …`／`minor N: …` 行數（同 `dk_minor_count`） |
| `undelivered` | int | 否 | `messages.log` | `type` 為 `UNDELIVERED` 的訊息數 |
| `escalations` | int | 否 | `messages.log` | `type` 為 `ESCALATE` 的訊息數 |

## detail 文件

頂層鍵：`schema_version`、`dkbo_version`、`generated_at`、`kinds_down`（同 list）與 `task`。`task` 是任務摘要的所有欄位，再加下列九個：

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `task` | object | 否 | — | 任務摘要＋下列欄位 |
| `repos` | [object] | 否 | `.repos` | 每列一個 repo |
| `brief` | object | 否 | `brief.md` | 計畫內容；沒有 brief 時四個欄位是 `null`／`[]` |
| `waves` | [object] | 否 | `process.md`＋`brief.md` | 每一波的時間線；波號取 brief 波次表與 process `wave-open N` 的聯集，升冪 |
| `members` | [object] | 否 | `state/*.md` | 每個 state 檔一位（不含 `*.report.md`），依檔名升冪 |
| `panes` | [object] | 否 | `.panes` | 還開著的 pane |
| `rulings` | [object] | 否 | `process.md` | 裁定 |
| `events` | [object] | 否 | `process.md` | process 的每一個合法行 |
| `messages` | [object] | 否 | `messages.log` | 每一則解析得出的訊息 |
| `skipped_lines` | object | 否 | `process.md`＋`messages.log` | 被略過的行數 |

### `repos[]`

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `name` | str | 否 | `.repos` 第 1 欄 | repo 名（單 repo 是 `main`） |
| `path` | str | 可 | 第 2 欄 | repo 根的絕對路徑 |
| `worktree` | str | 可 | 第 3 欄 | 這個 repo 的任務 worktree |
| `base` | str | 可 | 第 4 欄 | 實體化當下的 base sha |

### `brief`

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `goal` | str | 可 | `## 目標` 段 | 非空行去頭尾空白、以 `\n` 串接 |
| `acceptance` | [object] | 否 | `## 驗收標準` 段 | 每條 `- [ ] …`／`- [x] …` 一項 |
| `owners` | [object] | 否 | `## 檔案所有權` 表 | 每位成員一項（範例列不算） |
| `waves` | [object] | 否 | `## 波次表` | 每列一項（範例列不算） |

表格切欄經 `lib/brief.sh`，欄內跳脫的 `\|` 還原成字面管線 `|`。

`brief.acceptance[]`：

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `text` | str | 否 | 驗收標準行 | `- [ ] ` 之後的原文 |
| `checked` | bool | 否 | 驗收標準行 | 方框是 `x`／`X` |

`brief.owners[]`：

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `member` | str | 否 | 成員欄 | 成員短名 |
| `writable` | [str] | 否 | 可改欄 | 逗號切開的 glob（多 repo 帶 `<名>:` 前綴）；`—` 或空給 `[]` |
| `readonly` | [str] | 否 | 只讀欄 | 同上 |
| `exclusive` | [str] | 否 | 獨佔資源欄 | 同上（`db`、`port:3000`…）；舊 brief 沒有這欄就 `[]` |

`brief.waves[]`：

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `wave` | int | 可 | 波欄 | 波號；不是整數就 `null` |
| `type` | str | 可 | 型態欄 | 實作／評議… |
| `member` | str | 可 | 成員欄 | 成員短名 |
| `what` | str | 可 | 做什麼欄 | 原文 |
| `tier` | str | 可 | 難度欄 | S／M／L |
| `done` | str | 可 | 完成條件欄 | 原文 |
| `review` | str | 可 | 審查欄 | `預設`、`skip: …`、`kinds: …`；空欄（非該波第一列）給 `null` |

### `waves[]`

時間戳的取法與 `dk-timeline` 相同（`dk_ts_pick`：第 2／3／4 欄逐欄相等的最後一筆）。

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `wave` | int | 否 | — | 波號 |
| `opened_at` | ts | 可 | `wave-open N` | 最後一筆開波（含 `wave-open N repo <名> base …`） |
| `dev_done_at` | ts | 可 | `dev-done wave N` | 最後一筆 dev 全員完成 |
| `review_spawned_at` | ts | 可 | `review N spawned` | 最後一筆派審 |
| `review_verdict_at` | ts | 可 | `review N verdict` | 最後一筆審查裁定（複看取最後一則） |
| `review_verdict` | str | 可 | 同上 | 最後一筆 `review N verdict ` 之後的原文；沒有而有 `review N skipped:` 時給 `skipped: …` 原文 |
| `closed_at` | ts | 可 | `wave-close N tests … K agents closed` | 最後一筆這種行；**波 N 算關閉 ⟺ 有這種行**（未強關的失敗行不帶 `agents closed`，不算） |
| `tests` | str | 可 | 同上 | 關閉行 `tests ` 與 ` K agents closed` 之間的原文（如 `ok (tests/run.sh)`）；未關閉就 `null` |
| `tests_ok` | bool | 可 | 同上 | `tests` 不含 `failed`；未關閉就 `null` |
| `commits` | [object] | 否 | `commit <sha> wave N[ repo <名>]` | 本波的 commit，略過 `commit failed` |

`waves[].commits[]`：

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `repo` | str | 可 | ` repo <名>` 後綴 | 多 repo 的 repo 名；單 repo 沒有後綴就 `null` |
| `sha` | str | 否 | commit 行 | 短 sha |

### `members[]`

state 檔是 `key: value` 行；`touched`／`todo` 收底下 `  - ` 開頭的項。

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `name` | str | 否 | 檔名 | state 名（去掉 `.md`） |
| `status` | str | 可 | `status:` | `working`／`blocked`／`done`（原文） |
| `wave` | int | 可 | `wave:` | 不是整數就 `null` |
| `current` | str | 可 | `current:` | 正在做什麼 |
| `touched` | [str] | 否 | `touched:` | 自報改過的檔；缺或 `[]` 給 `[]` |
| `todo` | [str] | 否 | `todo:` | 待辦；缺或 `[]` 給 `[]` |
| `blocked_by` | str | 可 | `blocked_by:` | 卡在什麼 |
| `notes` | str | 可 | `notes:` | 給接手者的事實；同鍵重複出現與其後縮排續行以 `\n` 串接 |
| `has_report` | bool | 否 | `state/<name>.report.md` | 報告檔是否存在 |

鍵缺或值為空給 `null`；同一個鍵出現多次時（`notes` 以外）取第一次。

### `panes[]`

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `agent` | str | 否 | `.panes` 第 1 欄 | agent 註冊名 |
| `pane` | str | 可 | 第 2 欄 | herdr pane id，給 dashboard 對上即時狀態 |
| `since_epoch` | int | 可 | 第 3 欄 | spawn 時間（Unix 秒）；legacy 兩欄格式為 `null` |
| `group` | str | 可 | 第 4 欄 | 角色群組（dev／review…）；legacy 為 `null` |
| `tab` | str | 可 | 第 5 欄 | tab 序號；legacy 為 `null` |
| `slot` | str | 可 | 第 6 欄 | tab 內的位置；legacy 為 `null` |

### `rulings[]`

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `ts` | ts | 否 | process 行首 | 裁定時間 |
| `text` | str | 否 | `ruling:` 之後 | 裁定原文 |
| `autonomous` | bool | 否 | 同上 | 本文以 `[自主]` 開頭 |

### `events[]`

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `ts` | ts | 否 | process 行首 | 時間 |
| `kind` | str | 否 | 第 2 欄 | 去掉尾端冒號（`ruling:` → `ruling`）；閘門相關的 `kind` 見上面「三件要知道的事」 |
| `text` | str | 否 | 整行 | 時間戳之後的整行原文 |

### `messages[]`

行格式 `<ts> <from> -> <to> [TYPE] 內文`，或 `<ts> <who> [ACK]`。

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `ts` | ts | 否 | 行首 | 時間 |
| `from` | str | 否 | 寄件人 | agent 註冊名 |
| `to` | str | 可 | 收件人 | `[ACK]` 行為 `null` |
| `type` | str | 否 | `[TYPE]` | `DONE`、`BUG`、`ESCALATE`、`ACK`…；`[UNDELIVERED] [DONE] …` 的 `type` 是 `UNDELIVERED` |
| `text` | str | 否 | `[TYPE] ` 之後 | 內文原文；`UNDELIVERED` 保留後面的 `[DONE] …`；`ACK` 為空字串 |

### `skipped_lines`

| 鍵 | 型別 | 可否 null | 來源 | 說明 |
|---|---|---|---|---|
| `process` | int | 否 | `process.md` | 第 1 欄不是 `YYYY-MM-DDTHH:MM` 的行數 |
| `messages` | int | 否 | `messages.log` | 第 1 欄不是時間戳、或解析不出寄件人／類型的行數（含內文換行造成的續行） |
