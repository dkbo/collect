# 全站設計（固定位置）

現行風格：**DKBO Toybox**（玩具機風，2026-10-04 改版定案，來源任務 `.dkbo/tasks/2026-10-04-toybox/`）。

| 路徑 | 內容 |
|---|---|
| `toybox-ds/` | 設計系統：`README.md` 總覽、`01-foundations`（色彩／字型／互動狀態）、`02-layout`、`03-components`、`04-implementation`（對應到程式碼）、`tokens.json`、`components/` |
| `pages/pages-spec.md` | 各頁規格，每頁一節 |
| `pages/page-<route>.webp`／`.pen` | 各頁稿與原始檔；`node design/pages/.src/build.mjs <name>` 重畫 |
| `pages/home-mockup/` | 首頁參考 mockup |

程式碼端：token 在 `src/index.css`（`:root`／`.dark`、`@theme inline`），元件 class 在 `src/styles/toybox.css`（`tb-` 前綴，`@apply`），React 元件在 `src/components/toybox/`。

舊任務的 brief／report 仍寫 `design/...` 或 `$DK_ROOT/tasks/2026-10-04-toybox/design/...`，那是當時的路徑，現在一律以本目錄為準。
