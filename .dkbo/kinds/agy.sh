# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
# agy model ids embed the effort suffix: gemini-3.1-pro-high
KIND_MODELS="gemini-3.1-pro gemini-3.8-flash"
KIND_EFFORTS="low medium high"
KIND_DEFAULT_TIERS="S=gemini-3.8-flash/low M=gemini-3.8-flash/medium L=gemini-3.1-pro/high"
KIND_PROMPT_QUEUES=unknown
kind_args() { echo "--model $1-$2 --mode accept-edits"; }
kind_mcp_list() { agy mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
