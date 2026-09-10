# shellcheck shell=bash
dk_first_prompt() { # AGENT ROLE TASK_DIR STATE_FILE RESUME BRIEF_FILE REPORT_FILE
  local resume=""; [ "${5:-0}" = 1 ] && resume="你是重新啟動的員工：先讀 $4，從 state 檔續作，不要重做已完成的項目。"
  printf '%s' "你是 $1，角色 $2。先讀：$DK_ROOT/roles/$2.md、$DK_ROOT/PROTOCOL.md、$DK_ROOT/PROJECT.md、$6。你的 state 檔是 $4（≤20 行，每完成一個子步驟就覆寫）；報告檔是 $7（不限行數，照 $DK_ROOT/templates/report-employee.md，「## 測試」必填）。只能修改 brief 檔案所有權劃給你的檔案。禁止使用 subagent、禁止自行開 pane。所有訊息用 $DK_ROOT/bin/dk-msg。讀完後建立 state 檔並開始做分給你的項目；送 [DONE] 前 state 與報告都要寫好，然後 dk-msg 交接對象與 leader。$resume"
}
