#!/usr/bin/env bash
# SessionStart：把接手時最常踩到的兩種「狀態過期」注入 context，只提示不阻擋。
#   1. Godot 源碼比匯出產物新 → 提醒重新匯出（產物要進版控）
#   2. .env.local 缺 VITE_FIREBASE_FIRESTORE_DB → /battle 會連到 Datastore-mode 的 (default) 必死
set -uo pipefail
. "$(dirname "$0")/_common.sh"
root=$(hook_root); cd "$root" || exit 0
# worktree 剛開好時 node_modules／.env.local 還沒補，否則下面會誤報「沒有 .env.local」。
ensure_worktree_deps

notes=''
stale(){ # $1 源碼目錄 $2 產物 $3 匯出指令
  [ -f "$2" ] || { notes+="- $1 沒有匯出產物 $2，跑 $3。"$'\n'; return; }
  # 用 git 歷史比，不用 mtime：checkout / clone 之後所有檔的 mtime 都一樣，mtime 會誤報或漏報。
  # 過期 = 源碼有未 commit 的改動，或源碼最後一次 commit 比產物最後一次 commit 新。
  local dirty src_t out_t
  dirty=$(git status --porcelain -- "$1" | grep -vc '\.uid$' || true)
  src_t=$(git log -1 --format=%ct -- "$1" 2>/dev/null || echo 0)
  out_t=$(git log -1 --format=%ct -- "$(dirname "$2")" 2>/dev/null || echo 0)
  if [ "${dirty:-0}" -gt 0 ]; then
    notes+="- $1 有 $dirty 個未 commit 的改動，收工前跑 $3 並 commit 產物。"$'\n'
  elif [ "${src_t:-0}" -gt "${out_t:-0}" ]; then
    notes+="- $1 最後 commit 比 $(dirname "$2") 產物新，匯出產物過期，跑 $3 並 commit 產物。"$'\n'
  fi
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
