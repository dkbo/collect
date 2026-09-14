# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
KIND_MODEL_EFFORTS="gpt-5.5:low,medium,high"
KIND_DEFAULT_TIERS="S=gpt-5.5/low M=gpt-5.5/medium L=gpt-5.5/high"
KIND_PROMPT_QUEUES=unknown
# -s workspace-write 的 primary workspace 只有員工的 cwd（worktree），而切片、state、report、
# diff pack 都在主樹的 .dkbo/ 下 —— --add-dir 把主樹補進可寫範圍（同 claude.sh 的理由）。

# codex 走 -a never，照理不該停在審批，但真停了也要認得。額度那行是 panova2 撞到的原文：
# "You've hit your usage limit. Upgrade to Plus to continue using Codex" —— 它同樣回 idle。
KIND_BLOCK_RE='Allow command|Run this command\?|Do you want'
KIND_QUOTA_RE="You've hit your usage limit|usage limit|rate limit|Upgrade to Plus"
kind_args() { echo "-m $1 -c model_reasoning_effort=$2 -a never -s workspace-write --add-dir $DK_PROJECT_ROOT"; }
kind_mcp_list() { codex mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
