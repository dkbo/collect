# shellcheck shell=bash
# herdr 呼叫的薄薄一層。只處理一件事：**被刻意吞掉的失敗要留下痕跡**。
#
# dkbo 對 herdr 的呼叫分兩種。一種失敗就該死（pane split 拿不到 id、agent start 起不來），
# 那些直接呼叫 herdr 即可，非零會自然往上傳。另一種刻意吞掉失敗，因為那是收尾或裝飾
# （pane close、tab close、worktree remove、notification show）—— 這些維持原樣。
#
# 危險的是第三種：**吞掉失敗之後還繼續正常運作的樣子**。`herdr agent list` 一壞，
# dk-watch 的 `|| return 0` 會讓它每 30 秒安靜地什麼都不做，blocked 與 timeout 永遠
# 偵測不到，而 process.md 乾乾淨淨，看起來一切正常。0.1.5 的 CHANGELOG 已經點名過這件事。
# dk_h_soft 就是給這一種用的：照樣不讓它崩，但在 process.md 留一行。
dk_h_note() { # <what> — 每個行程樹只記一次，否則 dk-watch 每 tick 都會洗版
  [ -z "${DK_HERDR_DEGRADED:-}" ] || return 0
  DK_HERDR_DEGRADED=1; export DK_HERDR_DEGRADED
  echo "dk: herdr '$1' 失敗，相關功能降級（守望可能偵測不到 blocked／timeout，版面可能不再均分）" >&2
  dk_process "herdr-degraded: $1" 2>/dev/null || true
}
dk_h_soft() { # <herdr 參數…> — 失敗不崩、stdout 照傳，但留痕跡；回傳原本的 exit code
  local out rc
  out=$(herdr "$@" 2>/dev/null </dev/null); rc=$?
  [ -n "$out" ] && printf '%s' "$out"
  [ "$rc" = 0 ] && return 0
  dk_h_note "${1:-herdr} ${2:-}"
  return "$rc"
}
