# shellcheck shell=bash
dk_first_prompt() { # AGENT ROLE TASK_DIR STATE_FILE RESUME BRIEF_FILE REPORT_FILE [UPSTREAM] [HANDOFF] [GROUP]
  local resume=""; [ "${5:-0}" = 1 ] && resume="你是重新啟動的員工：先讀 $4，從 state 檔續作，不要重做已完成的項目。"
  # 接手與續作是兩件事：續作的人要接著往下做，接手的人要重做，只是不能重走死路。
  [ -z "${9:-}" ] || resume="你是接手的員工（換人原因：${9}）。上一位修過一次沒成功 —— 先讀 $4 與 $7，看它試過什麼、排除了什麼，再讀 \$DK_ROOT/methods/debugging.md，然後自己重新判斷根因。不要照著它的路再走一次。"
  # 上游還沒交差時 worktree 裡是半成品，對它下判定只會產出假結論（見 lib/brief.sh 的
  # dk_brief_wave_upstream）。不擋前置工作，只擋判定。
  local wait_for=""; [ -n "${8:-}" ] && wait_for="本波的 dev 成員是：${8}。在它們的 state 檔（$3/state/<成員>.md）出現 status: done、或它們送來 [DONE] 之前，worktree 裡是半成品 —— 這段時間你只做不依賴它們產出的前置（環境、測試帳號、探測腳本骨架），不要下驗收判定、不要發 [BUG]、不要把中途看到的狀態寫進報告。"
  # reviewer 不寫任何碼、qa 只驗不修：TDD 那句跟它們自己的報告格式（規格合規／
  # Important／Minor，或逐條驗收方式）矛盾，只發給 group: dev。
  local tdd=""; [ "${10:-dev}" = dev ] && tdd="寫程式的順序是：先寫一條會失敗的測試、跑它確認真的失敗、再寫最小實作讓它過；兩次的指令與輸出分別貼進報告的「### 紅」與「### 綠」（沒有測試的波兩節都寫「不適用: <理由>」）。"
  printf '%s' "你是 $1，角色 $2。先讀：$DK_ROOT/roles/$2.md、$DK_ROOT/PROTOCOL.md、$DK_ROOT/PROJECT.md、$6。你的 state 檔是 $4（≤20 行，每完成一個子步驟就覆寫）；報告檔是 $7（不限行數，照 $DK_ROOT/templates/report-employee.md，「## 測試」必填）。只能修改 brief 檔案所有權劃給你的檔案。禁止使用 subagent、禁止自行開 pane。所有訊息用 $DK_ROOT/bin/dk-msg。讀完後建立 state 檔並開始做分給你的項目。${tdd}碰到 bug 或測試紅了，先讀 $DK_ROOT/methods/debugging.md 再動手。送 [DONE] 前 state 與報告都要寫好，然後 dk-msg 交接對象與 leader。$wait_for$resume"
}
