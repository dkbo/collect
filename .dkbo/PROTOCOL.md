# 通訊協定

所有訊息一律用 `$DK_ROOT/bin/dk-msg <對象> "[類型] 內文"`（下文簡寫 dk-msg；`DK_ROOT` 是你 pane 的環境變數）。腳本補寄件人、時間，寫進 messages.log，並等對方閒置才送。內文一到三句、≤200 字元，細節寫在你的 state 或 report 檔並指路，不貼程式碼。對象可寫 `leader`，也可以只寫角色短名（`reviewer-a`、`qa`），腳本會補上任務前綴；名字在 herdr 查不到時自動改走那個 pane 的 id。你不必自己去查註冊名，但送不到仍會回非零。

## 你要讀的
首段提示指向你的切片 `tasks/<t>/briefs/<你的 state 名>.md`（你的波次列、所有權、共用契約與驗收標準全文、同波成員）。完整 `brief.md` 仍可讀，但以切片為準；切片沒寫的所有權就不是你的。

## 類型
| 類型 | 方向 | 何時 |
|---|---|---|
| TASK | 領導→員工 | 補充派工、要求補 report、請 reviewer 複看 |
| DONE | 員工→領導（也可同時通知同波夥伴，如 dev→qa） | 完成，且 state 已寫 `status: done`、report 已寫好。dev 送給領導的這一則只落盤，見下 |
| BUG | 員工→員工、領導→dev（reviewer 的 Important 由領導轉） | 附重現方式，指向 state 或 report。收到 BUG 先讀 `$DK_ROOT/methods/debugging.md` 再動手 |
| FIXED | 員工→員工、dev→領導 | 修好了，請重驗，**內文帶一句根因**。領導轉來的 `[BUG]`（reviewer 的 Important）修好後也回這個，不要回 `[DONE]` —— 領導要靠它決定何時重打差異包請 reviewer 複看 |
| QUESTION / ANSWER | 任意 | 釐清介面、契約 |
| ESCALATE | 員工→領導 | 需要決策、想動不屬於自己的檔、修一次未好、上下文吃緊（寫 `[ESCALATE] context`）、碰到停止條件 |
| DECISION | 領導→員工 | 決策結果 |
| STOP | 領導→員工 | 停手，寫 state 收尾 |

`[BLOCKED]`、`[LIMIT]` 與 `[TIMEOUT]` 由 dk-watch 直接推給領導，員工不用送。`[BLOCKED]` 是卡在審批（等人按一下），`[LIMIT]` 是撞到額度（該 kind 已熔斷），兩者的差別決定領導該去按審批還是該換人 —— 不要把它們當成同一件事。

**dev 的 `[DONE]` 只寫進 messages.log，不會叫醒領導。** 領導改由 dk-watch 在本波 dev 全員完成時收到一則聚合訊息 —— 每一則送達都是把領導的整個 context 重跑一輪，四人波四次，而領導在收齊之前也做不了下一步。你照常送，指令不變。兩個後果要記得：

1. **state 還不是 `status: done` 就送，dk-msg 會當場退回（exit 2）。** 聚合看的是 state 檔不是你的訊息 —— state 沒寫好，這一波會靜悄悄卡到整波逾時才有人吭聲。先寫 state 與 report，再送 `[DONE]`。
2. **送給同波夥伴的 `[DONE]`（dev→qa）照常即時送達**，那是解鎖訊號不是回報。qa、reviewer 與雜務員工的 `[DONE]` 也都照常即時送達。

## 規則
- 同一波員工可以互相傳訊。`DK_ISOLATED=1` 的員工（reviewer）只能對 leader 傳訊。
- 修復迴圈上限兩輪，以同一個 bug 計：BUG → FIXED → 再驗仍失敗 → **領導換一個腦袋**（`dk-spawn <角色> <別名> --handoff "<原因>"`，換 kind 或升檔位；腳本自己落 ruling）→ 再驗仍失敗 → qa（或領導）ESCALATE，不再回 dev。同一個人再試一次跟換一個腦袋試一次不是同一件事，第二輪要換人。
- QUESTION 若 brief 沒有答案，被問的人不得自己決定；提問者 ESCALATE。同一波同一對員工 QUESTION 最多兩則。
- 任何「選 A 或 B」、任何共用契約的變更，一律 ESCALATE。
- 只能修改切片所有權劃給你的檔案。要動別人的檔 → 用 QUESTION 請擁有者改，或 ESCALATE。
- 禁止使用 subagent、禁止自行開 pane 或啟動其他 agent。
- 只有本人能寫自己的 state 與 report 檔；員工不寫 process.md、brief.md、report.md（任務結案報告）。
- dk-msg 回傳非零（對方卡住、送不進）：把這件事寫進 state 的 `blocked_by`，繼續做別的事。

## 停止條件（碰到就停手並 ESCALATE，不要自行變通）
不 push、不改寫歷史（rebase/amend 已推送的 commit、force）、不刪分支、不動所有權外的檔、不裝依賴（it 角色除外）、不改 `.dkbo/` 下的規則檔。
不跑會跳權限確認的指令：`rm -rf`、`git push`、`git reset --hard`、`git clean`、部署類（`pnpm deploy`／`pnpm cp`）。你跑在 acceptEdits 模式，這類指令會停在「Do you want to proceed?」等人按，而你的 pane 沒人在看。要刪專案內的檔就 `rm -r <單一路徑>`（不加 `-f`）或用工具自帶的清理指令（如 `vite --force`），做不到就 ESCALATE。

## state 檔（≤20 行，每完成一個子步驟就覆寫）
```
status: working | blocked | done
wave: 1
current: 正在做什麼（一句）
touched:
  - src/api/login.ts
todo:
  - 錯誤碼對齊前端
blocked_by: （無則省略）
report: state/<你的 state 名>.report.md
notes: 給接手者的必要事實，≤5 行
```
DONE 前 `touched` 必須完整。`dk-wave-close` 不是看你自報的清單，而是拿 worktree 的真實 git diff（含未 commit 與未追蹤）比對所有權：動了不屬於本波任何人的檔，整波關不掉；自己擁有但漏寫進 `touched` 的檔會被列成 `unreported change`。

## report 檔（`tasks/<t>/state/<你的 state 名>.report.md`，不限行數）
照 `$DK_ROOT/templates/report-employee.md`：`## 做了什麼`、`## 測試`（**必填**：跑了什麼指令、結果摘要；空的話 dk-wave-close 不放行）、`## 自我審查`、`## 疑慮`。DONE 前 state 與 report 都要寫好。

## reviewer 專節
- 只讀、不改碼、不跑會寫入的指令（不 `git add/commit`、不改檔、不裝東西）。讀切片指的差異包 `waves/N.diff` 與 brief。
- report 格式固定：`## 規格合規`（逐條驗收標準 ✅/❌ 與缺漏）、`## Important`（會出錯、違反 brief 或契約、越界改檔）、`## Minor`（風格、可讀性）；每條附 `file:line`。
- 意見只給領導（`dk-msg leader "[DONE] review 波 N: Important K 條，見 report"`），不直接對 dev 說；領導轉成 BUG 給 dev。收到領導 `[TASK] 複看` 時重讀差異包、更新 report、再 DONE。
- 評議波（設計題）沿用：意見寫 state notes，第二輪只准一則反駁。

雜務員工（`chore-*`）沒有任務綁定，不寫 state 檔。你的 chore 檔**整份是你的**，
格式隨你寫，機器不讀它——但正因為機器不讀，**完成一定要跑
`dk-msg leader "[DONE] <一句結果>"`，那是領導唯一收得到的完成訊號，不跑就關不掉**。
守望看的是你的 agent 狀態不是你的檔案，你卡在審批超過門檻就推 `[BLOCKED]` 給派你的領導；回報一律 `dk-msg leader "[DONE] <一句結果>"`（只能對 leader，腳本會等領導閒置再送、記到 `tasks/_chores/messages.log`）。不要直接用 `herdr agent prompt` 回報：領導忙碌時那樣送會被吃掉。

執行環境（dev server、port、db、docker）是**全隊共用**的：worktree 隔離檔案，不隔離它們。不要 kill 進程、不要重啟或佔用服務、不要去探別人的 port —— 主樹上有領導，其他 worktree 裡有同事。需要動就 `dk-msg leader "[ESCALATE] <要動什麼、為什麼>"` 讓領導決定。任務那側這件事寫在 brief 的「獨佔資源」欄，雜務沒有 brief，所以寫在這裡。
