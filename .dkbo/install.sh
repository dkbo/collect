#!/usr/bin/env bash
# .dkbo/install.sh [--target DIR]  — wire dkbo into a project (idempotent).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$here/lib/common.sh"
dk_herdr_check   # catch an unusable herdr now, not on the first task; installing from a plain shell is fine
target="$(dirname "$here")"; [ "${1:-}" = --target ] && target="$(cd "$2" && pwd)"
cd "$target"
append_line() { # FILE LINE — append LINE, first making sure FILE ends with a newline
  [ ! -s "$1" ] || [ -z "$(tail -c1 "$1")" ] || echo >> "$1"
  echo "$2" >> "$1"
}
for s in init add-role brain plan run; do
  for d in .claude/skills .agents/skills; do
    mkdir -p "$d"
    if [ -e "$d/dkbo-$s" ] && [ ! -L "$d/dkbo-$s" ]; then
      echo "install.sh: $d/dkbo-$s exists and is not a symlink; left untouched" >&2
    else
      ln -sfn "../../.dkbo/skills/$s" "$d/dkbo-$s"
    fi
  done
done
grep -qs '^讀 .dkbo/ENTRY.md' AGENTS.md || append_line AGENTS.md '讀 .dkbo/ENTRY.md 並依其行事。'
if [ -L CLAUDE.md ] && [ "$(readlink CLAUDE.md)" = AGENTS.md ]; then
  echo "CLAUDE.md is a symlink to AGENTS.md; nothing to add"
else
  grep -qs '^@AGENTS.md$' CLAUDE.md || append_line CLAUDE.md '@AGENTS.md'
fi
if ! grep -qs '.dkbo/.sessions' .gitignore; then
  append_line .gitignore '.dkbo/.sessions/*'
  append_line .gitignore '!.dkbo/.sessions/.gitkeep'
fi
grep -qsx '.worktrees/' .gitignore || append_line .gitignore '.worktrees/'
# 專案自己的記憶與設定：發佈的 .dkbo/ 不帶這些（源碼倉的是 dkbo 自己的開發紀錄），缺的才從
# templates/seed/ 補空白版；已存在的一律不動，所以重跑與升級都安全。
seed() { # DEST SEED — .dkbo/DEST 不存在才從 templates/seed/SEED 複製
  [ -e ".dkbo/$1" ] && return 0
  mkdir -p "$(dirname ".dkbo/$1")"; cp "$here/templates/seed/$2" ".dkbo/$1"; echo "install.sh: seeded .dkbo/$1"
}
seed tasks/INDEX.md INDEX.seed.md
seed tasks/BACKLOG.md BACKLOG.seed.md
seed decisions.md decisions.seed.md
seed PROJECT.md PROJECT.seed.md
seed settings.env settings.seed.env
mkdir -p .dkbo/tasks/_chores .dkbo/.sessions
touch .dkbo/tasks/_chores/.gitkeep .dkbo/.sessions/.gitkeep
chmod +x .dkbo/bin/* .dkbo/install.sh
ver=unknown; [ -f .dkbo/VERSION ] && ver=$(tr -d '[:space:]' < .dkbo/VERSION)
echo "dkbo $ver installed into $target"
