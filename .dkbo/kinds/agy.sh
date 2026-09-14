# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
# agy 接受 --model <id> --effort <e>；model id 也可帶 -<effort> 後綴，但後綴與 --effort 同時給會衝突。
# 逐 model 宣告，因為 gemini-3.1-pro 只有 high 與 low（`agy models` 實測，沒有 medium）。
KIND_MODEL_EFFORTS="gemini-3.1-pro:low,high gemini-3.8-flash:low,medium,high"
KIND_DEFAULT_TIERS="S=gemini-3.8-flash/low M=gemini-3.8-flash/medium L=gemini-3.1-pro/high"
KIND_PROMPT_QUEUES=unknown
# accept-edits 只認工作區，而員工的工作區是 worktree；主樹的 .dkbo/ 要靠 --add-dir 補進來
# （同 claude.sh 的理由）。漏了它，員工讀不到自己的切片、寫不了 state。

# 卡住時畫面上會出現的字。herdr 0.9.0 對 agy 的審批 UI 回的是 idle 而不是 blocked
# （0.6.2 在 panova2 實測：畫面明明停在 "Requesting permission for: rg …"），所以
# agent_status 對這個 kind 是空的，畫面文字才是守望唯一認得出它卡住的依據。
KIND_BLOCK_RE='Requesting permission|Run this command\?|Yes, and always allow'
KIND_QUOTA_RE='quota|rate limit|usage limit|resource exhausted'
kind_args() { echo "--model $1 --effort $2 --mode accept-edits --add-dir $DK_PROJECT_ROOT"; }
kind_mcp_list() { agy mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
