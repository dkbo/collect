---
name: dkbo-run
description: 只在使用者明確要求啟動 dkbo 團隊流程（或明確指名本篇）時使用。dkbo 執行階段。從 dk-resume 認清現場開始，開波、派工、收 DONE、派審查、裁定、處理 ESCALATE 與各種故障，最後整分支評議、結案合併。
---
# dkbo 執行

先讀 `.dkbo/LEADER.md`，再照本篇。

## 第 0 步：交棒（每次進本篇先看這一條）
`.task.env` 的 `DK_WORKTREE` 為空（任務還沒實體化）或 `HERDR_PANE_ID` 不等於 `DK_ROOT_PANE`（你不是任務根 tab 根 pane 上的執行領導）：跑 `dk-leader <short> --run`，然後**結束這個 turn**。它會切 worktree、跑 `DK_SETUP_CMD` 依賴鉤子、用 `herdr tab create` 在任務所屬的 workspace（計畫時記下，`.task.env` 的 `DK_WORKSPACE`，退路 `HERDR_WORKSPACE_ID`）開一個 label 為 `dk/<short>` 的任務根 tab、在它的根 pane 起執行領導並改綁 `.sessions`；`agent start` 之前任一步失敗會把 worktree、分支、tab 與 `.task.env` 全部還原，重跑是幂等的。交棒之後人的 session 不再是領導，員工的訊息都送到執行領導那裡（人要看進度用 `dk-resume <任務>`，唯讀）。

## 每次醒來先做
1. 若不確定狀態：執行 `dk-resume`，讀完再行動。它印 brief、本波（base、reviewer 狀態、熔斷）、watcher 狀態、裁定、未處理訊息、每 tab 的員工。watcher 有兩行：`watch: …`（30 秒輪詢）與 `events: …`（herdr 事件訂閱，畫面一冒出審批或額度就動）。兩條是獨立的命脈，一條死了另一條還在；死了 dk-resume、dk-wave-open、dk-spawn 都會就地重啟，你不用手動管。本波段開頭兩行是時間（任務已進行、本波已進行），在線員工每位附「等了 N min」——「該不該催」不必再憑感覺。
2. 想看整張時間表（每波開了多久、dev 多久、審查多久）：`dk-timeline [<任務>]`。只讀 process.md、零 token、不寫任何檔，隨時可跑；結案時 `dk-task-close` 會自動把它附進 `report.md` 的「## 時間」段，你不用手抄。
3. 送 `[TASK]`／`[DECISION]` 前，先讀 messages.log 裡未 ack 的訊息（`dk-msg` 會自動提示未 ack 則數）。

## 跑一波
1. `dk-wave-open N`：記 base sha、寫每位成員的切片 `briefs/<成員>.md`（員工只讀切片）。
2. 對該波每位成員 `dk-spawn <角色> [別名] [--tier S|M|L] [--kind K] [--isolated]`。先派 dev 再派 qa，版面才會照 tab 填。結束這個 turn，閒置。員工訊息與人的輸入會自己推進來。不輪詢、不主動讀員工終端。
3. 收到 dk-watch 的 `[DONE] wave N dev 全員完成`（dev 逐筆的 `[DONE]` 只落盤在 `messages.log`，不再逐筆叫醒你；聚合的觸發條件就是每位 dev 的 state 都寫了 `status: done`。要看個別回報就翻 `messages.log`，`dk-resume` 也會印。仍要確認 `state/<成員>.report.md` 有 `## 測試`）：`dk-review-pack N` 再 `dk-review`。reviewer 與 qa 並行，不必等 qa。
4. 收到 reviewer `[DONE]`：讀 `state/reviewer-<x>.report.md`。達 `DK_REVIEW_MIN` 且無 Important，或所有 reviewer 皆回覆，即裁定：`dk-process "review N verdict a: ok / b: important 2"`，再記 `ruling:`（格式見 `.dkbo/LEADER.md` 的「裁定」段）。reviewer 的 Minor 逐條 `dk-process "minor N: <一句> <file:line>"`（格式需對齊 `dk-review` 讀它的正規表示式），整枝評議時才會 triage。有 Important → `dk-msg <dev> "[BUG] review: …"` 指向 reviewer 的 report；dev `[FIXED]` 後重跑 `dk-review-pack N`，`dk-msg <reviewer> "[TASK] 複看 waves/N.diff"`。同一 bug 兩輪上限照 PROTOCOL：第一輪回原 dev，再驗仍失敗就 `dk-spawn <角色> <別名> --handoff "<原因>"` 換 kind（挑沒進 `DK_KIND_DOWN` 的）或升 `--tier L`，第三次才升關卡②。`--handoff` 會自己把 ruling 寫進 process.md，你不用另外記。
5. qa `[DONE]` 且審查已裁定 → `dk-wave-close`。裁定行必須**交代每一位真的派出去的 reviewer**（`review N spawned` 那行列出誰就要有誰）：正常回覆的寫結果，沒回來的寫 `<別名>: skipped (<理由>)`。少一位 wave-close 就不放行 —— 派了兩個 kind 卻只讀一個的意見，等於第二意見白花。四道閘：裁定行、每位 dev 的 report、在 worktree 跑 `DK_TEST_CMD`、拿 worktree 的**真實 git diff**（含未 commit 與未追蹤）比對本波的檔案所有權。四道全過才關 pane，並自己在 worktree 內 commit（訊息預設 `wave N: <成員>`，要自訂用 `dk-wave-close -m "<訊息>"`）—— 你不用再手動 commit。留意 `unreported change` 與 state 超長警告。
6. 純文件波：審查欄寫 `skip: <理由>`，領導 `dk-process "review N skipped: <理由>"`，wave-close 就放行。
7. 收到 `[ESCALATE]`：能依 brief 判定就 `dk-msg <員工> "[DECISION] ..."` 並記 `ruling:`；不能就問人（關卡②），得到答案後回 DECISION 並在 `decisions.md` 加一行。收到 `[BLOCKED]`：告知人去按審批。
8. 依結果增刪下一波，記 process。**審查後的修復波成員至少 M**，不因改動小就標 S：修復要動已交織的邏輯、照 reviewer 的描述改別人的東西，最容易出回歸（ops 任務波 2 的 S 修復產生回歸，多開一波）。
9. 波中改 brief：改 `brief.md` → `dk-wave-open <N> --refresh` → 再 `dk-msg <員工> "[TASK] 重讀切片"`；新加的成員接著 `dk-spawn`。只請原 dev 重做時，`[TASK]` 裡叫他完成後回 `[FIXED]`（聚合不會重推）。

## 結案
1. 有視覺變更的任務：計畫中最後一波結波後、`dk-review-pack --task` 之前，先請人看畫面（dev server 或截圖），確認沒有追加才跑整枝評議。
2. 關卡③前先整分支評議：`dk-review-pack --task`，再 `dk-review --task --tier L`（L 檔 reviewer 讀 `waves/task.diff`）。Important 修掉或記 ruling，才寫 `report.md`（照範本；遺留段列出未經審查的波）。判成「不修、記 BACKLOG」時（Important 降級或 Minor 不修都算），ruling 的原因要標明前提是**實測**還是**推測**；「只影響顯示」「不會發生」這類推測不能當不修的理由——先實測，或照修。關卡③：給人拍板。
3. `dk-task-close`。它會合併回主分支，然後**把這個任務的記憶 commit 進主樹**（任務目錄、`tasks/INDEX.md`、`decisions.md`，只有這幾條路徑，你工作樹上的其他改動不會被掃進去）。合併衝突時它會停：不要自己解，問人或開 `it` 的修復波。放棄用 `dk-task-close --abandon "<原因>"`。

## 故障
- 任何員工的 `[LIMIT]`（dk-watch 推來）：先讀 `.blocked/<agent>.limit` 的 `hit:` 行（或 `herdr agent read`）判斷真假。誤判就 `dk-kind up <k>` 解熔斷並記 ruling；不要叫員工自己跑 `dk-kind`，命中行會印在他畫面上，等於自己把自己熔斷。真的撞額度才照舊：它跟 `[BLOCKED]` 不同 —— 按審批救不回來，要換人或等額度；專案層熔斷會讓下一個任務自動跳過該 kind。reviewer 就照下一條處理；dev／qa 則 `dk-wave-close --agent <員工>` 關掉後用未熔斷的 kind 重派。
- reviewer `[TIMEOUT]`（dk-watch 推來；該 kind 已寫進 `.task.env` 的 `DK_KIND_DOWN`）：`dk-wave-close --agent <reviewer>` 關它。達 `DK_REVIEW_MIN` 照常裁定；不夠就 `dk-review --kinds "<未熔斷者>"` 補一位；全部熔斷 → `dk-process "review N skipped: all kinds down"`，report.md 遺留段標「本波未經審查」。同任務內解除熔斷：`dk-kind up <k>`（同時清掉綁著任務的 `DK_KIND_DOWN`，並記 `kind <k> up`）；`dk-task-close` 會清掉。**`.blocked/<員工>.limit` 標記檔不要刪** —— 它就是「這個畫面已經判過了」的憑據，刪掉的話 dk-watch 下一輪讀到同一個畫面會再熔斷同一個 kind 一次。
- `dk-task-close` 或 `dk-chore-close` 回 `uncommitted changes`：worktree 裡有沒 commit 的變更，它不合併也不刪任何東西。任務：在 worktree 內 `git add -A && git commit` 後重跑；雜務：`dk-msg <員工> "[TASK] commit 你的變更"` 後重跑。真的要丟掉才用 `--abandon`。
- wave-close 測試失敗：它不關 pane；`dk-msg <擁有者> "[BUG] wave-close tests: <最後幾行>"`；連續兩次失敗升關卡②。
- wave-close 回 `unowned change: <路徑>`：這一波真的改了本波沒人擁有的檔（含在 worktree 裡動 `.dkbo/` 規則檔）。先判斷該不該改：該改就在 brief 的檔案所有權補給該成員並記 ruling，再重跑；不該改就 `dk-msg <該波成員> "[BUG] 還原 <路徑>"`。真要放行才 `--force`，並在 report.md 遺留段記一行。
- wave-close 回 `unreported change`（只警告、不阻擋）：某成員改了自己擁有的檔卻沒寫進 state 的 `touched`。`dk-msg <成員> "[TASK] 補 state touched"`。
- wave-close 回 `commit failed`：pane 已關但 commit 沒成（多半是專案的 pre-commit hook）。在 worktree 內自己 `git add -A && git commit` 補上，不要跳過 —— `dk-task-close` 會因未 commit 而拒絕結案。
- dev report 缺 `## 測試`：wave-close 拒絕；`dk-msg <dev> "[TASK] 補 report 測試段"`。
- 員工 `[ESCALATE] context` 或 pane 掛掉：`dk-spawn` 同角色同別名 `--resume`，提示會叫他從 state 續作；它會先關掉同名舊 pane。
- 員工／reviewer 的 `agent start` 失敗（`dk-spawn` 回「pane … 保留著」）：**那個 pane 沒有被關掉，證據還在**。`herdr pane read <pane> --source recent-unwrapped` 看它卡在什麼 —— 多半是 CLI 在啟動時跳了資料夾信任詢問、升級提示或登入過期。處理完（按掉提示或先在別處升級該 CLI）再重跑 `dk-spawn`，然後 `herdr pane close <pane>` 收掉那個殘留 pane。
- reviewer 第一次派工失敗（`review N spawned` 那行標 `<agent>(<kind>,prompt-failed)`）：`herdr agent read <agent>` 看狀態，再 `herdr agent prompt <agent> "..."` 重新提示，不算一次 DONE。
- 收到 `[TIMEOUT] wave N`（dk-watch 推來，整波超過 `DK_WAVE_TIMEOUT_MIN` 分鐘還沒收尾）：看這一波卡在誰身上 —— `dk-resume` 的本波段與每位成員的 state。該補訊息的補、該升報的升報；真的需要更久就調 `settings.env` 或記一行 process 說明原因。
- `process.md` 出現 `herdr-degraded: <呼叫>`：herdr 那一側的呼叫失敗了，**守望與版面這一輪是降級的**（可能偵測不到 blocked／timeout、版面不再均分）。確認 herdr 還活著且版本沒變，再 `dk-watch --ensure` 重起守望。
- 同一個 bug 修兩次都沒好：不要再派第三個人。`dk-msg <qa> "[TASK] 暫停重驗"`，然後把兩位的 report 與 reviewer 的原始意見一起交給人（關卡②）。第三次還是同一個洞，多半表示 brief 的驗收標準本身有歧義，那是人要裁定的事。

## 不屬於本任務的請求
人在任務進行中丟來獨立的請求（翻譯、畫圖、跟本任務無關的小修）：告訴他那是大腦的事，叫 `/dkbo-brain`（`.dkbo/skills/brain/SKILL.md`）。不要自己用 `dk-chore` 插隊。
