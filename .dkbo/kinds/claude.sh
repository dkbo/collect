# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
# 每個 model 各自宣告它真的支援的 effort（不是 models × efforts 的笛卡兒積）。
KIND_MODEL_EFFORTS="opus:low,medium,high,xhigh,max sonnet:low,medium,high,xhigh,max"
# 三檔全換 opus、只用 effort 分檔（2026-09-23，Opus 5.5 發布隔天）：Artificial Analysis 的
# opus/medium 已追平 fable/high、成本約三分之一；Vals 的 Terminal-Bench 2.1 opus 87.6% 對 sonnet 74.5%。
# S 的 opus/low 在 AA 每題成本與 sonnet/low 相當（$0.55 對 $0.51）、分數 42 對 24；Anthropic 的
# 〈What a task costs on Opus 5.5〉也說機械式改動留在 Opus 5.5 low，Sonnet/Haiku 只給查找、不給寫碼。
# 第三方還沒人把 opus/low 對 sonnet 做過實跑比較，第一次實跑 S 檔時留意品質與額度。
# sonnet 留在 KIND_MODEL_EFFORTS 供 --model 手動指定；角色檔的 tiers 同步照 sonnet→同 effort 的 opus 改。
KIND_DEFAULT_TIERS="S=opus/low M=opus/medium L=opus/high"
KIND_PROMPT_QUEUES=unknown   # layer-3 smoke updates this: does a prompt sent while working queue?
# auto 而非 acceptEdits：員工的 cwd 是 worktree，但切片、state、report 都在主樹的 .dkbo/ 下，
# acceptEdits 不放行工作區外的讀寫，也不放行任何 shell —— 實跑時每位員工都卡在第一個動作。
# --add-dir 明示主樹，讓「讀自己的切片、寫自己的 state」本來就在授權範圍內。

# claude 的審批 herdr 認得（會回 blocked），這兩行是第二道訊號，不是唯一依據。
KIND_BLOCK_RE='Do you want|Allow this|❯ 1\. Yes'
KIND_QUOTA_RE='usage limit|rate limit'
kind_args() { echo "--model $1 --effort $2 --permission-mode auto$(dk_add_dirs)"; }
# CLI 那側的 session 顯示名（session picker 與終端標題）。herdr 的註冊名是另一回事：
# 它只吃 [a-z][a-z0-9_-]{0,31}，放不進 workspace 名字裡的斜線。
kind_session_args() { [ -n "${1:-}" ] && echo "--name $1"; return 0; }
kind_mcp_list() { claude mcp list 2>/dev/null | awk -F: 'NF>1{print $1}'; }
