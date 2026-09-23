# shellcheck shell=bash
# shellcheck disable=SC2034  # KIND_* are read by lib/kinds.sh after sourcing
# agy 接受 --model <id> --effort <e>；model id 也可帶 -<effort> 後綴，但後綴與 --effort 同時給會衝突。
# 逐 model 宣告，因為 gemini-3.1-pro 只有 high 與 low（`agy models` 實測，沒有 medium）。
KIND_MODEL_EFFORTS="gemini-3.1-pro:low,high gemini-3.8-flash:low,medium,high"
KIND_DEFAULT_TIERS="S=gemini-3.8-flash/low M=gemini-3.8-flash/medium L=gemini-3.1-pro/high"
KIND_PROMPT_QUEUES=unknown
# 工作區只認員工的 worktree，主樹的 .dkbo/ 要靠 --add-dir 補進來（同 claude.sh 的理由）。
# 漏了它，員工讀不到自己的切片、寫不了 state。

# 審批：agy 1.2.6 沒有 claude `auto` 的等價檔位 —— `--mode` 只吃 accept-edits 與 plan，而
# accept-edits 只放行「編輯」，每一個 shell 指令都要人按。實測原文：
#   a tool required the "command" permission that headless mode cannot prompt for, so it was
#   auto-denied. … Alternatively, re-run with --dangerously-skip-permissions to auto-approve all
# 逐條往 ~/.gemini/antigravity-cli/settings.json 的 permissions.allow 補是追不完的（它按指令字串
# 前綴比對，連 `git diff <sha> -- <path>` 都各記一條，dk-msg 那條還綁死絕對路徑，換專案即失效）。
# 所以走 --dangerously-skip-permissions，與 claude 的 auto、codex 的 -a never 同義：員工是無人
# 看管的 pane，邊界由 worktree 隔離、dk-wave-close 的真實 diff 所有權比對與 git 來撐，不是靠審批 UI。
# --sandbox 不能拿來補這個邊界：實測它把檔案系統視角搬到 ~/.gemini/antigravity-cli/scratch/，
# 員工會看不到自己的 worktree（cat 回 No such file，寫入落到 scratch）。

# 卡住時畫面上會出現的字。herdr 0.9.0 對 agy 的審批 UI 回的是 idle 而不是 blocked
# （0.6.2 在 panova2 實測：畫面明明停在 "Requesting permission for: rg …"），所以
# agent_status 對這個 kind 是空的，畫面文字才是守望唯一認得出它卡住的依據。
# 跳過工具審批之後這條仍然要留：資料夾信任詢問（新 worktree 每次都是新的未信任工作區，
# trustedWorkspaces 逐路徑精確比對、不繼承上層）走的不是工具審批那條路。它實際的畫面字樣
# 還沒實測過，所以沒有加進下面的 regex —— 下次實跑撞到時把原文補進來。
KIND_BLOCK_RE='Requesting permission|Run this command\?|Yes, and always allow'
# 裸 `quota` 不能用：agy 的啟動橫幅就叫 `bal@host (Antigravity Starter Quota)`，每個 agy 員工
# 一 spawn 就會被判撞額度、該 kind 當場熔斷（BACKLOG 2026-09-19 實測）。只收「耗盡」的說法。
# 實測耗盡原文：Individual quota reached, Resets in 102h11m1s
KIND_QUOTA_RE='quota reached|quota exceeded|rate limit|usage limit|resource exhausted'
kind_args() { echo "--model $1 --effort $2 --dangerously-skip-permissions$(dk_add_dirs)"; }
# agy 同樣沒有設 session 顯示名的旗標，回空字串。
kind_session_args() { return 0; }
kind_mcp_list() { agy mcp list 2>/dev/null | awk 'NR>1{print $1}'; }
