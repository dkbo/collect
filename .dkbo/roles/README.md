# 團隊表
| 角色 | kind | S | M | L | 一句職責 |
|---|---|---|---|---|---|
| pm | claude | opus/low | opus/medium | opus/high | 需求釐成驗收標準，不寫碼 |
| babylon | claude | opus/medium | opus/high | opus/high | Babylon.js 遊戲與多人同步（`src/babylon/`、`src/pages/Battle/`） |
| react | claude | opus/low | opus/medium | opus/high | React 頁面、Zustand store、shadcn UI（`src/pages/`、`src/store/`、`src/components/`、`src/lib/`） |
| godot | claude | opus/medium | opus/high | opus/high | GDScript 與 Web 匯出（`godot-src/`、`godot-candy-src/`） |
| mapbuilder | claude | opus/low | opus/medium | opus/high | RpgRoom 地圖 JSON、場景圖轉 JSON |
| qa | claude | opus/low | opus/medium | opus/high | 依驗收標準用 shot.mjs 驗證、跑 build／匯出、送 BUG，自己不修 |
| it | claude | opus/low | opus/low | opus/medium | 環境、依賴、CI、合併衝突修復 |
| reviewer | claude | — | opus/medium | opus/high | 實作波審查與結案評議（含架構／安全重點），只出意見不改碼 |
| netcore | claude | opus/medium | opus/high | opus/high | 共用契約擁有者：`src/core/`（signaling／WebRTC）、`firestore.rules`、bridge 協定 |
| designer | claude | opus/low | opus/medium | opus/high | 出 mockup 與樣式 spec（pen CLI、ui-ux-pro-max），不改碼，在主樹旁工作 |
| assets | claude | opus/low | opus/low | opus/medium | 圖片轉 WebP、sprite／場景圖素材整理，不改碼 |

各角色的領域架構重點仍在 `.claude/agents/<name>.md`（角色檔會指定要讀哪一份）；reviewer kind 由 `settings.env` 的 `DK_REVIEW_KINDS`（claude codex agy）在 dk-review 時覆寫。
