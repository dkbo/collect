#!/usr/bin/env bash
# Stop：收工前強制驗證（lint 零錯誤 + tsc 型別乾淨 + vitest 全綠 + 糖果邏輯測試全綠）。
# 只掛 Stop、不掛 SubagentStop：唯讀 subagent（web-verifier / arch-security-reviewer / build-runner）
# 收工時不該被拖去驗、更不能被叫回去修它改不了的東西；in-process subagent 的改動由主 session 收工時一次驗。
# headless `claude -p` worker 是獨立 session，會觸發它自己的 Stop，照樣驗。
# 只在這棵樹真的改過對應區塊時才跑（由 post-edit-check.sh 留下的 marker 判斷），
# 純問答／只改文件設定的收工完全不會被拖。
set -uo pipefail
. "$(dirname "$0")/_common.sh"

root=$(hook_root); cd "$root" || exit 0

payload=$(cat)
# 已經是被 Stop hook 攔下後的再次收工 → 放行，避免無限迴圈。
[ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

[ -d "$STATE" ] || exit 0
ensure_worktree_deps
fail=''
notes=''
# 失敗輸出只回尾段：整份 lint / tsc / vitest 輸出灌進 context 很貴，錯誤摘要都在最後。
tailf(){ printf '%s\n' "$1" | tail -n "$2"; }

if [ -f "$STATE/dirty" ]; then
  if ! out=$(timeout 120 "$LBIN/eslint" "${ESLINT_CACHE_ARGS[@]}" . 2>&1); then
    fail+="pnpm lint 未通過："$'\n'"$(tailf "$out" 60)"$'\n\n'
  fi
  if ! out=$(timeout 120 "$LBIN/tsc" -b --noEmit 2>&1); then
    fail+="tsc 型別檢查未通過（pnpm lint 不做型別檢查，這關才會抓到）："$'\n'"$(tailf "$out" 60)"$'\n\n'
  fi
  if ! out=$(timeout 180 "$LBIN/vitest" run --reporter=dot 2>&1); then
    fail+="vitest 單元測試未通過："$'\n'"$(tailf "$out" 80)"$'\n\n'
  fi
fi

if [ -f "$STATE/dirty-candy" ]; then
  out=$(timeout 120 godot --headless --path godot-candy-src --script res://tests/board_test.gd 2>&1)
  if [ $? -ne 0 ] || ! printf '%s' "$out" | grep -q 'ALL PASS'; then
    fail+="糖果邏輯測試 board_test.gd 未通過："$'\n'"$(tailf "$out" 60)"$'\n\n'
  else
    notes+="godot-candy-src/ 有改動：匯出產物要進版控，收工前跑 pnpm candy:export。"$'\n'
  fi
fi

if [ -f "$STATE/dirty-godot-rpg" ]; then
  notes+="godot-src/ 有改動：匯出產物要進版控，收工前跑 pnpm godot:export。"$'\n'
fi

if [ -n "$fail" ]; then
  # 保留 marker：修完再收工時會再驗一次。
  printf '%s收工被擋下。完成定義是 lint 零錯誤、tsc 乾淨、vitest 全綠、board_test 全綠，先修好。\n' "$fail" >&2
  exit 2
fi

rm -f "$STATE"/dirty "$STATE"/dirty-candy "$STATE"/dirty-godot-rpg
if [ -n "$notes" ]; then
  jq -cn --arg m "$notes" '{systemMessage: $m}'
fi
exit 0
