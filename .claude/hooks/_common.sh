#!/usr/bin/env bash
# 各 hook 共用：定位 repo root、hook 狀態目錄、worktree 相依補齊。用 `. "$(dirname "$0")/_common.sh"` 載入。

hook_root(){ # 印出「這棵樹」的 root；找不到就 exit 0（hook 不該在非 repo 環境出錯）
  # cwd 的 toplevel 優先於 CLAUDE_PROJECT_DIR：worktree 裡後者可能仍指主 repo，
  # 那樣 cd 過去之後 lint／tsc／vitest 驗的是主 repo，worktree 的改動一行都沒驗到卻回綠燈。
  local r
  r=$(git rev-parse --show-toplevel 2>/dev/null)
  [ -n "$r" ] || r="${CLAUDE_PROJECT_DIR:-}"
  [ -n "$r" ] || exit 0
  printf '%s' "$r"
}

# marker 是「整棵樹有未驗證的改動」，全樹共用：驗證本來就是整包跑，一個 marker 即足夠。
# 路徑相對於 hook_root 印出的樹根，因此每個 worktree 自然各有一份狀態，互不干擾。
STATE=.claude/.hook-state
mark(){ mkdir -p "$STATE" && touch "$STATE/$1"; }

# git worktree 裡沒有 node_modules 與 .env.local（都 gitignore），eslint / tsc / vitest 會全掛。
# 偵測到是 worktree 且缺這兩樣就 symlink 主 repo 的（pnpm 的 node_modules 是 symlink farm，跨目錄可用；
# 實測 eslint / tsc / vitest 直呼 .bin 都能跑，tsc 會抓到 worktree 自己那份原始碼的錯）。
ensure_worktree_deps(){
  local common main
  common=$(git rev-parse --git-common-dir 2>/dev/null) || return 0
  case "$common" in .git|"$PWD/.git") return 0 ;; esac   # 不是 worktree
  main="${common%/.git}"
  [ -d "$main" ] || return 0
  [ -e node_modules ] || ln -s "$main/node_modules" node_modules
  [ -e .env.local ] || { [ -f "$main/.env.local" ] && ln -s "$main/.env.local" .env.local; }
  # pnpm 11 的 verify-deps-before-run 預設會在 `pnpm exec` / `pnpm <script>` 前跑 install，
  # 而它認不得 symlink 進來的 node_modules，會判定要「purge modules 目錄」——
  # symlink 指著主 repo，真讓它動手就是把主 repo 的 node_modules 砍掉。沒 TTY 時它只中止並報錯
  # （ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY），但那也代表 hook 一行都驗不到。
  # 所以 hook 一律用下面的 $LBIN 直呼 .bin，並關掉這個檢查當第二道保險。
  export npm_config_verify_deps_before_run=false
  return 0
}

# hook 一律用 $LBIN/<tool> 直呼本地工具，不走 `pnpm exec`／`pnpm <script>`（理由見上）。
# 用變數而不是 shell function：呼叫點都包在 `timeout` 裡，而 timeout 執行的是外部命令、跑不了 function。
# 路徑相對於已 cd 過去的樹根，主 repo 與 worktree 因此走同一套邏輯。
LBIN=node_modules/.bin

# eslint 快取放 hook 狀態目錄（已 gitignore）：PostToolUse 逐檔與 Stop 整包共用同一份，
# Stop 那次只會重 lint 有變動的檔，整包從 ~5.5s 降到 1–2s。
ESLINT_CACHE_ARGS=(--cache --cache-location "$STATE/eslintcache")
