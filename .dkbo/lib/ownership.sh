# shellcheck shell=bash
# 檔案所有權的比對。需要先 source common.sh；前綴規則整套在 repos.sh。
# 呼叫端有些只 source 了 ownership.sh，所以缺了就自己補上（source 兩次是冪等的）。
# shellcheck source=/dev/null
command -v dk_glob_split >/dev/null 2>&1 || . "$DK_ROOT/lib/repos.sh"

# dk_owned BRIEF STATE_NAME PATH → exit 0 if PATH matches one of the member's 可改 globs.
# 多 repo 模式下 PATH 與 glob 都帶 `<名>:` 前綴，前綴不同就不比 —— 兩個 repo 裡的同名路徑
# 是兩個檔。單 repo 模式兩邊都沒有前綴，比法與 0.9.2 相同。
dk_owned() {
  local brief="$1" who="$2" path="$3" globs g s prepo ppath grepo gglob
  globs=$(awk -F'|' -v w="$who" '{c=$2; gsub(/^ +| +$/, "", c)} c==w {print $3; exit}' "$brief" | tr ',' '\n' | sed 's/^ *//; s/ *$//')
  [ -n "$globs" ] || return 1
  # 用參數展開切，不用 `IFS=$'\t' read`：tab 是 IFS 的空白字元，read 會把「開頭的空欄」
  # 整個吃掉 —— 沒有前綴的 "\tsrc/api/**" 會被讀成 repo=src/api/** 、glob 空。
  s=$(dk_glob_split "$path"); prepo="${s%%$'\t'*}"; ppath="${s#*$'\t'}"
  while IFS= read -r g; do
    [ -n "$g" ] || continue
    s=$(dk_glob_split "$g"); grepo="${s%%$'\t'*}"; gglob="${s#*$'\t'}"
    [ "$grepo" = "$prepo" ] || continue
    # shellcheck disable=SC2254  # $gglob IS a glob pattern (brief 可改 column)
    case "$ppath" in
      $gglob) return 0;;
    esac
    # ** → match any depth: strip to prefix
    if [[ "$gglob" == *'/**' ]] && [[ "$ppath" == "${gglob%/**}"/* ]]; then return 0; fi
  done <<< "$globs"
  return 1
}
dk_touched() { awk '/^touched:/{t=1;next} t && /^  - /{sub(/^  - /,""); print; next} t && /^[^ ]/{t=0}' "$1"; }

# dk_changed_files WORKTREE BASE → one changed path per line since BASE: staged, unstaged and
# untracked work included, .gitignore respected, non-ASCII left unescaped. Uses a throwaway index,
# so the employees' real index is untouched (same trick as dk-review-pack).
dk_changed_files() {
  local wt="$1" base="$2" idx rc
  [ -n "$base" ] || return 0
  idx=$(mktemp) || return 1
  {                     # no helper function here: callers (dk-review-pack) have their own `gi`
    GIT_INDEX_FILE="$idx" git -c core.quotePath=false -C "$wt" read-tree HEAD &&
    GIT_INDEX_FILE="$idx" git -c core.quotePath=false -C "$wt" add -A &&
    GIT_INDEX_FILE="$idx" git -c core.quotePath=false -C "$wt" diff --cached --name-only "$base"
  }; rc=$?
  rm -f "$idx"
  return "$rc"
}

# dk_changed_repo_files TASK_DIR N → 本波所有 repo 的變更路徑，多 repo 模式每行帶 `<名>:` 前綴。
# 呼叫端只有 dk-wave-close（gate d），波 2 由 backend-gates 換過去；在那之前 dk_changed_files
# 維持 0.9.2 的 WORKTREE BASE 簽名不動（領導 2026-09-20T09:41 ruling：改名而不是相容雙形狀，
# 雙形狀會讓 gate d 在參數寫錯時靜默放行）。每個 repo 用自己的 base：先找 dk-wave-open 記的
# `wave-open N repo <名> base <sha>`，主 repo 再退回 0.9.2 那行 `wave-open N base <sha>`，
# 都沒有就退回 `.repos` 記的實體化 sha（那一波沒開過，比不到 base 總比整支炸掉好）。
dk_changed_repo_files() {
  local d="$1" n="$2" name wt base b main multi=1 rc=0 out
  local _root   # .repos 的第二欄（repo 根）在這裡用不到，但 read 要吃掉它
  dk_repos_multi || multi=0
  if ! dk_repos_rows "$d" >/dev/null 2>&1; then
    # 0.9.2 之前建立的任務沒有 .repos：退回單一 worktree 與單一 base
    dk_changed_files "${DK_WORKTREE:-}" "$(dk_wave_base "$d" "$n")"
    return $?
  fi
  main=$(dk_repos_names "$d" | head -1)
  while read -r name _root wt base; do
    [ -n "$name" ] && [ -d "$wt" ] || continue
    b=$(dk_wave_base "$d" "$n" "$name")
    if [ -z "$b" ] && [ "$name" = "$main" ]; then b=$(dk_wave_base "$d" "$n"); fi
    [ -n "$b" ] || b="$base"
    out=$(dk_changed_files "$wt" "$b") || rc=$?
    [ -n "$out" ] || continue
    if [ "$multi" = 1 ]; then printf '%s\n' "$out" | sed "s#^#$name:#"; else printf '%s\n' "$out"; fi
  done <<< "$(dk_repos_rows "$d")"
  return "$rc"
}
