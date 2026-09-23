# shellcheck shell=bash
dk_kind_load() {
  local f="$DK_ROOT/kinds/$1.sh"; [ -f "$f" ] || dk_die "unknown kind: $1 (no $f)"
  # shellcheck disable=SC1090
  . "$f"
}
dk_add_dirs() { # DK_ADD_DIRS 的每一項一個 --add-dir（空白分隔，預設只有主樹）
  # 員工的 cwd 是自己那個 repo 的 worktree，但切片、state、report 在主樹的 .dkbo/ 下，
  # 跨 repo 的成員還要讀寫別的 worktree —— 清單由 dk-spawn 組好（主樹 + .repos 每一列的
  # worktree，去重）並 export，三個 kind 的 kind_args 只負責展開它。
  local d; for d in ${DK_ADD_DIRS:-$DK_PROJECT_ROOT}; do printf ' --add-dir %s' "$d"; done
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
# 通用式同樣不收裸 `quota`：正常啟動就印得出這個字（agy 的 Antigravity Starter Quota 橫幅），
# 未知 kind 退回來的式子若會命中它，守望會把剛起來的員工當成撞額度的。
DK_RE_QUOTA_ANY='usage limit|rate limit|quota reached|quota exceeded|resource exhausted'
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

# --- 專案層熔斷：恢復時間解析與 kinds-down 檔（AC1/AC2/AC3/AC6）---------------------
# 純算術，不依賴 `date -d`（GNU 專屬）也不依賴 `date -r <epoch>`（GNU 與 BSD 對它的語義不同，
# lib/common.sh 的註解已經記過這個坑）。dk_ts_minutes 是 common.sh 既有的「civil date → 分鐘數」，
# 下面 dk_ts_from_minutes 是它的反函式（同一套 days_from_civil / civil_from_days 算術），
# dk_epoch_to_local 拿「這一刻」的 epoch 與本地牆鐘時間的落差當偏移量，把任意 epoch 換算成
# 本地時間字串顯示 —— 全程沒有呼叫外部指令做時區轉換。

dk_kind_month_num() { # 英文月份縮寫（不分大小寫）→ 1-12；認不得回非零
  local i=1 m want; want=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  for m in jan feb mar apr may jun jul aug sep oct nov dec; do
    [ "$m" = "$want" ] && { echo "$i"; return 0; }
    i=$((i + 1))
  done
  return 1
}

dk_kind_parse_agy_reset() { # TEXT → 秒數；認得「<N>h<M>m[<S>s]」與「<M>m[<S>s]」，認不得回非零
  local t="$1"
  if [[ "$t" =~ Resets\ in\ ([0-9]+)h([0-9]+)m(([0-9]+)s)? ]]; then
    local h="${BASH_REMATCH[1]}" mi="${BASH_REMATCH[2]}" s="${BASH_REMATCH[4]:-0}"
    echo $(( h * 3600 + mi * 60 + s )); return 0
  fi
  if [[ "$t" =~ Resets\ in\ ([0-9]+)m(([0-9]+)s)? ]]; then
    local mi2="${BASH_REMATCH[1]}" s2="${BASH_REMATCH[3]:-0}"
    echo $(( mi2 * 60 + s2 )); return 0
  fi
  return 1
}

dk_kind_parse_codex_reset() { # TEXT → "YYYY-MM-DDTHH:MM"；認「try again at <月> <日><序數>, <年> <時>:<分> <AM|PM>」
  local t="$1" mon day year hh mm ap m
  [[ "$t" =~ [Tt]ry\ again\ at\ ([A-Za-z]{3})\ ([0-9]{1,2})(st|nd|rd|th)?,\ ([0-9]{4})\ ([0-9]{1,2}):([0-9]{2})\ ([AaPp][Mm]) ]] \
    || return 1
  mon="${BASH_REMATCH[1]}"; day=$((10#${BASH_REMATCH[2]})); year=$((10#${BASH_REMATCH[4]}))
  hh=$((10#${BASH_REMATCH[5]})); mm=$((10#${BASH_REMATCH[6]})); ap=$(printf '%s' "${BASH_REMATCH[7]}" | tr '[:lower:]' '[:upper:]')
  m=$(dk_kind_month_num "$mon") || return 1
  [ "$ap" = PM ] && [ "$hh" -ne 12 ] && hh=$((hh + 12))
  [ "$ap" = AM ] && [ "$hh" -eq 12 ] && hh=0
  printf '%04d-%02d-%02dT%02d:%02d' "$year" "$m" "$day" "$hh" "$mm"
}

dk_kind_recover_epoch() { # KIND TEXT → "<epoch> exact|guess"；兩種都解析不到就現在＋5小時標 guess
  local kind="$1" text="$2" secs target diff now nowmin
  now=$(date +%s)
  case "$kind" in
    agy)
      if secs=$(dk_kind_parse_agy_reset "$text"); then printf '%s exact\n' "$((now + secs))"; return 0; fi ;;
    codex)
      if target=$(dk_kind_parse_codex_reset "$text"); then
        nowmin=$(dk_ts_minutes "$(dk_now)") && diff=$(( $(dk_ts_minutes "$target") - nowmin ))
        # 目標時間已經過去（時區不一致等）→ 那一列一寫進去就過期，等於沒熔斷；改標 guess
        # 才會真的落地成「現在＋5h」（reviewer-a 本輪 Minor）
        [ -n "${diff:-}" ] && [ "$diff" -gt 0 ] && { printf '%s exact\n' "$((now + diff * 60))"; return 0; }
      fi ;;
  esac
  printf '%s guess\n' "$((now + 5 * 3600))"
}

dk_utf8_trunc() { # TEXT N — 前 N 個 UTF-8 字元；只在字元邊界切，locale 中立（LC_ALL=C 下也不切半個
  # 位元組序列）：AC18 的教訓是 `cut -c` 按位元組算，切出半個字元會讓 herdr 拒收整則 [LIMIT]。
  # 走 od 逐位元組讀（純數字，不靠 grep/read 對文字的 locale 假設——那條路子在某些環境會把整行
  # 一起吞掉或黏成一個字元，比 `cut -c` 更難察覺），再用 printf 的八進位跳脫把位元組組回字串。
  local text="$1" n="${2:-160}" cnt=0 esc="" byte
  while read -r byte; do
    [ -n "$byte" ] || continue
    if [ $((byte & 0xC0)) -ne 128 ]; then   # 不是延續位元組（10xxxxxx）＝新字元開始
      cnt=$((cnt + 1))
      [ "$cnt" -gt "$n" ] && break
    fi
    esc="$esc\\$(printf '%03o' "$byte")"
  done < <(printf '%s' "$text" | od -An -v -tu1 | tr -s ' ' '\n' | sed '/^$/d')
  # esc 本身就是要展開的八進位跳脫序列組，不是使用者輸入
  # shellcheck disable=SC2059
  printf "$esc"
}

dk_ts_from_minutes() { # 分鐘數（同 dk_ts_minutes 的算術）→ "YYYY-MM-DDTHH:MM"，civil_from_days 是它的反函式
  local total="$1" days rem hh mi z era doe yoe y doy mp d m
  days=$(( total / 1440 )); rem=$(( total % 1440 ))
  hh=$(( rem / 60 )); mi=$(( rem % 60 ))
  z=$(( days + 719468 ))
  era=$(( z / 146097 ))
  doe=$(( z - era * 146097 ))
  yoe=$(( (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365 ))
  y=$(( yoe + era * 400 ))
  doy=$(( doe - (365 * yoe + yoe / 4 - yoe / 100) ))
  mp=$(( (5 * doy + 2) / 153 ))
  d=$(( doy - (153 * mp + 2) / 5 + 1 ))
  if [ "$mp" -lt 10 ]; then m=$((mp + 3)); else m=$((mp - 9)); fi
  [ "$m" -le 2 ] && y=$((y + 1))
  printf '%04d-%02d-%02dT%02d:%02d' "$y" "$m" "$d" "$hh" "$mi"
}

dk_epoch_to_local() { # EPOCH → 本地時間字串。拿「現在」的 epoch 與牆鐘分鐘數落差當偏移量，不呼叫 date -d/-r
  local epoch="$1" now_epoch now_min off
  now_epoch=$(date +%s); now_min=$(dk_ts_minutes "$(dk_now)")
  off=$(( now_min - now_epoch / 60 ))
  dk_ts_from_minutes $(( epoch / 60 + off ))
}

dk_kinds_down_file() { echo "$DK_ROOT/.sessions/kinds-down"; }

dk_kinds_down_rows() { # 只印恢復時間未到的列；讀的人略過過期列，不必當場刪
  local f; f=$(dk_kinds_down_file)
  [ -f "$f" ] || return 0
  awk -v now="$(date +%s)" '$2+0 > now' "$f"
}

dk_kinds_down_get() { dk_kinds_down_rows | awk -v k="$1" '$1==k{print; exit}'; } # KIND → 未過期的那一列（至多一列）

dk_kind_down_notice() { # KIND → 共用契約「kind 在專案層熔斷到 …，跳過」的整句；沒熔斷回非零
  local kind="$1" row k e _ex _rt tn _ag _hit
  row=$(dk_kinds_down_get "$kind"); [ -n "$row" ] || return 1
  read -r k e _ex _rt tn _ag _hit <<< "$row"
  printf 'kind %s 在專案層熔斷到 %s（%s），跳過' "$k" "$(dk_epoch_to_local "$e")" "$tn"
}

dk_kinds_down_set() { # KIND EPOCH exact|guess TASKNAME AGENT HIT — flock 序列化，同 kind 已有未過期列就取較晚的
  local kind="$1" epoch="$2" exact="$3" taskname="$4" agent="$5" hit="$6"
  local f lock; f=$(dk_kinds_down_file); lock="$DK_ROOT/.sessions/kinds-down.lock"
  mkdir -p "$(dirname "$f")"
  (
    flock -w 5 9 || echo "dk_kinds_down_set: lock timeout on $lock; writing anyway" >&2
    local now recorded tmp k e2 ex2 rt tn ag2 rest wrote
    now=$(date +%s); recorded=$(dk_now); tmp="$f.tmp.$$"; wrote=0
    : > "$tmp"
    if [ -f "$f" ]; then
      while IFS=' ' read -r k e2 ex2 rt tn ag2 rest; do
        [ -n "$k" ] || continue
        if [ "$k" = "$kind" ] && [ "${e2:-0}" -gt "$now" ] 2>/dev/null; then
          wrote=1
          if [ "$epoch" -gt "$e2" ]; then
            printf '%s %s %s %s %s %s %s\n' "$kind" "$epoch" "$exact" "$recorded" "$taskname" "$agent" "$hit" >> "$tmp"
          else
            printf '%s %s %s %s %s %s %s\n' "$k" "$e2" "$ex2" "$rt" "$tn" "$ag2" "$rest" >> "$tmp"
          fi
        else
          printf '%s %s %s %s %s %s %s\n' "$k" "$e2" "$ex2" "$rt" "$tn" "$ag2" "$rest" >> "$tmp"
        fi
      done < "$f"
    fi
    [ "$wrote" = 1 ] || printf '%s %s %s %s %s %s %s\n' "$kind" "$epoch" "$exact" "$recorded" "$taskname" "$agent" "$hit" >> "$tmp"
    mv "$tmp" "$f"
  ) 9>"$lock"
}

dk_kinds_down_remove() { # KIND → 0 表示真的拿掉了至少一列；沒有檔或沒命中回 1
  local kind="$1" f lock rc dropped
  f=$(dk_kinds_down_file); lock="$DK_ROOT/.sessions/kinds-down.lock"
  [ -f "$f" ] || return 1
  mkdir -p "$(dirname "$lock")"
  (
    flock -w 5 9 || echo "dk_kinds_down_remove: lock timeout on $lock; writing anyway" >&2
    local tmp; tmp="$f.tmp.$$"
    dropped=$(awk -v k="$kind" '$1==k{c++} END{print c+0}' "$f")
    awk -v k="$kind" '$1!=k' "$f" > "$tmp"
    if [ "$dropped" -eq 0 ]; then rm -f "$tmp"; exit 1; fi
    mv "$tmp" "$f"; exit 0
  ) 9>"$lock"
  rc=$?
  return "$rc"
}
