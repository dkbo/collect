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
# 偵測到是 worktree 且缺這兩樣就 symlink 主 repo 的（pnpm 的 node_modules 是 symlink farm，跨目錄可用）。
ensure_worktree_deps(){
  local common main
  common=$(git rev-parse --git-common-dir 2>/dev/null) || return 0
  case "$common" in .git|"$PWD/.git") return 0 ;; esac   # 不是 worktree
  main="${common%/.git}"
  [ -d "$main" ] || return 0
  [ -e node_modules ] || ln -s "$main/node_modules" node_modules
  [ -e .env.local ] || { [ -f "$main/.env.local" ] && ln -s "$main/.env.local" .env.local; }
  return 0
}

# eslint 快取放 hook 狀態目錄（已 gitignore）：PostToolUse 逐檔與 Stop 整包共用同一份，
# Stop 那次只會重 lint 有變動的檔，整包從 ~5.5s 降到 1–2s。
ESLINT_CACHE_ARGS=(--cache --cache-location "$STATE/eslintcache")
