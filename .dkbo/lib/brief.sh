# shellcheck shell=bash
# Readers for brief.md. Needs common.sh and frontmatter.sh sourced first.
# Tables: rows start with '|'; the header row, '|---' separator rows and rows whose first cell starts with （範例） are dropped.
dk_brief_section() { # BRIEF "## heading prefix" → body lines until the next '## '
  [ -f "$1" ] || { echo "dk: no brief at $1" >&2; return 1; }
  awk -v h="$2" 'index($0, h)==1 {s=1; next} s && /^## / {exit} s {print}' "$1"
}
dk__brief_rows() { # BRIEF HEADING → data rows as trimmed "|"-joined cells (outer pipes removed)
  [ -f "$1" ] || { echo "dk: no brief at $1" >&2; return 1; }
  dk_brief_section "$1" "$2" | awk -F'|' '/^\|/ && !/^\|[- |]*$/ {
    out=""; for (i=2; i<NF; i++) { f=$i; gsub(/^ +| +$/, "", f); out = out (i>2 ? "|" : "") f } print out }' \
    | tail -n +2 | grep -v '^（範例）' || true
}
dk_brief_owners() { dk__brief_rows "$1" "## 檔案所有權"; }   # member|globs|readonly
dk_brief_waves()  { dk__brief_rows "$1" "## 波次表"; }       # wave|type|member|what|tier|done|review
dk_brief_wave_members() { dk_brief_waves "$1" | awk -F'|' -v n="$2" '$1==n {print $3 "(" $5 ")"}'; }
dk_brief_wave_review()  { dk_brief_waves "$1" | awk -F'|' -v n="$2" '$1==n && $7!="" {print $7; exit}'; }
dk_brief_acceptance()   { [ -f "$1" ] || { echo "dk: no brief at $1" >&2; return 1; }; dk_brief_section "$1" "## 驗收標準" | grep -E '^- \[.\] ' || true; }
dk_member_role() { # MEMBER → "role alias" (alias may be empty). role = longest dash-prefix that has a role file.
  local role="$1" alias
  while [ ! -f "$DK_ROOT/roles/$role.md" ] && [[ "$role" == *-* ]]; do role="${role%-*}"; done
  [ -f "$DK_ROOT/roles/$role.md" ] || return 1
  alias="${1#"$role"}"; alias="${alias#-}"; echo "$role $alias"
}
dk_member_group() { local r; r=$(dk_member_role "$1") || return 1; dk_fm "$DK_ROOT/roles/${r%% *}.md" group; }
