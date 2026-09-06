#!/usr/bin/env bash
# PostToolUse(Edit|Write)：只檢查剛改的那一個檔（整包 pnpm lint 約 11 秒，單檔約 2–3 秒）。
# 失敗一律 exit 2 —— PostToolUse 只有 exit 2 才會把 stderr 回饋給 Claude；
# 不擋但要提醒的用 stdout JSON 的 additionalContext。
# 同時留下 marker 給 verify-on-stop.sh 判斷這次 session 到底改過哪一塊：
#   dirty            src/ 的 TS/TSX（→ 收工跑 lint + typecheck）
#   dirty-candy      godot-candy-src/（→ 收工跑 board_test.gd、提醒匯出）
#   dirty-godot-rpg  godot-src/（→ 收工提醒匯出）
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$root" ] && cd "$root" || exit 0

file=$(cat | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0
rel="${file#"$root"/}"
state=.claude/.hook-state
mark(){ mkdir -p "$state" && touch "$state/$1"; }
ctx(){ jq -cn --arg m "$1" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'; }

case "$rel" in
  src/pages/RpgRoom/data/*.json)
    if ! err=$(jq empty "$file" 2>&1); then
      printf '地圖 JSON 不是合法 JSON：%s\n%s\n' "$rel" "$err" >&2
      exit 2
    fi
    if ! out=$(node scripts/sync-godot-maps.mjs 2>&1); then
      printf '地圖同步 sync-godot-maps.mjs 失敗（%s）：\n%s\n' "$rel" "$out" >&2
      exit 2
    fi
    ctx "已改地圖 JSON $rel，並已自動跑 sync:maps 同步到 public/godot/maps/（$out）。"
    ;;
  godot-candy-src/data/*.json)
    if ! err=$(jq empty "$file" 2>&1); then
      printf '關卡 JSON 不是合法 JSON：%s\n%s\n' "$rel" "$err" >&2
      exit 2
    fi
    mark dirty-candy
    ;;
  godot-src/export_presets.cfg | godot-candy-src/export_presets.cfg)
    if grep -Eq '^variant/thread_support=true' "$file"; then
      printf 'Web 匯出 Threads 被改成 ON（%s）：靜態託管無法回 COOP/COEP header，會直接黑屏。改回 variant/thread_support=false。\n' "$rel" >&2
      exit 2
    fi
    [ "${rel%%/*}" = godot-src ] && mark dirty-godot-rpg || mark dirty-candy
    ;;
  godot-src/*.gd | godot-candy-src/*.gd)
    proj="${rel%%/*}"
    [ "$proj" = godot-src ] && mark dirty-godot-rpg || mark dirty-candy
    out=$(godot --headless --path "$proj" --check-only -s "res://${rel#"$proj"/}" 2>&1)
    # --check-only 不會註冊 project.godot 的 autoload singleton（Bridge、CandyBridge…），
    # 「Identifier not found: <autoload>」是工具限制不是錯誤，濾掉；其餘 SCRIPT ERROR / Parse Error 才擋。
    # 限制：autoload 那行之後的編譯錯誤會被 Godot 一起吞掉，看不到。
    autoloads=$(sed -n '/^\[autoload\]/,/^\[/p' "$proj/project.godot" | grep -oE '^[A-Za-z_][A-Za-z0-9_]*' | paste -sd'|')
    [ -n "$autoloads" ] && out=$(printf '%s\n' "$out" | grep -vE "Identifier not found: ($autoloads)\b" || true)
    if printf '%s' "$out" | grep -q 'SCRIPT ERROR\|Parse Error'; then
      printf 'GDScript 語法檢查未通過（%s）：\n%s\n' "$rel" "$out" >&2
      exit 2
    fi
    case "$rel" in
      godot-src/scripts/bridge.gd) ctx "改了 Godot 端 bridge 協定（$rel）。React 端是 src/lib/godotBridge.ts，兩邊要同步。" ;;
      godot-candy-src/scripts/candy_bridge.gd) ctx "改了 Godot 端 bridge 協定（$rel）。React 端是 src/lib/candyBridge.ts（協定 v1），兩邊要同步。" ;;
    esac
    ;;
  src/*.ts | src/*.tsx | src/*.js | src/*.jsx | scripts/*.mjs)
    mark dirty
    if ! out=$(pnpm exec eslint --fix "$file" 2>&1); then
      printf 'ESLint 未通過（已試 --fix，剩下的要手改）：\n%s\n' "$out" >&2
      exit 2
    fi
    case "$rel" in
      src/lib/godotBridge.ts) ctx "改了 React 端 bridge 協定（$rel）。Godot 端是 godot-src/scripts/bridge.gd，兩邊要同步，改完要 pnpm godot:export。" ;;
      src/lib/candyBridge.ts) ctx "改了 React 端 bridge 協定（$rel）。Godot 端是 godot-candy-src/scripts/candy_bridge.gd，兩邊要同步，改完要 pnpm candy:export。" ;;
    esac
    ;;
esac
exit 0
