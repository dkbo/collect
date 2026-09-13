# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
# agy 接受 --model <id> --effort <e>；model id 也可帶 -<effort> 後綴，但後綴與 --effort 同時給會衝突。
# 逐 model 宣告，因為 gemini-3.1-pro 只有 high 與 low（`agy models` 實測，沒有 medium）。
KIND_MODEL_EFFORTS="gemini-3.1-pro:low,high gemini-3.8-flash:low,medium,high"
KIND_DEFAULT_TIERS="S=gemini-3.8-flash/low M=gemini-3.8-flash/medium L=gemini-3.1-pro/high"
KIND_PROMPT_QUEUES=unknown
kind_args() { echo "--model $1 --effort $2 --mode accept-edits"; }
kind_mcp_list() { agy mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
