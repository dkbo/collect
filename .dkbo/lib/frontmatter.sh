# shellcheck shell=bash
# Minimal frontmatter readers for roles/*.md. Only the shapes dkbo writes.
dk__fm_block() { awk 'NR==1 && $0!="---"{exit} /^---$/{c++; next} c==1{print} c>=2{exit}' "$1"; }
dk_fm() { dk__fm_block "$1" | awk -v k="$2" -F': *' '$1==k {sub(/^[^:]*: */,""); print; exit}'; }
dk_fm_tier() { dk__fm_block "$1" | awk -v k="$2" '/^tiers:/{t=1;next} t && /^[^ ]/{t=0} t && $1==k":" {print $2; exit}'; }
dk_fm_list() { dk_fm "$1" "$2" | tr -d '[]' | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' || true; }
