# 實作對應

目標專案：React 19 + Tailwind v4 + shadcn/ui。規範：路徑用 `@/*`、自訂 class 一律 `@apply`、圖片只收 WebP。

## 1. 字體

改用 `@fontsource`（與現在載入 Geist 的方式相同），移除 `@fontsource-variable/geist`：

```bash
pnpm add @fontsource-variable/rubik @fontsource-variable/noto-sans-tc @fontsource/vt323
```

```css
@import "@fontsource-variable/rubik";
@import "@fontsource-variable/noto-sans-tc";
@import "@fontsource/vt323";
```

## 2. Token → CSS 變數（`src/index.css`）

專案的深色模式是 `.dark` class（`@custom-variant dark`），所以 Light 寫在 `:root`、Dark 寫在 `.dark`：

```css
:root {
  --surface: #fffbf2;  --surface-raised: #ffffff;  --surface-sunken: #e9e2d6;
  --ink: #17140f;      --ink-muted: #4a4339;       --line: var(--ink);  --focus: var(--ink);
  --pop: #ffce2e;      --action: #ff6b3d;          --on-fill: #17140f;
  --sky: #8fd6ff;      --mint: #9be3b0;            --pink: #ffb3d1;     --success: #2bb673;
  --inverse: #17140f;  --on-inverse: #ffffff;      --on-inverse-muted: #e9e2d6;
}
.dark {
  --surface: #17140f;  --surface-raised: #241f18;  --surface-sunken: #332c23;
  --ink: #fff8ec;      --ink-muted: #cfc5b5;
  --action: #ff7a4f;   --success: #3fd18a;
  --inverse: #0b0907;  --on-inverse: #fff8ec;      --on-inverse-muted: #cfc5b5;
}
```

## 3. Tailwind v4 `@theme`

```css
@theme inline {
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-surface-sunken: var(--surface-sunken);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-line: var(--line);
  --color-pop: var(--pop);
  --color-action: var(--action);
  --color-on-fill: var(--on-fill);
  --color-sky: var(--sky);
  --color-mint: var(--mint);
  --color-pink: var(--pink);
  --color-success: var(--success);
  --color-inverse: var(--inverse);
  --color-on-inverse: var(--on-inverse);
  --color-on-inverse-muted: var(--on-inverse-muted);

  --font-display: "Rubik Variable", "Noto Sans TC Variable", system-ui, sans-serif;
  --font-sans: "Noto Sans TC Variable", "Rubik Variable", system-ui, sans-serif;
  --font-pixel: "VT323", ui-monospace, monospace;

  --text-display-xl: 76px; --text-display-xl--line-height: 82px; --text-display-xl--font-weight: 900; --text-display-xl--letter-spacing: -0.01em;
  --text-display-l: 48px;  --text-display-l--line-height: 53px;  --text-display-l--font-weight: 900;
  --text-heading-l: 36px;  --text-heading-l--line-height: 44px;  --text-heading-l--font-weight: 900;
  --text-heading-m: 22px;  --text-heading-m--line-height: 30px;  --text-heading-m--font-weight: 900;
  --text-button: 16px;     --text-button--line-height: 20px;     --text-button--font-weight: 900;
  --text-body-l: 17px;     --text-body-l--line-height: 30px;     --text-body-l--font-weight: 500;
  --text-body: 16px;       --text-body--line-height: 28px;       --text-body--font-weight: 500;
  --text-body-s: 14px;     --text-body-s--line-height: 24px;     --text-body-s--font-weight: 500;
  --text-label: 15px;      --text-label--line-height: 20px;      --text-label--font-weight: 700;
  --text-caption: 13px;    --text-caption--line-height: 18px;    --text-caption--font-weight: 700;
  --text-pixel-xl: 46px;   --text-pixel-xl--line-height: 42px;
  --text-pixel-l: 30px;    --text-pixel-l--line-height: 32px;
  --text-pixel-m: 22px;    --text-pixel-m--line-height: 24px;

  --radius-sm: 8px;  --radius-md: 14px;  --radius-lg: 18px;  --radius-xl: 26px;  --radius-console: 64px;

  --shadow-hard-s: 3px 3px 0 var(--ink);
  --shadow-hard-m: 5px 5px 0 var(--ink);
  --shadow-hard-l: 8px 8px 0 var(--ink);
  --shadow-hard-action: 8px 8px 0 var(--action);

  --container-site: 1200px;
}
```

對應的 utility：`bg-pop`、`text-ink-muted`、`border-line`、`font-display`、`text-heading-m`、`rounded-lg`、`shadow-hard-m`、`max-w-site`。間距直接用 Tailwind 刻度（`space-6` = `p-6` = 24px），外框用 `border-2`／`border-3`／`border-4`，高度 `h-11`（44）／`h-13`（52）。

## 4. shadcn 變數對應

讓現有 `src/components/ui/` 原子元件跟著換色，不必逐一改寫：

```css
:root, .dark {
  --background: var(--surface);         --foreground: var(--ink);
  --card: var(--surface-raised);        --card-foreground: var(--ink);
  --popover: var(--surface-raised);     --popover-foreground: var(--ink);
  --primary: var(--action);             --primary-foreground: var(--on-fill);
  --secondary: var(--surface-raised);   --secondary-foreground: var(--ink);
  --muted: var(--surface-sunken);       --muted-foreground: var(--ink-muted);
  --accent: var(--surface-sunken);      --accent-foreground: var(--ink);
  --border: var(--line);                --input: var(--line);
  --ring: var(--focus);                 --radius: 14px;
}
```

注意：shadcn 的 `--accent` 是「hover 底」的意思，所以系統的行動色取名 `action`，避免撞名。shadcn 元件預設 1px 框、柔和陰影，外框粗細與硬陰影要在 wrapper class 補上（見下）。

## 5. `@apply` 元件 class（`@layer components`）

```css
@layer components {
  .tb-lift   { @apply transition-[translate,box-shadow] duration-[120ms] ease-out
                      hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard-l
                      active:translate-x-[5px] active:translate-y-[5px] active:shadow-none
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-line
                      motion-reduce:transition-none; }
  .tb-lift-s { @apply transition-[translate,box-shadow] duration-[120ms] ease-out
                      hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-m
                      active:translate-x-[3px] active:translate-y-[3px] active:shadow-none
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-line
                      motion-reduce:transition-none; }

  .tb-btn          { @apply inline-flex h-13 items-center justify-center gap-2 rounded-md border-3 border-line
                            bg-surface-raised px-6 font-display text-button text-ink shadow-hard-m
                            disabled:bg-surface-sunken disabled:text-ink-muted disabled:border-ink-muted disabled:shadow-none; }
  .tb-btn--primary { @apply bg-action text-on-fill; }
  .tb-btn--pop     { @apply bg-pop text-on-fill; }
  .tb-btn--ink     { @apply bg-inverse text-pop; }

  .tb-card        { @apply flex min-w-0 flex-col overflow-hidden rounded-lg border-3 border-line bg-surface-raised text-ink shadow-hard-m; }
  .tb-card__strip { @apply flex justify-between border-b-3 border-line bg-pop px-4 py-1 font-pixel text-pixel-m text-on-fill; }
  .tb-card__body  { @apply flex grow flex-col gap-3 p-5; }

  .tb-tag  { @apply inline-flex items-center rounded-sm border-2 border-line px-3 py-1 text-caption text-on-fill; }
  .tb-stat { @apply flex flex-col gap-1 rounded-md border-3 border-line bg-surface-raised px-4 py-3; }
}
```

其餘元件照〈元件總表〉與 Components 分頁的 token 依樣寫成 class。元件 JSX 只組 class，不寫 inline style。

## 6. 要刪除的舊樣式

- `Layout.tsx`：背景的兩團 `blur-[120px]` 光暈與 `bg-gradient-to-b from-purple-500/5` 遮罩、Logo 的 `from-purple-500 to-indigo-500`、標題的 `bg-clip-text` 漸層、`selection:bg-purple-500`（改 `selection:bg-pop selection:text-on-fill`）。
- `index.css`：導覽與選單的 `backdrop-blur-*` 毛玻璃、`hero-grad-text`、`--accent-bg`／`--accent-border` 紫色變數、舊的 `--text`／`--bg`／`--shadow`。
- `Home/`：所有 `purple-*`、`indigo-*`、`bg-purple-500/8` 圖示方塊（改用 IconBox）、漸層徽章（改 FeatureCard 徽章）。

## 7. 給 artifacts 使用

在 artifact 或設計 canvas 裡，依本系統的 Consuming 段落載入 `tokens.css`、`components/bundle.css`、React 18 與 `components/bundle.js`，元件在 `window.Toybox`（例：`Toybox.CartridgeCard`）。設計 canvas 安裝本系統後，色票與字級會出現在 Theme 選單。
