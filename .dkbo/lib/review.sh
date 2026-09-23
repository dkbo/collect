# shellcheck shell=bash
# 審查共用：kind 選擇、檔位驗證與 spawn 迴圈。dk-review（差異包）與 dk-brief-review（計畫）共用這一份。
# 需要先 source common.sh（dk_die）、載入 .task.env（DK_KIND_DOWN）與 settings.env（DK_REVIEW_TIER）。
# dk-review／dk-brief-review 沒有 source lib/kinds.sh（AC3 之前它們不需要），這裡的專案層查詢
# 要用到 dk_kind_down_notice —— 補一道 source 讓它自給自足，不必去改那兩支呼叫端（不屬於本檔所有權）。
# shellcheck disable=SC1091
[ -n "${DK_KIND_LOADED:-}" ] || { . "$DK_ROOT/lib/kinds.sh"; DK_KIND_LOADED=1; }

dk_review_tier() { # TIER_FLAG → M|L；空字串表示沒給 --tier，改取 settings.env
  local tier="${1:-}" src="--tier"
  [ -n "$tier" ] || { tier="${DK_REVIEW_TIER:-}"; src="settings.env 的 DK_REVIEW_TIER"; }
  [[ "$tier" =~ ^[ML]$ ]] || dk_die "$src 是 '$tier'：reviewer 檔位只能是 M 或 L"
  printf '%s' "$tier"
}

dk_review_kinds() { # WANT CMD LABEL → 可用的 kind（≤3，濾掉本任務已熔斷與專案層已熔斷的）；全滅回非零
  local want="$1" cmd="$2" label="$3" k use="" notice
  for k in $want; do
    if [[ " ${DK_KIND_DOWN:-} " == *" $k "* ]]; then
      echo "$cmd: kind $k is down for this task; skipped" >&2; continue
    fi
    if notice=$(dk_kind_down_notice "$k"); then echo "$cmd: $notice" >&2; continue; fi
    use="$use $k"
  done
  # shellcheck disable=SC2086  # split kinds on purpose
  use=$(printf '%s\n' $use | head -3 | tr '\n' ' ')
  if [ -z "${use// /}" ]; then
    echo "$cmd: no reviewer kind available; record: dk-process \"$label skipped: all kinds down\"" >&2
    return 1
  fi
  printf '%s' "$use"
}

dk_review_aliases() { # ALL_ALIASES KINDS → 前 N 個別名（N = kind 數），與 KINDS 一一對應
  local all="$1" n=0 k out=""
  # shellcheck disable=SC2086  # split kinds on purpose
  for k in $2; do n=$((n+1)); done
  # shellcheck disable=SC2086  # split aliases on purpose
  set -- $all
  while [ "$n" -gt 0 ] && [ $# -gt 0 ]; do out="${out:+$out }$1"; shift; n=$((n-1)); done
  printf '%s' "$out"
}

# 兩支審查腳本的差別只在「審什麼」：切片用哪份範本、別名怎麼取、訊息裡叫什麼名字。
# 派工本身（逐位 spawn、rc 與空輸出的三種下場、spawned 累積、全滅才死）完全一樣。
# 切法是兩段：呼叫端自己跑 render 迴圈把切片產齊，這一支只管派 —— 它假設
# briefs/reviewer-<別名>.md 已經在那裡。沒有回呼、沒有 eval，bash 3.2 相容。
dk_review_spawn() { # KINDS ALIASES TIER CMD LABEL — ALIASES 與 KINDS 一一對應（見 dk_review_aliases）；
  # 切片須已產在 briefs/reviewer-<別名>.md
  local kinds="$1" tier="$3" cmd="$4" label="$5"
  local k al out rc spawned="" failed=""
  # 用位置參數走訪別名：函式的 $@ 在上面五個值存進 local 之後就沒人要了，而 bash 3.2
  # 沒有好用的「取陣列第 n 個」寫法。
  # shellcheck disable=SC2086  # split aliases on purpose
  set -- $2
  for k in $kinds; do
    al="$1"; shift
    if out=$("$DK_ROOT/bin/dk-spawn" reviewer "$al" --isolated --kind "$k" --tier "$tier"); then rc=0; else rc=$?; fi
    if [ -n "$out" ] && [ "$rc" = 0 ]; then
      spawned="$spawned ${out%% *}($k)"
    elif [ -n "$out" ]; then
      spawned="$spawned ${out%% *}($k,prompt-failed)"
      echo "$cmd: first prompt to ${out%% *} failed; herdr agent read it, then re-prompt" >&2
    else
      echo "$cmd: could not spawn reviewer $al ($k)" >&2; failed="$failed $k"
    fi
  done
  [ -n "$spawned" ] || dk_die "no reviewer spawned (dk-spawn failed for:$failed); check herdr, then retry $cmd or record: dk-process \"$label skipped: <理由>\""
  dk_process "$label spawned$spawned"
  echo "$label:$spawned"
}
