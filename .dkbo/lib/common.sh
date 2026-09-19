# shellcheck shell=bash
# Shared helpers for dkbo bin scripts. Source, do not execute. No `set` here: bats sources this too.
case "${LC_ALL:-}" in *UTF-8*|*utf8*) ;; *) export LC_ALL=C.UTF-8;; esac
DK_ROOT="${DK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DK_PROJECT_ROOT="${DK_PROJECT_ROOT:-$(dirname "$DK_ROOT")}"
export DK_ROOT DK_PROJECT_ROOT

dk_die() { echo "dk: $*" >&2; exit 1; }
dk_now() { date +%Y-%m-%dT%H:%M; }
dk_today() { date +%Y-%m-%d; }
# Minor process 行的格式：'<ts> minor: <一句>' 或 '<ts> minor N: <一句>'。dk-review
# 與 dk-task-close 共用這一份，避免漏冒號的行被其中一邊看見、另一邊看不見。
DK_MINOR_RE='^[^ ]+ minor(: | [0-9]+: )'
dk_minor_lines() { grep -E "$DK_MINOR_RE" "$1" 2>/dev/null || true; }
dk_minor_count() { dk_minor_lines "$1" | grep -c . || true; }
# May return empty when the input has no a-z characters; callers must supply a fallback name.
dk_slug() {
  local s
  s=$(printf '%s' "$1" | tr '\n[:upper:]' ' [:lower:]' | sed -E 's/[^a-z0-9_-]+/-/g; s/^[^a-z]+//; s/-{2,}/-/g; s/-$//')
  printf '%s' "${s:0:32}"
}
# dkbo drives herdr for everything and its herdr failures are deliberately swallowed
# (dk_layout_even || true, agent list || return 0), so a wrong herdr shows up as a crooked
# layout or a watcher that silently never fires. These two say what has actually been verified.
DK_HERDR_MIN="0.9.0"        # below this dkbo refuses to run
DK_HERDR_VERIFIED="0.9"     # the series tests/integration/herdr-real.sh confirmed the JSON shapes of
dk_ver_ge() { # A B → 0 when version A >= B. Pure bash: `sort -V` is a GNU extension macOS's sort may lack,
  # and a lexical compare would call 0.10.0 older than 0.9.0. Deliberately unlike sort -V, 0.9 equals
  # 0.9.0 here: for a version floor a short version is not an older one.
  local a b i x y
  IFS=. read -ra a <<< "${1%%[!0-9.]*}"   # drop any -rc1 / +build suffix
  IFS=. read -ra b <<< "${2%%[!0-9.]*}"
  for ((i = 0; i < ${#a[@]} || i < ${#b[@]}; i++)); do
    x=$((10#0${a[i]:-0})) ; y=$((10#0${b[i]:-0}))   # 10# so a leading zero is decimal, not octal
    if ((x > y)); then return 0; fi
    if ((x < y)); then return 1; fi
  done
  return 0
}
dk_herdr_check() { # version floor + a one-shot warning above the verified series; no HERDR_ENV requirement
  local v
  v=$(herdr --version 2>/dev/null | awk 'NR==1{print $2}')
  [[ "$v" =~ ^[0-9]+\.[0-9]+ ]] || dk_die "cannot read 'herdr --version' (got '${v:-nothing}'); dkbo drives herdr for every command"
  dk_ver_ge "$v" "$DK_HERDR_MIN" || dk_die "herdr $v is older than the $DK_HERDR_MIN dkbo needs"
  case "$v" in
    "$DK_HERDR_VERIFIED"|"$DK_HERDR_VERIFIED".*) ;;
    *) if [ -z "${DK_HERDR_WARNED:-}" ]; then
         echo "dk: herdr $v is newer than the $DK_HERDR_VERIFIED.x series dkbo verified; run tests/integration/herdr-real.sh (zero tokens) to confirm the JSON shapes" >&2
         DK_HERDR_WARNED=1; export DK_HERDR_WARNED
       fi;;
  esac
}
dk_require_herdr() { [ "${HERDR_ENV:-}" = 1 ] || dk_die "not running inside herdr (HERDR_ENV!=1)"; dk_herdr_check; }
dk_json() { jq -r "$1"; }

dk_task_dir() {
  if [ -n "${DK_TASK_DIR:-}" ]; then echo "$DK_TASK_DIR"; return; fi
  local f="$DK_ROOT/.sessions/${HERDR_PANE_ID:-none}"
  [ -f "$f" ] || dk_die "no task bound to this pane; run dk-task-new or dk-resume <task>"
  echo "$DK_ROOT/tasks/$(cat "$f")"
}
dk_task_env() {
  local d; d=$(dk_task_dir) || return 1
  # shellcheck disable=SC1091
  set -a; . "$d/.task.env"; set +a
}
dk_process() { local d; d=$(dk_task_dir) || return 1; echo "$(dk_now) $*" >> "$d/process.md"; }
dk_leader_name() { echo "leader-${DK_SHORT:?}"; }
dk_agent_name() { local n="${DK_SHORT:?}-$1"; [ -n "${2:-}" ] && n="$n-$2"; echo "$n"; }
dk_state_name() { local n="$1"; [ -n "${2:-}" ] && n="$n-$2"; echo "$n"; }

dk_render() { # TEMPLATE_FILE KEY=VALUE... → stdout with every {{KEY}} replaced; values may contain any character
  local c kv; c=$(<"$1"); shift
  for kv in "$@"; do c=${c//"{{${kv%%=*}}}"/"${kv#*=}"}; done
  printf '%s\n' "$c"
}
dk_index_add() { local name="${2//|/／}"; name="${name//$'\n'/ }"; printf '| %s | %s | %s | %s | %s |\n' "$1" "$name" "$3" "$4" "$5" >> "$DK_ROOT/tasks/INDEX.md"; }
dk_index_set() { # NAME STATUS NOTE  — rewrite the row whose name column matches ('|' in NAME is stored as '／')
  # 非零＝沒有任何一列被改到。名稱是主鍵，而主鍵對不上是靜默的 —— 呼叫端必須接住這個非零。
  # 六個呼叫點的警告字串近乎逐字重複，是刻意的（與 dk_commit_memory 的既有體例一致）：
  # 要改措辭就六處一起改，不要只改一處。
  local name="${1//|/／}" status="$2" note="$3" f="$DK_ROOT/tasks/INDEX.md" rc=0
  awk -F'|' -v n="$name" -v s="$status" -v o="$note" 'BEGIN{OFS="|"}
    { if ($3 == " " n " ") { $5=" " s " "; $6=" " o " "; hit=1 } print }
    END { exit !hit }' "$f" > "$f.tmp" || rc=$?
  case "$rc" in
    0|1) mv "$f.tmp" "$f"; return "$rc";;    # 0 命中、1 沒命中；兩種情況 $f.tmp 都是完整的
    *)   rm -f "$f.tmp"; dk_die "dk_index_set: awk failed (rc=$rc) on $f";;
  esac
}

dk_settings() { # load .dkbo/settings.env over the defaults; warn once per process tree when the file is missing
  DK_TEST_CMD=""; DK_REVIEW_KINDS="claude"; DK_REVIEW_MIN="1"; DK_REVIEW_TIMEOUT_MIN="20"; DK_TAB1_SLOTS="4"; DK_LEADER_KIND="claude"; DK_WAVE_TIMEOUT_MIN="60"; DK_REVIEW_TIER="M"
  if [ -f "$DK_ROOT/settings.env" ]; then
    # shellcheck disable=SC1091
    . "$DK_ROOT/settings.env"
  elif [ -z "${DK_SETTINGS_WARNED:-}" ]; then
    echo "dk: $DK_ROOT/settings.env missing; using defaults (run /dkbo-init)" >&2; DK_SETTINGS_WARNED=1
  fi
  export DK_TEST_CMD DK_REVIEW_KINDS DK_REVIEW_MIN DK_REVIEW_TIMEOUT_MIN DK_TAB1_SLOTS DK_LEADER_KIND DK_WAVE_TIMEOUT_MIN DK_REVIEW_TIER DK_SETTINGS_WARNED
}
dk_commit_memory() { # <message> <path…> — commit只有這幾條路徑（任務／雜務記憶）到主樹
  # 記憶是 markdown、可 grep、進 git —— 但在這之前沒有任何一步真的把它們放進 git，
  # 結案後整個 tasks/<t>/ 還是 untracked，一個 git clean 就抹掉所有裁定理由。
  local msg="$1"; shift
  local p; local -a paths=()
  for p in "$@"; do [ -e "$p" ] && paths+=("$p"); done
  [ "${#paths[@]}" -gt 0 ] || return 0
  [ -n "$(git -C "$DK_PROJECT_ROOT" status --porcelain -- "${paths[@]}" 2>/dev/null)" ] || return 0
  git -C "$DK_PROJECT_ROOT" add -- "${paths[@]}" >/dev/null 2>&1 || return 1
  git -C "$DK_PROJECT_ROOT" commit -q -m "$msg" -- "${paths[@]}" >/dev/null 2>&1 || return 1
}
dk_env_set() { # KEY VALUE — rewrite KEY="VALUE" in the bound task's .task.env (append when missing). flock-serialised: dk-watch (background) and the leader's scripts both write this file.
  local d f lock; d=$(dk_task_dir) || return 1; f="$d/.task.env"; lock="$DK_ROOT/.sessions/$(basename "$d").lock"
  case "$2" in *[\"\\\$\`]*) dk_die "dk_env_set $1: value must not contain \" \\ \$ or backtick";; esac
  mkdir -p "$DK_ROOT/.sessions"
  (
    flock -w 5 9 || echo "dk_env_set: lock timeout on $lock; writing anyway" >&2
    if grep -q "^$1=" "$f"; then
      awk -v k="$1" -v v="$2" 'index($0, k "=")==1 {print k "=\"" v "\""; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    else echo "$1=\"$2\"" >> "$f"; fi
  ) 9>"$lock"
}
dk_legacy_task() { # task folder created before the wave-review scripts
  local d; d=$(dk_task_dir) || return 1; ! grep -q '^DK_BASE=' "$d/.task.env"
}
dk_wave_base() { # TASK_DIR N → the base sha dk-wave-open recorded for wave N (empty when absent)
  [[ "${2:-}" =~ ^[0-9]+$ ]] || return 0
  sed -n "s/^[^ ]* wave-open $2 base \([0-9a-f]*\).*/\1/p" "$1/process.md" | tail -1
}
