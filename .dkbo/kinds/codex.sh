# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
KIND_MODEL_EFFORTS="gpt-5.5:low,medium,high"
KIND_DEFAULT_TIERS="S=gpt-5.5/low M=gpt-5.5/medium L=gpt-5.5/high"
KIND_PROMPT_QUEUES=unknown
# -s workspace-write 的 primary workspace 只有員工的 cwd（worktree），而切片、state、report、
# diff pack 都在主樹的 .dkbo/ 下 —— --add-dir 把主樹補進可寫範圍（同 claude.sh 的理由）。

# codex 走 -a never，照理不該停在審批，但真停了也要認得。額度那行是 panova2 撞到的原文：
# "You've hit your usage limit. Upgrade to Plus to continue using Codex" —— 它同樣回 idle。
# 「Approaching rate limits / Switch model」選單也會停住等人按 Enter（gamemore 實測）。收的是
# `Press enter to` 這段前綴而不是整句：窄 pane 會把尾巴截掉，實測原文是 `Press enter to confir`
# 與 `Press enter to con`，整句 `Press enter to confirm` 兩個都認不得。
KIND_BLOCK_RE='Allow command|Run this command\?|Do you want|Press enter to'
# 0.12.0：拿掉了 `rate limit` 這個分支——它同時命中「Approaching rate limits」選單標題與選單
# 第 3 項的說明文字，跟 claude.sh 的 KIND_QUOTA_RE 第 2 個分支是同一個字串。codex 只印這個片語的
# 暫時性限流（快到額度、還沒真的撞到）從此不再熔斷 kind；真正耗盡時 `usage limit`／`Upgrade to
# Plus` 兩個分支仍會命中。這是想要的行為，不是回歸。
KIND_QUOTA_RE="You've hit your usage limit|usage limit|Upgrade to Plus"
kind_args() { echo "-m $1 -c model_reasoning_effort=$2 -a never -s workspace-write$(dk_add_dirs)"; }
# codex 沒有設 session 顯示名的旗標（`codex --help` 只有 --name 之外的東西），回空字串。
kind_session_args() { return 0; }
kind_mcp_list() { codex mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
