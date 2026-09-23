---
name: dkbo-add-role
description: 為 dkbo 團隊新增一個角色（例如 translator、designer）。問職責與交接，偵測可用 AI 工具讓人選，依難度建議 S/M/L 三檔的 model/effort 讓人確認，產出 roles/<name>.md 並登錄團隊表。
---
# dkbo add-role

一次問一題。

1. 問角色名（ascii 小寫，符合 `[a-z][a-z0-9_-]*`）、一句職責、交接對象（做完給誰驗、被誰用）。
2. 偵測可用工具：`bash -c '. .dkbo/lib/common.sh; . .dkbo/lib/kinds.sh; dk_kinds_available'`。
3. 讓人選 kind，預設推薦 claude。
4. 讀 `.dkbo/kinds/<kind>.sh` 的 `KIND_MODEL_EFFORTS`（逐 model 宣告它真的支援的 effort）。依職責難度建議三檔（S 純機械照做、不碰邏輯，M 一般，L 需設計判斷），每檔一個 `model/effort`，說明理由。純產出型角色（翻譯、整理）L 檔也不必用最高 model。
5. 逐檔讓人確認或改。
6. 寫 `.dkbo/roles/<name>.md`，frontmatter 依序：`name kind tiers(S M L) worktree group mcp`，正文三段：`## 職責`（3–5 行）、`## 完成定義`、`## 交接對象`。`worktree` 對不碰程式碼的角色設 false。`group` 填 `dev`（會改碼、要交報告）或 `review`（qa、reviewer 類，只驗不改）。
7. 在 `.dkbo/roles/README.md` 表尾加一行。
8. 用 `bash -c '. .dkbo/lib/common.sh; . .dkbo/lib/frontmatter.sh; . .dkbo/lib/kinds.sh; for t in S M L; do v=$(dk_fm_tier .dkbo/roles/<name>.md $t); [ -n "$v" ] && dk_kind_args <kind> "$v"; done'` 驗證三檔都能轉成旗標。
