# shellcheck shell=bash
# Needs common.sh and herdr.sh sourced first.
# Employee pane grid (spec §6). `.panes` rows: <agent> <pane_id> <epoch> <group> <tab_no> <slot>.
# Tab 1 is the leader's tab: the leader keeps a full-height left column; DK_TAB1_SLOTS cells fill the right half.
# Tabs 2+ hold 6 cells (3 columns × 2 rows). Shares below are what the ANCHOR keeps after the split.
# DK_RATIO_MEANS: what herdr's `pane split --ratio` denotes — "new" (the new pane's share) or "anchor" (default).
# tests/integration/herdr-real.sh confirmed against real herdr 0.9.0 that --ratio is the ANCHOR's share
# (see tests/integration/README.md "Last run"), so the default is "anchor".
DK_RATIO_MEANS="${DK_RATIO_MEANS:-anchor}"
dk_layout_ratio_arg() { # ANCHOR_SHARE → value for --ratio
  if [ "$DK_RATIO_MEANS" = anchor ]; then awk -v r="$1" 'BEGIN{printf "%.3f", r}'; else awk -v r="$1" 'BEGIN{printf "%.3f", 1-r}'; fi
}
dk__layout_cap() { if [ "$1" -eq 1 ]; then echo "${DK_TAB1_SLOTS:-4}"; else echo 6; fi; }
dk__layout_pane_at() { awk -v t="$1" -v s="$2" 'NF>=6 && $5==t && $6==s {print $2; exit}' "$3"; }
# GROUP is accepted for the spec's signature only; placement is pure spawn order (skills/run/SKILL.md tells the leader to spawn dev before qa/reviewer).
dk_layout_slot() { # GROUP [PANES_FILE] → "<tab_no> <slot> <anchor> <direction> <anchor_share>" | "NEWTAB <tab_no> 1"
  local panes="${2:-$(dk_task_dir)/.panes}" tab max cap slot anchor_slot dir share anchor
  tab=$(awk 'NF>=6 && $5>0 {if ($5>t) t=$5} END{print t+0}' "$panes"); [ "$tab" -ge 1 ] || tab=1
  max=$(awk -v t="$tab" 'NF>=6 && $5==t {if ($6>m) m=$6} END{print m+0}' "$panes")
  cap=$(dk__layout_cap "$tab"); slot=$((max+1))
  if [ "$slot" -gt "$cap" ]; then tab=$((tab+1)); slot=1; cap=$(dk__layout_cap "$tab"); fi
  if [ "$slot" -eq 1 ]; then
    if [ "$tab" -eq 1 ]; then echo "1 1 ${DK_ROOT_PANE:?} right 0.5"; else echo "NEWTAB $tab 1"; fi; return 0
  fi
  case "$slot" in
    2) anchor_slot=1; dir=down;  share=0.5;;
    3) anchor_slot=1; dir=right; share=0.5; [ "$cap" -eq 6 ] && share=0.333;;
    4) anchor_slot=2; dir=right; share=0.5; [ "$cap" -eq 6 ] && share=0.333;;
    5) anchor_slot=3; dir=right; share=0.5;;
    *) anchor_slot=4; dir=right; share=0.5;;
  esac
  anchor=$(dk__layout_pane_at "$tab" "$anchor_slot" "$panes")
  if [ -z "$anchor" ]; then   # anchor cell was closed mid-wave: hang below the highest live cell of this tab
    anchor=$(awk -v t="$tab" 'NF>=6 && $5==t {if ($6+0>=m) {m=$6+0; p=$2}} END{print p}' "$panes"); dir=down; share=0.5
  fi
  echo "$tab $slot $anchor $dir $share"
}
dk__layout_amount() { awk -v d="$1" -v t="$2" 'BEGIN{printf "%.3f", d/t}'; }   # cells → fraction of the tab area (herdr --amount unit; see herdr-real.sh NOTE)
dk_layout_even() { # TAB_NO [PANES_FILE] — equalise the tab's live employee cells; close an emptied tab ≥2. Never fails.
  local tab="$1" panes="${2:-$(dk_task_dir)/.panes}" ids probe snap tid
  ids=$(awk -v t="$tab" 'NF>=6 && $5==t {print $2}' "$panes")
  if [ -z "$ids" ]; then
    if [ "$tab" -ge 2 ]; then
      # shellcheck disable=SC2086  # DK_TABS is a space-separated list
      tid=$(printf '%s\n' ${DK_TABS:-} | awk -F= -v t="$tab" '$1==t{print $2}')
      if [ -n "$tid" ]; then
        herdr tab close "$tid" >/dev/null 2>&1 </dev/null || true
        # shellcheck disable=SC2086  # DK_TABS is a space-separated list
        dk_env_set DK_TABS "$(printf '%s\n' ${DK_TABS:-} | grep -v "^$tab=" | tr '\n' ' ' | sed 's/ $//')"
        dk_process "tab $tab $tid closed"
      fi
    fi
    return 0
  fi
  if [ "$tab" -eq 1 ]; then probe="${DK_ROOT_PANE:-}"; [ -n "$probe" ] || return 0; else probe=$(echo "$ids" | head -1); fi
  snap=$(dk_h_soft pane layout --pane "$probe") || return 0
  printf '%s\n' "$snap" | jq -r '.result.layout as $l | ($l.area | "AREA \(.x) \(.y) \(.width) \(.height)"), ($l.panes[] | "PANE \(.pane_id) \(.rect.x) \(.rect.y) \(.rect.width) \(.rect.height)")' 2>/dev/null \
  | awk -v ids=" $(echo "$ids" | tr '\n' ' ')" -v leader="${DK_ROOT_PANE:-}" -v tab="$tab" '
    $1=="AREA" {ax=$2; ay=$3; aw=$4; ah=$5; next}
    $1=="PANE" && tab==1 && $2==leader {rx=$3+$5; next}                    # employee region starts right of the leader column
    $1=="PANE" && index(ids, " " $2 " ") {n++; id[n]=$2; x[n]=$3; y[n]=$4; w[n]=$5; h[n]=$6}
    END {
      if (n==0 || aw==0 || ah==0) exit
      if (tab==1 && rx>0) rw=ax+aw-rx; else {rx=ax; rw=aw}
      ry=ay; rh=ah
      for (i=1;i<=n;i++) {
        split("", cx); split("", cy); nc=0; nr=0
        for (j=1;j<=n;j++) {
          if (y[j] < y[i]+h[i] && y[i] < y[j]+h[j] && !(x[j] in cx)) {cx[x[j]]=1; nc++}   # same row: distinct columns
          if (x[j] < x[i]+w[i] && x[i] < x[j]+w[j] && !(y[j] in cy)) {cy[y[j]]=1; nr++}   # same column: distinct rows
        }
        dw=int(rw/nc)-w[i]; dh=int(rh/nr)-h[i]
        if (dw>1 || dw<-1) printf "%s %s %d %d\n", id[i], (x[i]+w[i] < rx+rw ? "right" : "left"), dw, aw
        if (dh>1 || dh<-1) printf "%s %s %d %d\n", id[i], (y[i]+h[i] < ry+rh ? "down" : "up"), dh, ah
      }
    }' | while read -r pid direction delta total; do
      herdr pane resize --pane "$pid" --direction "$direction" --amount "$(dk__layout_amount "$delta" "$total")" >/dev/null 2>&1 </dev/null || true
    done
  return 0
}
