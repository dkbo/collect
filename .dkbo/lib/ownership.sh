# shellcheck shell=bash
# dk_owned BRIEF STATE_NAME PATH → exit 0 if PATH matches one of the member's 可改 globs.
dk_owned() {
  local brief="$1" who="$2" path="$3" globs g
  globs=$(awk -F'|' -v w="$who" '{c=$2; gsub(/^ +| +$/, "", c)} c==w {print $3; exit}' "$brief" | tr ',' '\n' | sed 's/^ *//; s/ *$//')
  [ -n "$globs" ] || return 1
  while IFS= read -r g; do
    [ -n "$g" ] || continue
    # shellcheck disable=SC2254  # $g IS a glob pattern (brief 可改 column)
    case "$path" in
      $g) return 0;;
    esac
    # ** → match any depth: strip to prefix
    if [[ "$g" == *'/**' ]] && [[ "$path" == "${g%/**}"/* ]]; then return 0; fi
  done <<< "$globs"
  return 1
}
dk_touched() { awk '/^touched:/{t=1;next} t && /^  - /{sub(/^  - /,""); print; next} t && /^[^ ]/{t=0}' "$1"; }

# dk_changed_files WORKTREE BASE → one changed path per line since BASE: staged, unstaged and
# untracked work included, .gitignore respected, non-ASCII left unescaped. Uses a throwaway index,
# so the employees' real index is untouched (same trick as dk-review-pack).
dk_changed_files() {
  local wt="$1" base="$2" idx rc
  idx=$(mktemp) || return 1
  {                     # no helper function here: callers (dk-review-pack) have their own `gi`
    GIT_INDEX_FILE="$idx" git -c core.quotePath=false -C "$wt" read-tree HEAD &&
    GIT_INDEX_FILE="$idx" git -c core.quotePath=false -C "$wt" add -A &&
    GIT_INDEX_FILE="$idx" git -c core.quotePath=false -C "$wt" diff --cached --name-only "$base"
  }; rc=$?
  rm -f "$idx"
  return "$rc"
}
