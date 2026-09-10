# 通訊協定

所有訊息一律用 `$DK_ROOT/bin/dk-msg <對象> "[類型] 內文"`（下文簡寫 dk-msg；`DK_ROOT` 是你 pane 的環境變數）。腳本補寄件人、時間，寫進 messages.log，並等對方閒置才送。內文一到三句、≤200 字元，細節寫在你的 state 或 report 檔並指路，不貼程式碼。對象可寫 `leader`，腳本會解析成本任務的領導。

## 你要讀的
首段提示指向你的切片 `tasks/<t>/briefs/<你的 state 名>.md`（你的波次列、所有權、共用契約與驗收標準全文、同波成員）。完整 `brief.md` 仍可讀，但以切片為準；切片沒寫的所有權就不是你的。

## 類型
| 類型 | 方向 | 何時 |
|---|---|---|
| TASK | 領導→員工 | 補充派工、要求補 report、請 reviewer 複看 |
| DONE | 員工→領導（也可同時通知同波夥伴，如 dev→qa） | 完成，且 state 已寫 `status: done`、report 已寫好 |
| BUG | 員工→員工、領導→dev（reviewer 的 Important 由領導轉） | 附重現方式，指向 state 或 report |
| FIXED | 員工→員工 | 修好了，請重驗 |
| QUESTION / ANSWER | 任意 | 釐清介面、契約 |
| ESCALATE | 員工→領導 | 需要決策、想動不屬於自己的檔、修一次未好、上下文吃緊（寫 `[ESCALATE] context`）、碰到停止條件 |
| DECISION | 領導→員工 | 決策結果 |
| STOP | 領導→員工 | 停手，寫 state 收尾 |

`[BLOCKED]` 與 `[TIMEOUT]` 由 dk-watch 直接推給領導，員工不用送。

## 規則
- 同一波員工可以互相傳訊。`DK_ISOLATED=1` 的員工（reviewer）只能對 leader 傳訊。
- 修復迴圈上限一次，以同一個 bug 計：BUG → FIXED → 再驗仍失敗 → qa（或領導）直接 ESCALATE，不再回 dev。
- QUESTION 若 brief 沒有答案，被問的人不得自己決定；提問者 ESCALATE。同一波同一對員工 QUESTION 最多兩則。
- 任何「選 A 或 B」、任何共用契約的變更，一律 ESCALATE。
- 只能修改切片所有權劃給你的檔案。要動別人的檔 → 用 QUESTION 請擁有者改，或 ESCALATE。
- 禁止使用 subagent、禁止自行開 pane 或啟動其他 agent。
- 只有本人能寫自己的 state 與 report 檔；員工不寫 process.md、brief.md、report.md（任務結案報告）。
- dk-msg 回傳非零（對方卡住、送不進）：把這件事寫進 state 的 `blocked_by`，繼續做別的事。

## 停止條件（碰到就停手並 ESCALATE，不要自行變通）
不 push、不改寫歷史（rebase/amend 已推送的 commit、force）、不刪分支、不動所有權外的檔、不裝依賴（it 角色除外）、不改 `.dkbo/` 下的規則檔。

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
DONE 前 `touched` 必須完整，領導會拿它比對所有權。

## report 檔（`tasks/<t>/state/<你的 state 名>.report.md`，不限行數）
照 `$DK_ROOT/templates/report-employee.md`：`## 做了什麼`、`## 測試`（**必填**：跑了什麼指令、結果摘要；空的話 dk-wave-close 不放行）、`## 自我審查`、`## 疑慮`。DONE 前 state 與 report 都要寫好。

## reviewer 專節
- 只讀、不改碼、不跑會寫入的指令（不 `git add/commit`、不改檔、不裝東西）。讀切片指的差異包 `waves/N.diff` 與 brief。
- report 格式固定：`## 規格合規`（逐條驗收標準 ✅/❌ 與缺漏）、`## Important`（會出錯、違反 brief 或契約、越界改檔）、`## Minor`（風格、可讀性）；每條附 `file:line`。
- 意見只給領導（`dk-msg leader "[DONE] review 波 N: Important K 條，見 report"`），不直接對 dev 說；領導轉成 BUG 給 dev。收到領導 `[TASK] 複看` 時重讀差異包、更新 report、再 DONE。
- 評議波（設計題）沿用：意見寫 state notes，第二輪只准一則反駁。

雜務員工（`chore-*`）沒有任務綁定，不適用上面的 state 檔／dk-msg 流程；他們以 `herdr agent prompt "$DK_LEADER" "[DONE] from <agent>: ..."` 作為回報第一句。
