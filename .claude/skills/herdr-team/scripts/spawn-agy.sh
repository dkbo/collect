#!/usr/bin/env bash
# 開一個 agy worker pane 並啟動 agy，名稱 worker-agy-<N>（N = 本專案現有 worker-agy-* 數量 + 1，跳過撞名）。
# 第 1 個切在本 pane 右側，之後的切在最後一個 worker-agy pane 下方。stdout 只印名稱。
# 用法：spawn-agy.sh [model]    預設 gemini-3.8-flash-low；審查／比對用 gemini-3.8-flash-high
set -euo pipefail
test "${HERDR_ENV:-}" = 1 || { echo "不在 herdr 內" >&2; exit 1; }
model="${1:-gemini-3.8-flash-low}"

list=$(herdr agent list)
existing=$(printf '%s' "$list" | jq -r --arg cwd "$PWD" \
  '.result.agents[] | select(.cwd==$cwd) | .name // empty | select(startswith("worker-agy-"))')
n=$(printf '%s\n' "$existing" | awk 'NF{c++} END{print c+1}')
while printf '%s\n' "$existing" | grep -qx "worker-agy-$n"; do n=$((n+1)); done
name="worker-agy-$n"

if [ -z "$existing" ]; then
  pid=$(herdr pane split --current --direction right --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
else
  last=$(printf '%s' "$list" | jq -r --arg cwd "$PWD" \
    '[.result.agents[] | select(.cwd==$cwd and ((.name // "") | startswith("worker-agy-")))] | last | .pane_id')
  pid=$(herdr pane split --pane "$last" --direction down --cwd "$PWD" --no-focus | jq -r '.result.pane.pane_id')
fi
herdr agent start "$name" --kind agy --pane "$pid" --timeout 60000 -- --model "$model" >/dev/null
echo "$name"
