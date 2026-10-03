# shellcheck shell=bash
# 員工在 worktree 或 scratchpad 起的背景 listen 行程（vite preview、dev server）。
# pane 關掉時 herdr 只收 pane 的前景行程，nohup／& 起的會活下來一直佔著埠：下游專案 B 的
# 5174 被一支 9/25 的 vite preview 佔了八天，三個任務（兩個專案）的 brief 都撞上它。
# 收的判準是「跟某個 worktree 綁在一起」：cwd 在 worktree 裡，或命令列寫著 worktree 路徑或它的
# scratchpad 編碼（claude 把 cwd 的非英數字元換成 - 當 scratchpad 目錄名）。領導站在主樹，
# 它起的 dev server 不會被算進去。只收 listen 中的行程：人在 worktree 開的 shell、編輯器不 listen。
# Needs common.sh sourced first.

DK_PROC_ROOT="${DK_PROC_ROOT:-/proc}"

dk_listeners() { # → 「PORT PID」每行一組；只列看得到 pid 的 listen（也就是自己的行程）。沒有 ss 也沒有 lsof 就什麼都不印
  if command -v ss >/dev/null 2>&1; then
    ss -ltnpH 2>/dev/null | awk '{ n = split($4, a, ":"); port = a[n]; s = $0
      while (match(s, /pid=[0-9]+/)) { print port, substr(s, RSTART + 4, RLENGTH - 4); s = substr(s, RSTART + RLENGTH) } }' | sort -u
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP -sTCP:LISTEN -Fpn 2>/dev/null | awk '/^p/ {pid = substr($0, 2)} /^n/ {n = split($0, a, ":"); print a[n], pid}' | sort -u
  fi
  return 0
}

dk_proc_cmd() { # PID → 命令列（參數以空白相接）
  if [ -r "$DK_PROC_ROOT/$1/cmdline" ]; then tr '\0' ' ' < "$DK_PROC_ROOT/$1/cmdline" | sed 's/ *$//'
  else ps -o command= -p "$1" 2>/dev/null || true; fi
}

dk_proc_cwd() { # PID → cwd（拿不到印空）
  if [ -e "$DK_PROC_ROOT/$1/cwd" ]; then readlink "$DK_PROC_ROOT/$1/cwd" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
  fi
}

dk_path_enc() { printf '%s' "$1" | sed 's/[^A-Za-z0-9-]/-/g'; }   # PATH → claude 的 scratchpad 目錄名

dk_proc_tied() { # PID PATH → 0 表示這個行程綁在 PATH（cwd 在裡面，或命令列寫著它或它的 scratchpad 編碼）
  local pid="$1" p="${2%/}" cwd cmd enc
  [ -n "$p" ] || return 1
  cwd=$(dk_proc_cwd "$pid")
  case "$cwd/" in "$p/"*) return 0;; esac
  cmd=" $(dk_proc_cmd "$pid") "; enc=$(dk_path_enc "$p")
  case "$cmd" in *"$p/"*|*"$p "*|*"/$enc/"*) return 0;; esac
  return 1
}

dk__self_chain() { # → 自己與所有祖先的 pid，空白相隔（絕不收自己這一串）
  local p=$$ out=" "
  while [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null; do
    out="$out$p "; p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
  done
  printf '%s' "$out"
}

dk_reap_tied() { # PATH... → 收掉綁在任一 PATH 上的 listen 行程（TERM）；每收一支印「PID PORT CMD」
  local self port pid p cmd seen=" "
  [ "$#" -gt 0 ] || return 0
  self=$(dk__self_chain)
  while read -r port pid; do
    [ -n "$pid" ] || continue
    case "$self$seen" in *" $pid "*) continue;; esac
    for p in "$@"; do
      dk_proc_tied "$pid" "$p" || continue
      cmd=$(dk_proc_cmd "$pid")
      kill "$pid" 2>/dev/null && { seen="$seen$pid "; echo "$pid $port $cmd"; }
      break
    done
  done <<< "$(dk_listeners)"
}

dk_proc_orphan() { # PID ROOT → 行程綁著 ROOT/.worktrees/ 底下一個已經不存在的 worktree 就印那個路徑並回 0
  local pid="$1" root="${2%/}" cwd cmd enc tok d
  cwd=$(dk_proc_cwd "$pid"); cmd=$(dk_proc_cmd "$pid")
  # 明文路徑：取 .worktrees/ 之後的第一段（多 repo 的 <short>/<名> 也只要看第一段在不在）
  tok=$(printf '%s\n%s\n' "$cwd" "$cmd" | grep -oE "$root/\\.worktrees/[^/ ]+" | head -1 || true)
  if [ -n "$tok" ]; then [ -d "$tok" ] && return 1; echo "$tok"; return 0; fi
  # scratchpad 編碼：無法反解（- 可能原本是 / 或 .），改拿現存的 worktree 逐一編碼比對
  enc=$(dk_path_enc "$root/.worktrees/")
  tok=$(printf '%s\n' "$cmd" | grep -oE "/${enc}[A-Za-z0-9-]+/" | head -1 | tr -d /)
  [ -n "$tok" ] || return 1
  for d in "$root"/.worktrees/* "$root"/.worktrees/*/*; do
    [ -d "$d" ] && [ "$(dk_path_enc "$d")" = "$tok" ] && return 1
  done
  echo "$root/.worktrees/${tok#"$enc"}"; return 0
}

dk_reap_orphans() { # ROOT → 收掉綁在 ROOT 已刪除 worktree 上的 listen 行程；每收一支印「PID PORT WORKTREE CMD」
  local root="$1" self port pid wt cmd seen=" "
  self=$(dk__self_chain)
  while read -r port pid; do
    [ -n "$pid" ] || continue
    case "$self$seen" in *" $pid "*) continue;; esac
    wt=$(dk_proc_orphan "$pid" "$root") || continue
    cmd=$(dk_proc_cmd "$pid")
    kill "$pid" 2>/dev/null && { seen="$seen$pid "; echo "$pid $port $wt $cmd"; }
  done <<< "$(dk_listeners)"
}

dk_port_owner() { # PORT → 佔著它的「PID CMD」；沒人佔回 1
  local pid
  pid=$(dk_listeners | awk -v p="$1" '$1==p {print $2; exit}')
  [ -n "$pid" ] || return 1
  echo "$pid $(dk_proc_cmd "$pid")"
}
