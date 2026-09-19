# shellcheck shell=bash
# Readers for brief.md. Needs common.sh and frontmatter.sh sourced first.
# Tables: rows start with '|'; the header row, '|---' separator rows and rows whose first cell starts with （範例） are dropped.
dk_brief_section() { # BRIEF "## heading prefix" → body lines until the next '## '
  [ -f "$1" ] || { echo "dk: no brief at $1" >&2; return 1; }
  awk -v h="$2" 'index($0, h)==1 {s=1; next} s && /^## / {exit} s {print}' "$1"
}
dk__brief_rows() { # BRIEF HEADING → data rows as trimmed "|"-joined cells (outer pipes removed)
  [ -f "$1" ] || { echo "dk: no brief at $1" >&2; return 1; }
  # 欄位內容裡的字面管線在 markdown 裡寫成 \|（形狀／簽名欄最常見：正規表示式、shell pipe、
  # 或是在描述某個回傳值本身用 | 分隔）。awk -F'|' 看不懂那個跳脫，會把一列切成多出來的欄，
  # 後面每一欄跟著錯位 —— 而且不報錯。先把 \| 換成哨兵再切，切完還原。
  # 還原刻意保留 \| 而不是還原成裸 |：輸出仍然是「以未跳脫的 | 分隔」，下游才切得回來，
  # 而 dk-wave-open 會把這些欄位再拼回 markdown 表格，跳脫留著才是對的 markdown。
  # 還原用 split 加字串串接而不是 gsub —— POSIX 沒有規定替換字串裡 \ 接非 & 字元的行為。
  dk_brief_section "$1" "$2" | awk '/^\|/ && !/^\|[- |]*$/ {
    line = $0; gsub(/\\\|/, SUBSEP, line); n = split(line, a, "|"); out = ""
    for (i = 2; i < n; i++) {
      f = a[i]; gsub(/^ +| +$/, "", f)
      m = split(f, p, SUBSEP); f = p[1]; for (j = 2; j <= m; j++) f = f "\\|" p[j]
      out = out (i > 2 ? "|" : "") f
    } print out }' \
    | tail -n +2 | grep -v '^（範例）' || true
}
dk_brief_owners() { dk__brief_rows "$1" "## 檔案所有權"; }   # member|globs|readonly
dk_brief_waves()  { dk__brief_rows "$1" "## 波次表"; }       # wave|type|member|what|tier|done|review
dk_brief_wave_members() { dk_brief_waves "$1" | awk -F'|' -v n="$2" '$1==n {print $3 "(" $5 ")"}'; }
dk_brief_wave_review()  { dk_brief_waves "$1" | awk -F'|' -v n="$2" '$1==n && $7!="" {print $7; exit}'; }
dk_brief_acceptance()   { [ -f "$1" ] || { echo "dk: no brief at $1" >&2; return 1; }; dk_brief_section "$1" "## 驗收標準" | grep -E '^- \[.\] ' || true; }
# 橫切所有波的硬要求（版本下限、命名規則、平台要求）。段落不存在＝0.9.0 之前建立的 brief。
dk_brief_constraints() { dk_brief_section "$1" "## 全域約束"; }
# 契約|擁有者|消費者|形狀／簽名|變更流程。0.9.0 之前的 brief 這一段是自由文字，回空。
dk_brief_interfaces() { dk__brief_rows "$1" "## 共用契約"; }
# 同一波的成員是同時 spawn 的，所以 group: review 的成員（qa）會在 dev 還在寫的時候就
# 讀到 worktree。panova2 的 paramleak 實跑：qa 07:27 對著寫到一半的 helper 收斂判定 AC5
# 沒過、發 [QUESTION]，然後停在那裡等到 07:39 才收到「你看到的是收斂前快照」。12 分鐘
# 空轉，外加一份假的驗收失敗。閘門不該是「延後 spawn」（qa 有一大段不依賴 dev 產出的
# 前置：起環境、測試帳號、探測腳本骨架），該是讓它知道自己在等誰。
dk_brief_wave_upstream() { # BRIEF WAVE → 這一波裡 group=dev 的成員短名，一行一個
  local m r rf g
  for m in $(dk_brief_wave_members "$1" "$2"); do
    m="${m%%(*}"
    r=$(dk_member_role "$m" 2>/dev/null) || continue
    rf="$DK_ROOT/roles/${r%% *}.md"; [ -f "$rf" ] || continue
    g=$(dk_fm "$rf" group); g="${g:-dev}"
    [ "$g" = dev ] && echo "$m"
  done
  return 0   # 最後一位不是 dev 時 `[ … ] && echo` 會讓函式回非零，呼叫端在 set -e 下整支退出
}
dk_member_role() { # MEMBER → "role alias" (alias may be empty). role = longest dash-prefix that has a role file.
  local role="$1" alias
  while [ ! -f "$DK_ROOT/roles/$role.md" ] && [[ "$role" == *-* ]]; do role="${role%-*}"; done
  [ -f "$DK_ROOT/roles/$role.md" ] || return 1
  alias="${1#"$role"}"; alias="${alias#-}"; echo "$role $alias"
}
dk_member_group() { local r; r=$(dk_member_role "$1") || return 1; dk_fm "$DK_ROOT/roles/${r%% *}.md" group; }
