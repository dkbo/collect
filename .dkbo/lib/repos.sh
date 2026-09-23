# shellcheck shell=bash
# 多 repo 的解析、驗證與 .repos 讀寫。Source，不要執行。需要先 source common.sh。
#
# 一個任務可以跨 N 個獨立 git repo：`settings.env` 的 `DK_REPOS` 列出它們，格式
# `<名>=<路徑> <名>=<路徑> …`（空白分隔，路徑相對 `DK_PROJECT_ROOT`，第一個必須是主 repo）。
# `DK_REPOS` 是空字串＝單 repo 模式，行為與 0.9.2 相同；為了讓每個呼叫端只有一條路，
# 單 repo 模式在這裡也長成「一列、名字固定 main」的樣子，但任何面向人的輸出都不印前綴。
#
# 路徑不得含空白：`.repos` 是四欄空白分隔，DK_REPOS 也是空白分隔項目。這是刻意的取捨
# （awk/read 切得動、人看得懂），要放含空白的路徑就得換掉整個格式。

DK_REPO_NAME_RE='^[a-z][a-z0-9_]{0,15}$'   # 要能當 shell 變數名的尾巴（DK_TEST_CMD_<名>）

dk__repo_abs() { # PATH → 絕對路徑（相對者接在 DK_PROJECT_ROOT 之後）；存在就順便解析 symlink
  local p="$1"
  case "$p" in /*) ;; *) p="$DK_PROJECT_ROOT/$p";; esac
  if [ -d "$p" ]; then (cd "$p" && pwd -P); else printf '%s\n' "$p"; fi
}

dk_repos_parse() { # → 每列 "<名> <絕對路徑>"；DK_REPOS 空字串時一列 "main <DK_PROJECT_ROOT>"
  local e n p
  if [ -z "${DK_REPOS:-}" ]; then printf 'main %s\n' "$(dk__repo_abs .)"; return 0; fi
  for e in $DK_REPOS; do
    case "$e" in
      *=*) n="${e%%=*}"; p=$(dk__repo_abs "${e#*=}");;
      *)   n="$e"; p="";;    # 缺 = —— 路徑欄留空，由 dk_repos_check 點名
    esac
    printf '%s %s\n' "$n" "$p"
  done
}

dk_repos_multi() { [ -n "${DK_REPOS:-}" ]; }   # 0 ⟺ 多 repo 模式

dk_repos_check() { # [--no-clean] — 驗名字、唯一性、第一個是主 repo、每個路徑是乾淨的 git 根；不過就 dk_die 並點名
  # --no-clean 跳過「工作樹乾淨」那一項：dk-task-new 只做名字／主 repo／git 根三項（便宜、早失敗），
  # 「乾淨」留到 dk-leader --run 真的要從 HEAD 切 worktree 的那一刻才驗（plan.md 第 7 節）。
  local n p seen=" " main first=1 clean=1
  [ "${1:-}" = --no-clean ] && clean=0
  main=$(dk__repo_abs .)
  while read -r n p; do
    [ -n "$n" ] || continue
    [ -n "$p" ] || dk_die "DK_REPOS: 「$n」格式須為 <名>=<路徑>"
    [[ "$n" =~ $DK_REPO_NAME_RE ]] || dk_die "DK_REPOS: repo 名字「$n」不合法（須符合 [a-z][a-z0-9_]{0,15}）"
    # 用 if 不用 `[[ … ]] && dk_die`：條件為假時整個 && 回非零，呼叫端在 set -e 下會當場退出
    if [[ "$seen" == *" $n "* ]]; then dk_die "DK_REPOS: repo 名字「$n」重複"; fi
    seen="$seen$n "
    if [ "$first" = 1 ]; then
      [ "$p" = "$main" ] || dk_die "DK_REPOS: 第一個必須是主 repo（路徑 .，也就是 $main），得到「$n」=$p"
      first=0
    fi
    [ "$(git -C "$p" rev-parse --show-toplevel 2>/dev/null)" = "$p" ] \
      || dk_die "DK_REPOS: repo「$n」的路徑 $p 不是 git repo 的根"
    # 只看已追蹤檔（領導 2026-09-20T09:41 ruling）：員工的 worktree 是從 HEAD 切出來的，
    # 未追蹤檔本來就不影響它；把未追蹤也算髒的話，.dkbo/ 不進版控的專案（panova 那一類）
    # 每一次 dk-leader --run 都會被自己的 .dkbo/ 擋下來。
    # 主 repo 排除 .dkbo/ 底下的路徑（reviewer-a Important 1）：dkbo 自己的任務記帳
    # （INDEX.md／process.md…）從 dk-task-new 到 dk-task-close 之間永遠是已追蹤且已修改，
    # 那不是「工作樹不乾淨」，是這套工具本身在寫日記；在把 .dkbo/ 進版控的專案（含本倉）上
    # 不排除的話，--run 會被自己的任務記帳擋死。.dkbo/ 只存在於主 repo，其餘 repo 這條
    # pathspec 排除不到東西，行為不變。
    local dirty
    if [ "$p" = "$main" ]; then dirty=$(git -C "$p" status --porcelain --untracked-files=no -- . ':!.dkbo' 2>/dev/null)
    else dirty=$(git -C "$p" status --porcelain --untracked-files=no 2>/dev/null); fi
    if [ "$clean" = 1 ] && [ -n "$dirty" ]; then
      dk_die "DK_REPOS: repo「$n」的工作樹不乾淨：有已追蹤檔尚未 commit，先 commit 或 stash（$p）"
    fi
  done <<< "$(dk_repos_parse)"
}

dk_repos_write() { # TASK_DIR SHORT WT_ROOT — 建 .repos。只算路徑與 base sha，不切 worktree。
  # worktree 佈局：多 repo `<WT_ROOT>/<short>/<名>`，單 repo `<WT_ROOT>/<short>`（0.9.2 的位置）。
  local d="$1" short="$2" wtroot="$3" n p wt
  : > "$d/.repos"
  while read -r n p; do
    [ -n "$n" ] && [ -n "$p" ] || continue
    if dk_repos_multi; then wt="$wtroot/$short/$n"; else wt="$wtroot/$short"; fi
    printf '%s %s %s %s\n' "$n" "$p" "$wt" "$(git -C "$p" rev-parse HEAD)" >> "$d/.repos"
  done <<< "$(dk_repos_parse)"
}

dk_repos_rows() { # TASK_DIR → .repos 的資料列（跳過空行）；沒有 .repos 回非零
  [ -f "$1/.repos" ] || return 1
  grep -v '^[[:space:]]*$' "$1/.repos" || true
}
dk_repo_field() { # TASK_DIR NAME root|wt|base → 該欄的值（未知 repo 或未知欄回空）
  local col
  case "$3" in root) col=2;; wt) col=3;; base) col=4;; *) return 0;; esac
  dk_repos_rows "$1" 2>/dev/null | awk -v n="$2" -v c="$col" '$1==n{print $c; exit}'
}
dk_repos_names() { dk_repos_rows "$1" 2>/dev/null | awk '{print $1}'; }   # 主 repo 在第一列

# ── glob 前綴（共用契約：所有權與 touched 一律 <名>:<glob>）────────────────────
dk_glob_split() { # "<名>:<glob>" → "<名>\t<glob>"；沒前綴 → "\t<glob>"
  # 判別器是名字的形狀，不是「有沒有冒號」：路徑本身可以含冒號，而 <名> 限 [a-z][a-z0-9_]{0,15}。
  if [[ "$1" =~ ^([a-z][a-z0-9_]{0,15}): ]]; then
    printf '%s\t%s\n' "${BASH_REMATCH[1]}" "${1#*:}"
  else
    printf '\t%s\n' "$1"
  fi
}
dk_repos_known() { # TASK_DIR → 合法的 repo 名字。已實體化的任務以 .repos 為準，
  # 計畫階段（還沒有 .repos）退回 DK_REPOS —— dk-brief-check 是在關卡①之前跑的。
  local d="${1:-}"
  if [ -n "$d" ] && [ -f "$d/.repos" ]; then dk_repos_names "$d"; else dk_repos_parse | awk '{print $1}'; fi
}
dk_glob_check() { # TASK_DIR GLOB → 0＝合法；非零時 stdout 是理由（給 dk-brief-check 當 FAIL 訊息）
  local d="${1:-}" g="$2" name
  name=$(dk_glob_split "$g" | cut -f1)
  if dk_repos_multi; then
    [ -n "$name" ] || { echo "多 repo 模式的 glob 必須帶 <名>: 前綴：$g"; return 1; }
    printf '%s\n' "$(dk_repos_known "$d")" | grep -qx "$name" \
      || { echo "未知的 repo 名字 $name（不在 DK_REPOS 裡）：$g"; return 1; }
  else
    [ -z "$name" ] || { echo "單 repo 模式的 glob 不得帶 <名>: 前綴：$g"; return 1; }
  fi
  return 0
}

dk_repo_setup_cmd() { # NAME → 該 repo 的依賴鉤子：主 repo 讀 DK_SETUP_CMD，其餘讀 DK_SETUP_CMD_<名>
  # bash 3.2 沒有關聯陣列，用 ${!v} 間接展開；名字的合法字元集就是為了這一行才收到 [a-z0-9_]。
  local n="$1" main v
  main=$(dk_repos_parse | awk 'NR==1{print $1}')
  if [ "$n" = "$main" ]; then printf '%s\n' "${DK_SETUP_CMD:-}"; return 0; fi
  [[ "$n" =~ $DK_REPO_NAME_RE ]] || return 0
  v="DK_SETUP_CMD_$n"
  printf '%s\n' "${!v:-}"
}
