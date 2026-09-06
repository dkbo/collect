#!/usr/bin/env bash
# SessionStart：把接手時最常踩到的兩種「狀態過期」注入 context，只提示不阻擋。
#   1. Godot 源碼比匯出產物新 → 提醒重新匯出（產物要進版控）
#   2. .env.local 缺 VITE_FIREBASE_FIRESTORE_DB → /battle 會連到 Datastore-mode 的 (default) 必死
set -uo pipefail
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$root" ] && cd "$root" || exit 0

notes=''
stale(){ # $1 源碼目錄 $2 產物 $3 匯出指令
  [ -f "$2" ] || { notes+="- $1 沒有匯出產物 $2，跑 $3。"$'\n'; return; }
  # 所有會被打進 .pck 的檔都算（腳本、場景、資源、圖片、音效），只排除編輯器快取與 .uid
  n=$(find "$1" -path "$1/.godot" -prune -o -type f ! -name '*.uid' -newer "$2" -print | wc -l)
  [ "$n" -gt 0 ] && notes+="- $1 有 $n 個檔比 $2 新，匯出產物過期，收工前跑 $3 並 commit 產物。"$'\n'
}
stale godot-src public/godot/index.js "pnpm godot:export"
stale godot-candy-src public/candy/index.js "pnpm candy:export"

if [ -f .env.local ]; then
  if ! grep -Eq '^VITE_FIREBASE_FIRESTORE_DB=.+' .env.local; then
    notes+="- .env.local 缺 VITE_FIREBASE_FIRESTORE_DB（應為 dkbo-collect）：/battle 會連到 Datastore-mode 的 (default) 而報 client is offline。"$'\n'
  fi
else
  notes+="- 沒有 .env.local：/battle 的 Firebase 無法初始化，從 .env.example 複製並填值。"$'\n'
fi

[ -n "$notes" ] || exit 0
jq -cn --arg m "專案狀態檢查（SessionStart hook）："$'\n'"$notes" \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$m}}'
