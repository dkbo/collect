#!/usr/bin/env bash
# PreToolUse(Bash)：硬擋本專案已知會壞的指令（純字串比對抓得到的，不該靠 agent 記得）。
# PreToolUse 的 exit 2 = 阻止該次工具呼叫，stderr 回饋給 Claude。
set -uo pipefail

raw=$(cat | jq -r '.tool_input.command // empty')
[ -n "$raw" ] || exit 0

# 只掃「真的會被執行」的部分，先剝掉 heredoc 內文——
# commit message 與寫檔內容常常正當地引用這些反例字串。
cmd=$(printf '%s\n' "$raw" | awk '
  d != "" { if ($0 == d) d = ""; next }
  {
    if (match($0, /<<-?[ \t]*[\047"]?[A-Za-z_][A-Za-z0-9_]*[\047"]?/)) {
      tok = substr($0, RSTART, RLENGTH)
      sub(/^<<-?[ \t]*/, "", tok)
      gsub(/[\047"]/, "", tok)
      d = tok
    }
    print
  }
')

# 指令位置錨點：行首，或 ; & | ( && || 之後。沒有錨點，散文裡提到指令也會被當成要執行它。
AT='(^|[;&|(])[[:space:]]*'

# --- 1. pkill -f 打到 dev server / node / godot ------------------------------
if printf '%s' "$cmd" | grep -Eq "${AT}pkill([[:space:]]|$)" \
   && printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])-[0-9a-zA-Z]*f([[:space:]]|$)' \
   && printf '%s' "$cmd" | grep -Eq 'vite|node|pnpm|dev|godot'; then
  cat >&2 <<'MSG'
擋下：`pkill -f` 關 dev server／node／godot。-f 會匹配到你自己的 shell 與其他 session 的程序。

改用逐一 kill pid：
  ss -ltnp | grep 517        # 找佔 5173 的 pid
  kill <pid>
  pgrep -af godot            # godot 同理
MSG
  exit 2
fi

# --- 2. 手動跑 godot 匯出但沒帶 --headless 或 --import ------------------------
if printf '%s' "$cmd" | grep -Eq "${AT}godot([[:space:]]|$)" \
   && printf '%s' "$cmd" | grep -Eq -- '--export-(release|debug)' \
   && ! { printf '%s' "$cmd" | grep -Eq -- '--headless' && printf '%s' "$cmd" | grep -Eq -- '--import'; }; then
  cat >&2 <<'MSG'
擋下：手動 `godot --export-*` 沒帶 `--headless`（WSL 會開 GUI 卡死）或沒先 `--import`（.godot 快取過期，匯出舊資源）。

改用 package.json 的封裝指令（已含 --headless --import，RPG 版還會先 sync:maps）：
  pnpm godot:export     # godot-src → public/godot/
  pnpm candy:export     # godot-candy-src → public/candy/
MSG
  exit 2
fi

# --- 3. 手動複製地圖進 public/godot/maps/ -----------------------------------
if printf '%s' "$cmd" | grep -Eq "${AT}(cp|mv|rsync|install)([[:space:]]|$)" \
   && printf '%s' "$cmd" | grep -Eq 'public/godot/maps'; then
  cat >&2 <<'MSG'
擋下：手動複製地圖到 `public/godot/maps/`（godot-dev skill）。
那個目錄是產物且已 gitignore，單一來源在 src/pages/RpgRoom/data/。

改用：
  pnpm sync:maps        # 改地圖 JSON 時 PostToolUse hook 也會自動跑
MSG
  exit 2
fi

# --- 4. 把 jpg/png 寫進 src/ 或 public/ ---------------------------------------
if printf '%s' "$cmd" | grep -Eq "${AT}(cp|mv|curl|wget|tee|convert|magick|ffmpeg)([[:space:]]|$)|>[[:space:]]*[^ ]*(src|public)/[^ ]*\.(jpe?g|png)\b" \
   && printf '%s' "$cmd" | grep -Eq '(src|public)/[^ ]*\.(jpe?g|png)([[:space:]]|$|["'"'"'])'; then
  cat >&2 <<'MSG'
擋下：把 jpg／png 寫進 src/ 或 public/（AGENTS.md 第 4 條：圖片一律 WebP）。

先轉檔再放進專案：
  cwebp -q 80 input.jpg -o public/<name>.webp     # 細節見 img-to-webp skill
MSG
  exit 2
fi

exit 0
