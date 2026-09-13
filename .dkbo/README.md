# dkbo

以 herdr 為底的多模型 AI 團隊：一位領導（Claude Code）在主 pane 審查需求、拆波、派工、決策；員工（claude / codex / agy）各佔一個 pane 實作、測試、互相傳訊；所有記憶是小型 markdown，領導失憶可一鍵恢復。設計文件見原始 repo 的 docs/。

## 前置需求
- herdr ≥ 0.9.0（`herdr --version`），且你在 herdr 的 pane 裡（`echo $HERDR_ENV` 印 `1`）。版本不是只寫在文件上：`install.sh` 與每支 dk-* 都會驗。
- git ≥ 2.17、jq ≥ 1.5、bash 3.2+（macOS 內建的就夠）。`flock` 是軟依賴：缺了 `dk_env_set` 退化成無鎖寫入，不會崩。
- 至少一個 AI CLI：`claude` / `codex` / `agy`。領導這一側用哪個由 `settings.env` 的 `DK_LEADER_KIND` 決定（預設 `claude`，`/dkbo-init` 會問）；其餘當員工與第二、第三意見。
- 目標專案是 git repo，且工作樹乾淨。

## 給 AI 的一鍵安裝
把下面整段貼給在 herdr 內、目標專案根目錄開啟的 Claude Code（或任何能跑 bash 的 agent）：

> 請在目前專案安裝 dkbo。依序執行以下指令，任何一步失敗就停下回報，不要自行變通：
>
> ```bash
> test "$HERDR_ENV" = 1 || { echo "不在 herdr 內，請先用 herdr 開啟終端"; exit 1; }
> herdr --version && command -v jq git claude >/dev/null || { echo "缺少 herdr/jq/git/claude"; exit 1; }
> git status --porcelain | grep -q . && { echo "工作樹不乾淨，請先 commit 或 stash"; exit 1; }
> REPO=https://github.com/dkbo/dkbo-team.git   # fork 的話改這裡
> VER=v0.5.1   # 要裝的版本；看 https://github.com/dkbo/dkbo-team/tags
> tmp=$(mktemp -d) && git clone -q --depth 1 --branch "$VER" "$REPO" "$tmp" && cp -r "$tmp/.dkbo" ./.dkbo && rm -rf "$tmp"
> .dkbo/install.sh
> git add -A && git commit -m "chore: add dkbo"
> .dkbo/bin/dk-whoami   # 預期印出 leader
> ```
>
> 全部成功後執行 `/dkbo-init`，依它的提問完成初始化。

預期輸出的最後兩行：
```
dkbo 0.5.1 installed into /path/to/project
leader
```

## 手動安裝（同一件事拆開）
1. 複製 `.dkbo/` 到專案根目錄。
2. `.dkbo/install.sh`：在 `.claude/skills/` 與 `.agents/skills/` 建 `dkbo-init`、`dkbo-add-role` 兩個 symlink；在 `AGENTS.md` 尾端追加一行指向 `.dkbo/ENTRY.md`；在 `CLAUDE.md` 尾端追加 `@AGENTS.md`（CLAUDE.md 若是 AGENTS.md 的 symlink 則略過）；`.gitignore` 加 `.dkbo/.sessions/`。既有內容一律不動。
3. `git add -A && git commit`。員工在 worktree 工作，只看得到已 commit 的檔案，這步不能省。
4. 在 herdr 內的 Claude Code 執行 `/dkbo-init`：偵測已裝的 AI CLI、選主模型與第二三意見、改寫角色檔的 model/effort、預填 `.dkbo/PROJECT.md`、掃描既有 CLAUDE.md / AGENTS.md 與 dkbo 規則的衝突、檢查 MCP 需求。

## 驗證
```bash
.dkbo/bin/dk-whoami            # leader
.dkbo/bin/dk-version           # dkbo 0.5.1
ls -l .claude/skills .agents/skills | grep dkbo   # 四個 symlink
tail -1 AGENTS.md CLAUDE.md     # 分別是入口行與 @AGENTS.md
```

## 日常使用
- 開任務：對領導說「開任務 login，顯示名『使用者登入』，需求是…」。領導會寫 brief 給你確認（關卡①）、分波派工、員工升報時問你（關卡②）、結案時給你 report 拍板（關卡③）。
- 雜務：對領導說「翻譯 README 成英文」「先修登入頁那個 bug」。領導評估後派一位員工，不自己動手。
- 領導失憶：在領導 pane `/clear`，然後說「執行 .dkbo/bin/dk-resume 然後繼續」。
- 想知道現在做到哪：隨時跑 `dk-resume`，它印的本波、裁定、未處理訊息、各員工 state 與在線員工就是狀態總覽，不必等失憶才用。
- 第二位領導：在任何 herdr shell 執行 `.dkbo/bin/dk-leader pay "金流"`。它的 kind 取 `DK_LEADER_KIND`，model/effort 取該 kind `KIND_DEFAULT_TIERS` 的 L 檔；`--kind` / `--model` / `--effort` 可逐次覆寫。
- 新角色：`/dkbo-add-role`。
- 每波自動附審查：dev DONE 後領導派 1–3 位 reviewer（kind 依 `.dkbo/settings.env` 的 `DK_REVIEW_KINDS`，檔位依 `DK_REVIEW_TIER`，預設 M）與 qa 並行；wave-close 會檢查裁定、每位 dev 的 report、`DK_TEST_CMD`，以及拿 worktree 的真實 git diff 比對本波的檔案所有權（沒人擁有的檔一律不放行），四道全過才關 pane 並在 worktree 內 commit 這一波。純文件波在 brief 審查欄寫 `skip: <理由>`。
- 人多時的版面：領導在 tab 1 左欄，員工填右側 2×2（或 3×2）；第 5 位起自動開 `<short>-2` 等 tab，每 tab 6 位。

## 目錄
| 路徑 | 用途 |
|---|---|
| `ENTRY.md` | 唯一入口，決定你是領導或員工 |
| `LEADER.md` / `PROTOCOL.md` | 領導規範 / 通訊協定與升報規則 |
| `roles/` | 角色檔（kind、S/M/L 三檔、職責） |
| `kinds/` | 各 AI CLI 的旗標對應 |
| `bin/` | `dk-*` 腳本，全部封裝 herdr |
| `tasks/<日期-短名>/` | 一個任務的全部記憶：brief、process、report、messages.log、state/ |
| `tasks/INDEX.md`、`tasks/BACKLOG.md`、`decisions.md`、`PROJECT.md` | 跨任務記憶 |

## 更新 dkbo
只更新核心，保留你的 `tasks/`、`PROJECT.md`、`decisions.md` 與自訂角色：
先用 .dkbo/bin/dk-version 看目前版本，再到 tags 頁挑要升的版本。
```bash
VER=v0.5.1 && tmp=$(mktemp -d) && git clone -q --depth 1 --branch "$VER" https://github.com/dkbo/dkbo-team.git "$tmp"
rsync -a --exclude=tasks --exclude=PROJECT.md --exclude=decisions.md --exclude='roles/*' --exclude=.sessions --exclude=settings.env --exclude=LEADER.md "$tmp/.dkbo/" ./.dkbo/   # LEADER.md 略過，因為 /dkbo-init 已依你的專案客製過
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
| codex / agy 不照協定回訊 | 確認 `AGENTS.md` 最後一行是入口行，且該 worktree 分支含這個 commit。 |
| 領導自己開始寫程式 | 提醒它讀 `.dkbo/LEADER.md`；必要時 `/clear` 後 `dk-resume`。 |
| 領導收到 `[TIMEOUT]` | reviewer 超過 `DK_REVIEW_TIMEOUT_MIN` 沒 DONE，多半是該 CLI 用量到頂（訊息含 rate limit / quota / 429 / usage limit 會標 `(quota?)`）。該 kind 本任務內熔斷；領導 `dk-wave-close --agent <reviewer>` 後照 LEADER.md 補位。 |
| `dk-wave-close` 拒絕 | 印出的每一條都是缺的東西：裁定行、dev 的 `## 測試`、測試失敗、`unowned change`（本波改了沒人擁有的檔）。補齊再跑；真要跳過用 `--force` 並在 process 記理由。 |
| 跑了 `git clean -xdf` 之後雜務關不掉 | `.dkbo/.sessions/chores/<agent>` 是正在跑的雜務的身分證，因為是 gitignored 所以 `git clean -xdf` 會把它連同其他忽略檔一起清掉；雜務本身（pane、worktree、branch）沒事，但 `dk-chore-close` 從此找不到它。復原：`dk-chore-close <agent> --abandon`（清掉 pane、worktree、branch，不 merge）。 |
