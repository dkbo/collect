# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
KIND_MODELS="opus sonnet"
KIND_EFFORTS="low medium high"
KIND_DEFAULT_TIERS="S=sonnet/low M=sonnet/medium L=opus/high"
KIND_PROMPT_QUEUES=unknown   # layer-3 smoke updates this: does a prompt sent while working queue?
kind_args() { echo "--model $1 --effort $2 --permission-mode acceptEdits"; }
kind_mcp_list() { claude mcp list 2>/dev/null | awk -F: 'NF>1{print $1}'; }
