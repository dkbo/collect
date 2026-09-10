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
