# shellcheck shell=bash
dk_kind_load() {
  local f="$DK_ROOT/kinds/$1.sh"; [ -f "$f" ] || dk_die "unknown kind: $1 (no $f)"
  # shellcheck disable=SC1090
  . "$f"
}
dk_kind_models() { echo "$KIND_MODEL_EFFORTS" | tr ' ' '\n' | cut -d: -f1 | tr '\n' ' ' | sed 's/ *$//'; }
dk_kind_model_efforts() { # model — the efforts that model really offers, empty when the model is unknown
  echo "$KIND_MODEL_EFFORTS" | tr ' ' '\n' | awk -F: -v m="$1" '$1==m{print $2}'
}
dk_kind_args() { # KIND model/effort — validate against the kind's per-model table, then emit its flags
  local kind="$1" model="${2%%/*}" effort="${2##*/}" allowed
  dk_kind_load "$kind"
  allowed=$(dk_kind_model_efforts "$model")
  [ -n "$allowed" ] || dk_die "kind $kind: unknown model '$model' (allowed: $(dk_kind_models))"
  [[ ",$allowed," == *",$effort,"* ]] || dk_die "kind $kind: unknown effort '$effort' for model '$model' (allowed: ${allowed//,/ })"
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
