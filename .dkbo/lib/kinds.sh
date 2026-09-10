# shellcheck shell=bash
dk_kind_load() {
  local f="$DK_ROOT/kinds/$1.sh"; [ -f "$f" ] || dk_die "unknown kind: $1 (no $f)"
  # shellcheck disable=SC1090
  . "$f"
}
dk_kind_args() { # KIND model/effort
  local kind="$1" model="${2%%/*}" effort="${2##*/}"
  dk_kind_load "$kind"
  [[ " $KIND_MODELS " == *" $model "* ]]  || dk_die "kind $kind: unknown model '$model' (allowed: $KIND_MODELS)"
  [[ " $KIND_EFFORTS " == *" $effort "* ]] || dk_die "kind $kind: unknown effort '$effort' (allowed: $KIND_EFFORTS)"
  kind_args "$model" "$effort"
}
dk_kinds_available() {
  local supported k
  supported=$(herdr agent start --help 2>&1 | sed -n 's/.*possible values: \(.*\)\].*/\1/p' | tr -d ',')
  for k in $supported; do
    [ -f "$DK_ROOT/kinds/$k.sh" ] || continue
    command -v "$k" >/dev/null 2>&1 || continue
    echo "$k"
  done
}
