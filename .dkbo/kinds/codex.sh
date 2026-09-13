# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
KIND_MODEL_EFFORTS="gpt-5.5:low,medium,high"
KIND_DEFAULT_TIERS="S=gpt-5.5/low M=gpt-5.5/medium L=gpt-5.5/high"
KIND_PROMPT_QUEUES=unknown
# -s workspace-write 的 primary workspace 只有員工的 cwd（worktree），而切片、state、report、
# diff pack 都在主樹的 .dkbo/ 下 —— --add-dir 把主樹補進可寫範圍（同 claude.sh 的理由）。
kind_args() { echo "-m $1 -c model_reasoning_effort=$2 -a never -s workspace-write --add-dir $DK_PROJECT_ROOT"; }
kind_mcp_list() { codex mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
