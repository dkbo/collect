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

# herdr 的 agent_status 不是可靠的「卡住」訊號。0.6.2 在 panova2 實測：agy 停在權限審批 UI
# 時它回 idle，codex 撞額度時也回 idle —— 整條 blocked 安全網對這兩個 kind 都是空轉的。
# 唯一不會騙人的是畫面上印出來的字，所以每個 kind 在自己的 kinds/<k>.sh 宣告 KIND_BLOCK_RE
# 與 KIND_QUOTA_RE。式子限用兩邊都吃得下的子集：grep -iE（dk-watch 讀畫面）與
# herdr pane wait-output --regex（Rust regex）。
DK_RE_BLOCK_ANY='Do you want|Run this command|Requesting permission|Allow command|\[y/n\]'
DK_RE_QUOTA_ANY='usage limit|rate limit|quota|resource exhausted'
dk_kind_re() { # KIND block|quota — 該 kind 的畫面特徵。未知 kind 退回通用式，絕不回空：
  # 回空會讓 grep -E '' 命中每一行，把整個守望變成「所有人都卡住了」。
  local kind="$1" what="$2" f="$DK_ROOT/kinds/$1.sh" v=""
  if [ -n "$kind" ] && [ -f "$f" ]; then
    v=$(
      # shellcheck disable=SC1090
      . "$f" >/dev/null 2>&1
      case "$what" in block) printf '%s' "${KIND_BLOCK_RE:-}";; quota) printf '%s' "${KIND_QUOTA_RE:-}";; esac
    )
  fi
  if [ -z "$v" ]; then
    case "$what" in block) v="$DK_RE_BLOCK_ANY";; quota) v="$DK_RE_QUOTA_ANY";; *) v="$DK_RE_BLOCK_ANY";; esac
  fi
  printf '%s\n' "$v"
}
