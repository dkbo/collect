#!/usr/bin/env bash
# Stop / SubagentStop：收工前強制驗證（lint 零錯誤 + tsc 型別乾淨 + 糖果邏輯測試全綠）。
# 三關合計約 18 秒（lint 11s + tsc 5s + board_test 1s）。
# 只在這次 session 真的改過對應區塊時才跑（由 post-edit-check.sh 留下的 marker 判斷），
# 純問答／只改文件設定的收工完全不會被拖。
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$root" ] && cd "$root" || exit 0

payload=$(cat)
# 已經是被 Stop hook 攔下後的再次收工 → 放行，避免無限迴圈。
[ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

state=.claude/.hook-state
[ -d "$state" ] || exit 0
fail=''
notes=''

if [ -f "$state/dirty" ]; then
  if ! out=$(pnpm lint 2>&1); then
    fail+="pnpm lint 未通過："$'\n'"$out"$'\n\n'
  fi
  if ! out=$(pnpm typecheck 2>&1); then
    fail+="tsc 型別檢查未通過（pnpm lint 不做型別檢查，這關才會抓到）："$'\n'"$out"$'\n\n'
  fi
fi

if [ -f "$state/dirty-candy" ]; then
  out=$(godot --headless --path godot-candy-src --script res://tests/board_test.gd 2>&1)
  if [ $? -ne 0 ] || ! printf '%s' "$out" | grep -q 'ALL PASS'; then
    fail+="糖果邏輯測試 board_test.gd 未通過："$'\n'"$out"$'\n\n'
  else
    notes+="godot-candy-src/ 有改動：匯出產物要進版控，收工前跑 pnpm candy:export。"$'\n'
  fi
fi

if [ -f "$state/dirty-godot-rpg" ]; then
  notes+="godot-src/ 有改動：匯出產物要進版控，收工前跑 pnpm godot:export。"$'\n'
fi

if [ -n "$fail" ]; then
  # 保留 marker：修完再收工時會再驗一次。
  printf '%s收工被擋下。完成定義是 lint 零錯誤、tsc 乾淨、board_test 全綠，先修好。\n' "$fail" >&2
  exit 2
fi

rm -f "$state"/dirty "$state"/dirty-candy "$state"/dirty-godot-rpg
if [ -n "$notes" ]; then
  jq -cn --arg m "$notes" '{systemMessage: $m}'
fi
exit 0
