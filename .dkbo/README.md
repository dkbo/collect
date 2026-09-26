# dkbo

以 herdr 為底的多模型 AI 團隊：一位領導（Claude Code）在主 pane 審查需求、拆波、派工、決策；員工（claude / codex / agy）各佔一個 pane 實作、測試、互相傳訊；所有記憶是小型 markdown，領導失憶可一鍵恢復。設計文件見原始 repo 的 docs/。

## 前置需求
- herdr ≥ 0.9.0（`herdr --version`），且你在 herdr 的 pane 裡（`echo $HERDR_ENV` 印 `1`）。版本不是只寫在文件上：`install.sh` 與每支 dk-* 都會驗。
- git ≥ 2.17、jq ≥ 1.5、bash 3.2+（macOS 內建的就夠）。`flock` 是軟依賴：缺了 `dk_env_set` 退化成無鎖寫入，不會崩。
- 至少一個 AI CLI：`claude` / `codex` / `agy`。領導這一側用哪個由 `settings.env` 的 `DK_LEADER_KIND` 決定（預設 `claude`，`/dkbo-init` 會問）；其餘當員工與第二、第三意見。
- 目標專案是 git repo，且工作樹乾淨。

## 多 repo 專案（前後端分倉）
`settings.env` 的 `DK_REPOS` 空字串是單 repo 模式（既有行為不變）；設了它（`/dkbo-init` 會問，見「日常使用」的交棒段），一個任務就會對每個 repo 各切一個 worktree。前端 repo 通常要裝依賴才能跑測試，用 `DK_SETUP_CMD`／`DK_SETUP_CMD_<名>` 這個鉤子，在每個 worktree 切好之後、乾淨環境裡各跑一次，建議寫法：
```bash
DK_SETUP_CMD="pnpm install --frozen-lockfile --prefer-offline"
```
`--frozen-lockfile` 不讓安裝過程改寫 lockfile，`--prefer-offline` 讓 pnpm 的 content-addressable store 盡量用本機已有的套件做 hardlink，一個新 worktree 的安裝多半幾秒內完成。兩個坑：
1. `git worktree add` **不會複製 `node_modules`**（它是 gitignored）——每個 worktree 都要自己裝一次，這正是 `DK_SETUP_CMD` 存在的理由，不要以為漏掉這步也沒關係。
2. **不要 symlink 主樹的 `node_modules`** 省裝依賴的時間：任務分支改了 lockfile 時，worktree 會透過 symlink 拿到主樹當下的舊依賴而不是自己 lockfile 對應的版本；而且 symlink 出來的 `node_modules` 會變成全隊共用的執行環境，一個任務裝壞的套件會波及其他 worktree。鉤子失敗只警告不 rollback，log 在 `tasks/<t>/setup.<名>.log`。

## 給 AI 的一鍵安裝
把下面整段貼給在 herdr 內、目標專案根目錄開啟的 Claude Code（或任何能跑 bash 的 agent）：

> 請在目前專案安裝 dkbo。依序執行以下指令，任何一步失敗就停下回報，不要自行變通：
>
> ```bash
> test "$HERDR_ENV" = 1 || { echo "不在 herdr 內，請先用 herdr 開啟終端"; exit 1; }
> herdr --version && command -v jq git claude >/dev/null || { echo "缺少 herdr/jq/git/claude"; exit 1; }
> git status --porcelain | grep -q . && { echo "工作樹不乾淨，請先 commit 或 stash"; exit 1; }
> REPO=https://github.com/dkbo/dkbo-team.git   # fork 的話改這裡
> VER=v0.17.0   # 要裝的版本；看 https://github.com/dkbo/dkbo-team/tags
> tmp=$(mktemp -d) && git clone -q --depth 1 --branch "$VER" "$REPO" "$tmp" && (cd "$tmp/.dkbo" && rm -rf tasks decisions.md PROJECT.md settings.env .sessions) && cp -r "$tmp/.dkbo" ./.dkbo && rm -rf "$tmp"
> .dkbo/install.sh
> git add -A && git commit -m "chore: add dkbo"
> .dkbo/bin/dk-whoami   # 預期印出 leader
> ```
>
> 全部成功後執行 `/dkbo-init`，依它的提問完成初始化。

預期輸出的最後兩行：
```
dkbo 0.17.0 installed into /path/to/project
leader
```

## 手動安裝（同一件事拆開）
1. 複製 `.dkbo/` 到專案根目錄，但先拿掉 `tasks/`、`decisions.md`、`PROJECT.md`、`settings.env`、`.sessions/`：那是源碼倉 dkbo 自己的開發紀錄與設定，不是你專案的（與「更新 dkbo」的 rsync 排除同一組）。
2. `.dkbo/install.sh`：在 `.claude/skills/` 與 `.agents/skills/` 建 `dkbo-init`、`dkbo-add-role`、`dkbo-brain`、`dkbo-plan`、`dkbo-run` 五個 symlink；在 `AGENTS.md` 尾端追加一行指向 `.dkbo/ENTRY.md`；在 `CLAUDE.md` 尾端追加 `@AGENTS.md`（CLAUDE.md 若是 AGENTS.md 的 symlink 則略過）；`.gitignore` 加 `.dkbo/.sessions/`；`tasks/INDEX.md`、`tasks/BACKLOG.md`、`decisions.md`、`PROJECT.md`、`settings.env` 缺的才從 `templates/seed/` 補空白版。既有內容一律不動。
3. `git add -A && git commit`。員工在 worktree 工作，只看得到已 commit 的檔案，這步不能省。
4. 在 herdr 內的 Claude Code 執行 `/dkbo-init`：偵測已裝的 AI CLI、選主模型與第二三意見、改寫角色檔的 model/effort、預填 `.dkbo/PROJECT.md`、掃描既有 CLAUDE.md / AGENTS.md 與 dkbo 規則的衝突、檢查 MCP 需求。

## 驗證
```bash
.dkbo/bin/dk-whoami            # leader
.dkbo/bin/dk-version           # dkbo 0.17.0
ls -l .claude/skills .agents/skills | grep dkbo   # 十個 symlink
tail -1 AGENTS.md CLAUDE.md     # 分別是入口行與 @AGENTS.md
```

## 日常使用
沒叫 skill 時，dkbo 不會啟動 —— 在專案裡開一個 session 就是一個普通的 session。要用才叫：斜線指令只有 claude 有，領導若是 codex 或 agy（`DK_LEADER_KIND`），沒有斜線指令可打，改指名對應的 SKILL.md：`.dkbo/skills/plan/SKILL.md`、`.dkbo/skills/run/SKILL.md`、`.dkbo/skills/brain/SKILL.md`。
- 開任務：`/dkbo-plan`，然後說「開任務 login，顯示名『使用者登入』，需求是…」。它會寫 `request.md`、`brief.md`，`dk-brief-check` 過了才進入審查；接著 `dk-brief-review` 派 2 到 3 個不同 kind 讀需求原文與 brief，領導裁定並改完 brief，才把三份（需求原文、brief、裁定摘要）給你確認（關卡①）後停下來；你確認完叫 `/dkbo-run` 開始分波派工，開跑後不再停下來問你（員工升報由領導自己裁定，記 `ruling: [自主]`），結案時給你 report 拍板（關卡③），裡面列出這些自主裁定供你複核。
- 交棒（0.11.0 起）：`dk-task-new` 只建任務資料夾，不切 worktree、不開 tab——計畫完可能不做，不先付那些成本。你叫 `/dkbo-run` 的那一刻，`dk-leader <short> --run` 才把任務「實體化」：對 `settings.env` 的 `DK_REPOS` 每個 repo 各切一個 `dk/<short>` 的 worktree、跑一次 `DK_SETUP_CMD` 依賴鉤子、用 `herdr tab create` 在你叫 `/dkbo-run` 當下所在的 workspace（`HERDR_WORKSPACE_ID`；空時退回 `.task.env` 的 `DK_WORKSPACE`，兩者不同時回寫它並記 process）開一個 label `dk/<short>` 的任務根 tab，並在它的根 pane 起一位執行領導交棒——你這個 session 的任務就結束了，員工格子從此填在那個 tab，你的 session 可以空出來開下一個 `/dkbo-plan`。單 repo 專案（`DK_REPOS` 是空字串）一樣走開 tab 與交棒，只是只切一個 worktree。任何一步在 agent 起來之前失敗都會整組 rollback（worktree、分支、tab、`.task.env`），重跑 `--run` 是幂等的。
- 雜務與諮詢：`/dkbo-brain`，然後說「翻譯 README 成英文」「先修登入頁那個 bug」「這個設計該走哪條路」。它評估後派一位員工或給你三選一，不自己動手。
- 領導失憶：在領導 pane `/clear`，然後叫 `/dkbo-run`（它第一步就是 `dk-resume`）。
- 想知道現在做到哪：隨時跑 `.dkbo/bin/dk-resume`，不必先叫 skill —— 它是唯讀看板，開頭就印任務與本波已進行多久、每位員工等了幾分鐘。
- 想知道時間花在哪：`.dkbo/bin/dk-timeline [<任務>]` 從 process.md 算出每波開了多久、dev 多久、審查多久，印一張 markdown 表。只讀、零 token；結案時 `dk-task-close` 會自動把它附進 `report.md` 的「## 時間」段。
- 給 dashboard 讀：`.dkbo/bin/dk-status --json [<任務>]` 唯讀輸出任務記憶的 JSON，schema 見 `.dkbo/status-schema.md`；細節見下方「給 dashboard 讀的 JSON」。
- 新角色：`/dkbo-add-role`。
- 第二位領導：在任何 herdr shell 執行 `.dkbo/bin/dk-leader pay "金流"`。它的 kind 取 `DK_LEADER_KIND`，model/effort 取該 kind `KIND_DEFAULT_TIERS` 的 L 檔；`--kind` / `--model` / `--effort` 可逐次覆寫。
- 每波自動附審查：dev DONE 後領導派 1–3 位 reviewer（kind 依 `.dkbo/settings.env` 的 `DK_REVIEW_KINDS`，檔位依 `DK_REVIEW_TIER`，預設 L）與 qa 並行；wave-close 會檢查裁定、每位 dev 的 report、`DK_TEST_CMD`，以及拿 worktree 的真實 git diff 比對本波的檔案所有權（沒人擁有的檔一律不放行），四道全過才關 pane 並在 worktree 內 commit 這一波。純文件波在 brief 審查欄寫 `skip: <理由>`。
- 波中改 brief：`dk-wave-open <N> --refresh` 依當下 brief 重產第 N 波所有成員的切片並重算整波逾時，不動 base、不重派；改完再 `dk-msg <員工> "[TASK] 重讀切片"`。
- 專案層熔斷：`dk-kind` 看跨任務仍在熔斷的 kind 與恢復時間，`dk-kind up <k>` 解除；從畫面、CLI 狀態列、前一個任務的 ruling 或別人口中確認某 kind 額度耗盡，當下 `dk-kind down <k> [--until YYYY-MM-DDTHH:MM] [--note <文字>]` 登記（沒給 `--until` 就猜現在＋5 小時），下一次派 reviewer 或員工就會跳過它。
- 結案：`dk-task-close` 合併回主分支；任務 tab 不自動關（最後一行印 `herdr tab close <id>`），看完 report 自己關。
- 人多時的版面：領導在 tab 1 左欄，員工填右側 2×2（或 3×2）；第 5 位起自動開 `<short>-2` 等 tab，每 tab 6 位。

## 給 dashboard 讀的 JSON
`dk-status` 把 `.dkbo/tasks/` 的任務記憶（INDEX、`.task.env`、brief、process、messages、state、`.panes`、`.repos`）與專案層 kinds-down 轉成 JSON，給另一個 repo 的 dashboard 讀，dashboard 不必自己解析 markdown。兩種用法：

```
.dkbo/bin/dk-status --json            # list：全部任務的摘要（依資料夾名升冪）＋未過期的 kinds_down
.dkbo/bin/dk-status --json login      # detail：單一任務（資料夾名或短名；短名取日期最晚的）的完整內容
```

stdout 是單行 JSON，exit 0；找不到任務 exit 1，用法錯 exit 2。它只讀檔：不呼叫 herdr、不寫任何檔、不看 session 綁定，在 herdr 外照樣能跑；即時狀態由 dashboard 自己訂 herdr events，用 `panes[].pane` 對上。相容規則：只加欄位不升 `schema_version`，改名、刪欄、改型別、改語意才升；消費端遇到不認識的欄位要忽略。每個鍵的型別、來源與說明見 [status-schema.md](status-schema.md)。

## 目錄
| 路徑 | 用途 |
|---|---|
| `ENTRY.md` | 唯一入口，`dk-whoami` 認身分；領導要自己叫 skill 才啟動 |
| `LEADER.md` / `PROTOCOL.md` | 領導共同規範 / 通訊協定與升報規則 |
| `skills/` | `init`、`add-role`，與 `brain`／`plan`／`run` 三篇階段規範 |
| `roles/` | 角色檔（kind、S/M/L 三檔、職責） |
| `kinds/` | 各 AI CLI 的旗標對應 |
| `bin/` | `dk-*` 腳本，全部封裝 herdr |
| `tasks/<日期-短名>/` | 一個任務的全部記憶：request.md、brief、process、report、messages.log、state/ |
| `tasks/INDEX.md`、`tasks/BACKLOG.md`、`decisions.md`、`PROJECT.md` | 跨任務記憶 |

## 更新 dkbo
只更新核心，保留你的 `tasks/`、`PROJECT.md`、`decisions.md` 與自訂角色：
先用 .dkbo/bin/dk-version 看目前版本，再到 tags 頁挑要升的版本。
```bash
VER=v0.17.0 && tmp=$(mktemp -d) && git clone -q --depth 1 --branch "$VER" https://github.com/dkbo/dkbo-team.git "$tmp"
rsync -a --exclude=tasks --exclude=PROJECT.md --exclude=decisions.md --exclude='roles/*' --exclude=.sessions --exclude=settings.env "$tmp/.dkbo/" ./.dkbo/
rsync -a --ignore-existing "$tmp/.dkbo/roles/" ./.dkbo/roles/   # 只補新角色，不覆蓋既有
rm -rf "$tmp" && .dkbo/install.sh && git add -A && git commit -m "chore: update dkbo"
```

## 疑難排解
| 症狀 | 原因 / 處理 |
|---|---|
| `dk: not running inside herdr` | 不是從 herdr 的 pane 執行。`herdr` 開啟終端後再試。 |
| 員工 pane 說找不到 `.dkbo/` | 安裝後沒 commit，worktree 看不到。commit 後重新 `dk-spawn`。 |
| 員工卡住不動 | 卡在審批對話框。dk-watch 會通知（任務員工與雜務員工都會）；切到該 pane 按同意，或檢查 `kinds/<kind>.sh` 的免審批旗標。 |
| `herdr 0.8.x is older than the 0.9.0 dkbo needs` | dkbo 對 herdr 的 JSON 形狀與 `--ratio`／`--amount` 語義是實測 0.9.0 得到的，舊版會讓版面歪掉、watcher 靜靜失效，所以直接拒跑。升級 herdr。 |
| `herdr X is newer than the 0.9.x series dkbo verified` | 只是提醒，照跑。跑一次 `tests/integration/herdr-real.sh`（零 token）確認形狀沒變，沒問題就把 `.dkbo/lib/common.sh` 的 `DK_HERDR_VERIFIED` 往上調。 |
| 想確認守望還在 | 跑 `dk-resume` 看 `watch:` 那行，或 `dk-watch --ensure`（幂等，死了就重啟）。雜務那一側是 `dk-watch --chores --ensure`，pid 記在 `.dkbo/.sessions/chores.watch.pid`。 |
| 新任務一派 reviewer 就跳過某個 kind | `dk-watch` 判定撞額度、專案層熔斷還沒恢復。`dk-kind` 看清單與恢復時間，`dk-kind up <k>` 解除；不要叫員工自己跑，命中行會印在他畫面上。 |
| codex / agy 不照協定回訊 | 確認 `AGENTS.md` 最後一行是入口行，且該 worktree 分支含這個 commit。 |
| 領導自己開始寫程式 | 提醒它讀 `.dkbo/LEADER.md` 與當前階段那篇（`skills/{brain,plan,run}/SKILL.md`）；必要時 `/clear` 後重新叫該 skill。 |
| 領導收到 `[TIMEOUT]` | reviewer 超過 `DK_REVIEW_TIMEOUT_MIN` 沒 DONE，多半是該 CLI 用量到頂（訊息含 rate limit / quota / 429 / usage limit 會標 `(quota?)`）。訊息寫「逾時但仍在工作（未熔斷）」的是它還在寫，照常等；一般的 `[TIMEOUT]` 表示該 kind 本任務內熔斷，領導 `dk-wave-close --agent <reviewer>` 後照 `skills/run/SKILL.md` 補位（再跑 `dk-review --kinds <k>`）。「閒置 N 分鐘未交」是 dev／qa 停著沒交，不熔斷，先看 messages.log 有沒有它在等的訊息。 |
| 領導收到 `[LIMIT]` | `dk-watch` 判定撞額度：先讀 `.blocked/<員工>.limit` 的 `hit:` 行（或 `herdr agent read`）確認不是誤判；真的撞到會同時寫進跨任務的專案層熔斷檔，讓下一個任務自動跳過該 kind，誤判用 `dk-kind up <k>` 解除。 |
| `dk-wave-close` 拒絕 | 印出的每一條都是缺的東西：裁定行、dev 的 `## 測試`、測試失敗、`unowned change`（本波改了沒人擁有的檔）。補齊再跑；真要跳過用 `--force` 並在 process 記理由。 |
| 跑了 `git clean -xdf` 之後雜務關不掉 | `.dkbo/.sessions/chores/<agent>` 是正在跑的雜務的身分證，因為是 gitignored 所以 `git clean -xdf` 會把它連同其他忽略檔一起清掉；雜務本身（pane、worktree、branch）沒事，但 `dk-chore-close` 從此找不到它。復原：`dk-chore-close <agent> --abandon`（清掉 pane、worktree、branch，不 merge）。 |
| `dk-task-close` exit 3 | 多 repo 的預檢有 repo 衝突：訊息列出全部衝突的 repo，**一個 repo 都還沒合併**。去衝突的 repo 手動解，或開一個 it 修復波，解完重跑 `dk-task-close`。 |
| `dk-task-close` exit 4 | 預檢都過了，真的合併時中途失敗：訊息印 merged／failed／not attempted 三份清單，已合併的 repo **不會**自動回捲（`merge --abort` 只救得了正在合併的那一個）。先看 failed 的那個 repo 出了什麼事，修好後對還沒合的 repo 補跑合併，不要整個重跑。 |
| `dk-task-close` exit 5 | 主樹（不是 worktree）有會被覆蓋的本地變更：先 commit 或 stash 主樹自己的改動，跟任何 repo 的合併衝突無關。 |
| 任務結束了但側邊欄還留著那個 tab | 這是設計行為，不是 bug：`dk-task-close` 不會呼叫 `herdr tab close`，因為執行領導自己就住在那個 tab 的根 pane 上，結案指令的最後一行會印 `herdr tab close <DK_TASK_TAB 的值>` 提醒你——看完 report 自己手動關即可。 |
