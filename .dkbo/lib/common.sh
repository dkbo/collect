# shellcheck shell=bash
# Shared helpers for dkbo bin scripts. Source, do not execute. No `set` here: bats sources this too.
case "${LC_ALL:-}" in *UTF-8*|*utf8*) ;; *) export LC_ALL=C.UTF-8;; esac
DK_ROOT="${DK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DK_PROJECT_ROOT="${DK_PROJECT_ROOT:-$(dirname "$DK_ROOT")}"
export DK_ROOT DK_PROJECT_ROOT

dk_die() { echo "dk: $*" >&2; exit 1; }
dk_now() { date +%Y-%m-%dT%H:%M; }
dk_today() { date +%Y-%m-%d; }
# May return empty when the input has no a-z characters; callers must supply a fallback name.
dk_slug() {
  local s
  s=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_-]+/-/g; s/^[^a-z]+//; s/-{2,}/-/g; s/-$//')
  printf '%s' "${s:0:32}"
}
dk_require_herdr() { [ "${HERDR_ENV:-}" = 1 ] || dk_die "not running inside herdr (HERDR_ENV!=1)"; }
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
dk_index_add() { local name="${2//|/／}"; printf '| %s | %s | %s | %s | %s |\n' "$1" "$name" "$3" "$4" "$5" >> "$DK_ROOT/tasks/INDEX.md"; }
dk_index_set() { # NAME STATUS NOTE  — rewrite the row whose name column matches ('|' in NAME is stored as '／')
  local name="${1//|/／}" status="$2" note="$3" f="$DK_ROOT/tasks/INDEX.md"
  awk -F'|' -v n="$name" -v s="$status" -v o="$note" 'BEGIN{OFS="|"}
    { if ($3 == " " n " ") { $5=" " s " "; $6=" " o " " } print }' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}

dk_settings() { # load .dkbo/settings.env over the defaults; warn once per process tree when the file is missing
  DK_TEST_CMD=""; DK_REVIEW_KINDS="claude"; DK_REVIEW_MIN="1"; DK_REVIEW_TIMEOUT_MIN="20"; DK_TAB1_SLOTS="4"
  if [ -f "$DK_ROOT/settings.env" ]; then
    # shellcheck disable=SC1091
    . "$DK_ROOT/settings.env"
  elif [ -z "${DK_SETTINGS_WARNED:-}" ]; then
    echo "dk: $DK_ROOT/settings.env missing; using defaults (run /dkbo-init)" >&2; DK_SETTINGS_WARNED=1
  fi
  export DK_TEST_CMD DK_REVIEW_KINDS DK_REVIEW_MIN DK_REVIEW_TIMEOUT_MIN DK_TAB1_SLOTS DK_SETTINGS_WARNED
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
