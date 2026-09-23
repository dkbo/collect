# shellcheck shell=bash
# Shared helpers for dkbo bin scripts. Source, do not execute. No `set` here: bats sources this too.
case "${LC_ALL:-}" in *UTF-8*|*utf8*) ;; *) export LC_ALL=C.UTF-8;; esac
DK_ROOT="${DK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DK_PROJECT_ROOT="${DK_PROJECT_ROOT:-$(dirname "$DK_ROOT")}"
export DK_ROOT DK_PROJECT_ROOT

dk_die() { echo "dk: $*" >&2; exit 1; }
dk_now() { date +%Y-%m-%dT%H:%M; }
dk_today() { date +%Y-%m-%d; }
# "YYYY-MM-DDTHH:MM" → 自 epoch 起的分鐘數。純算術是刻意的：`date -d` 只有 GNU 有、
# `date -j` 只有 BSD 有、`mktime` 只有 gawk 有 —— 三條路各自會在另外兩種機器上斷掉。
# 曆法用 days_from_civil：把三月當成一年的開頭，閏日就落在年尾，跨月與跨年都不必特判。
# 兩個時間戳相減才有意義（時區一致即可）；格式不對回非零、不印東西。
dk_ts_minutes() {
  local y m d hh mi yy era yoe doy doe days
  [[ "$1" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})$ ]] || return 1
  y=$((10#${BASH_REMATCH[1]})); m=$((10#${BASH_REMATCH[2]})); d=$((10#${BASH_REMATCH[3]}))
  hh=$((10#${BASH_REMATCH[4]})); mi=$((10#${BASH_REMATCH[5]}))   # 10# so 08/09 stay decimal
  ((m >= 1 && m <= 12 && d >= 1 && d <= 31 && hh <= 23 && mi <= 59)) || return 1
  yy=$((m <= 2 ? y - 1 : y))
  era=$(( (yy >= 0 ? yy : yy - 399) / 400 ))
  yoe=$(( yy - era * 400 ))
  doy=$(( (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1 ))
  doe=$(( yoe * 365 + yoe / 4 - yoe / 100 + doy ))
  days=$(( era * 146097 + doe - 719468 ))
  echo $(( days * 1440 + hh * 60 + mi ))
}
dk_span() { # START_TS END_TS → "Nm"；任一端缺或壞掉就 "—"
  # 缺來源印「—」而不是 0：沒量到和量到零是兩件事，印 0 會讓時間表憑空多出一段假的即時完成。
  local a b
  [ -n "${1:-}" ] && [ -n "${2:-}" ] || { echo "—"; return 0; }
  a=$(dk_ts_minutes "$1") || { echo "—"; return 0; }
  b=$(dk_ts_minutes "$2") || { echo "—"; return 0; }
  echo "$((b - a))m"
}
dk_ts_pick() { # FILE TOK2 [TOK3] [TOK4] → 最後一筆第 2/3/4 欄依序相等的行的時間戳；空字串＝該欄不限
  # 比對欄位而不是把 awk 條件當字串傳進來：條件字串裡的 $2 對 shellcheck 是沒展開的 shell
  # 變數（SC2016），而且引號怎麼下會散在每個呼叫端。process.md 的 token 本來就是靠欄位定位的。
  awk -v a="${2:-}" -v b="${3:-}" -v c="${4:-}" '
    (a == "" || $2 == a) && (b == "" || $3 == b) && (c == "" || $4 == c) { t = $1 }
    END { if (t != "") print t }' "$1"
}
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
  # return 0 而不是裸 return：bash 規定 trap handler 裡執行的裸 return 回的是「觸發 trap 的
  # 那個狀態」，不是函式最後一個指令的狀態。dk_env_set 的第一行是 `d=$(dk_task_dir) || return 1`，
  # 所以掛了 rollback 型 trap EXIT 的失敗路徑上，每一次 dk_env_set 都在第一行靜默退出。
  if [ -n "${DK_TASK_DIR:-}" ]; then echo "$DK_TASK_DIR"; return 0; fi
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
  DK_REPOS=""; DK_SETUP_CMD=""
  if [ -f "$DK_ROOT/settings.env" ]; then
    # shellcheck disable=SC1091
    . "$DK_ROOT/settings.env"
  elif [ -z "${DK_SETTINGS_WARNED:-}" ]; then
    echo "dk: $DK_ROOT/settings.env missing; using defaults (run /dkbo-init)" >&2; DK_SETTINGS_WARNED=1
  fi
  export DK_TEST_CMD DK_REVIEW_KINDS DK_REVIEW_MIN DK_REVIEW_TIMEOUT_MIN DK_TAB1_SLOTS DK_LEADER_KIND DK_WAVE_TIMEOUT_MIN DK_REVIEW_TIER DK_SETTINGS_WARNED
  export DK_REPOS DK_SETUP_CMD
  # DK_TEST_CMD_<名> 與 DK_SETUP_CMD_<名> 是每個 repo 一條的動態鍵，沒辦法在預設區列舉；
  # source 完之後一起 export，子行程（dk-wave-close 起的 gate c、dk-leader 起的鉤子）才看得見。
  local v
  for v in ${!DK_TEST_CMD_@} ${!DK_SETUP_CMD_@}; do export "${v?}"; done
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
dk_wave_base() { # TASK_DIR N [REPO] → the base sha dk-wave-open recorded for wave N (empty when absent)
  # 帶 REPO 時讀 per-repo 那一行（`wave-open N repo <名> base <sha>`），不帶時行為與 0.9.2 相同
  # （`wave-open N base <sha>`，記的是主 repo）。REPO 先過名字的形狀才拼進 sed —— 這個值
  # 最終來自 settings.env 與 .repos，不該有機會變成 sed 的表示式。
  [[ "${2:-}" =~ ^[0-9]+$ ]] || return 0
  if [ -n "${3:-}" ]; then
    [[ "$3" =~ ^[a-z][a-z0-9_]{0,15}$ ]] || return 0
    sed -n "s/^[^ ]* wave-open $2 repo $3 base \([0-9a-f]*\).*/\1/p" "$1/process.md" | tail -1
  else
    sed -n "s/^[^ ]* wave-open $2 base \([0-9a-f]*\).*/\1/p" "$1/process.md" | tail -1
  fi
}
