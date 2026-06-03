---
name: ui-ux-pro-max
description: Design intelligence skill providing professional UI/UX knowledge for building production-grade interfaces. Includes design system architecture, token management, color palettes, typography, UX guidelines, and accessibility standards. Adapted for Vue 3 + Quasar + Tailwind CSS v4 stack.
---

# UI/UX Pro Max (Vue + Quasar + Tailwind v4)

Design intelligence skill for building professional, accessible user interfaces with systematic design foundations.

> Adapted from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for Vue 3 + Quasar + Tailwind CSS v4 stack.

## Stack Context

This project uses:
- **Vue 3.5** with Composition API (`<script setup lang="ts">`)
- **Quasar** as component library only (NO Quasar layout/spacing utilities)
- **Tailwind CSS v4** with `@theme` and CSS variables
- **TypeScript** with strict types (no `any`)
- **Vite** build tool

## When to Use

- Design system creation and token architecture
- Color palette generation and management
- Typography scale and font pairing decisions
- Component specification and variant definitions
- Accessibility auditing (contrast, focus, ARIA)
- Responsive layout strategy
- Dark/light theme systems
- UI style direction (50+ styles available for reference)

## Design System Architecture

### Three-Layer Token System

```
Primitive (raw values)
       ↓
Semantic (purpose aliases)
       ↓
Component (component-specific)
```

### Tailwind CSS v4 Token Implementation

```css
/* src/css/app.css */
@import "tailwindcss";

@theme {
  /* ── Primitive Tokens ── */
  --color-blue-50: oklch(0.97 0.01 250);
  --color-blue-100: oklch(0.93 0.03 250);
  --color-blue-500: oklch(0.62 0.21 250);
  --color-blue-600: oklch(0.55 0.22 250);
  --color-blue-900: oklch(0.25 0.10 250);

  --color-neutral-50: oklch(0.98 0.00 0);
  --color-neutral-100: oklch(0.95 0.00 0);
  --color-neutral-800: oklch(0.27 0.01 0);
  --color-neutral-900: oklch(0.18 0.01 0);

  /* ── Semantic Tokens ── */
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-surface: var(--color-neutral-50);
  --color-surface-elevated: white;
  --color-on-surface: var(--color-neutral-900);
  --color-on-surface-muted: var(--color-neutral-800);
  --color-border: var(--color-neutral-100);

  /* ── Typography ── */
  --font-display: 'Your Display Font', serif;
  --font-body: 'Your Body Font', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* ── Spacing Scale ── */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */

  /* ── Border Radius ── */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px oklch(0 0 0 / 0.07);
  --shadow-lg: 0 10px 15px oklch(0 0 0 / 0.10);
  --shadow-xl: 0 20px 25px oklch(0 0 0 / 0.12);
}
```

> **⚠️ 注意**：以上為範例結構。本專案已有既有的 CSS variable 命名慣例（如 `--primary-color`、`--background-color`，定義於 `src/css/themes/dark.scss` 和 `light.scss`）。實作時應沿用既有命名，不要引入新的命名體系。

### Dark Theme Override

```css
.body--dark {
  --color-primary: var(--color-blue-400);
  --color-surface: var(--color-neutral-900);
  --color-surface-elevated: var(--color-neutral-800);
  --color-on-surface: var(--color-neutral-50);
  --color-border: oklch(0.35 0.01 0);
}
```

## UI Style Reference (50+ Styles)

| Category | Styles |
|----------|--------|
| **Minimal** | Clean Minimal, Swiss Design, Scandinavian, Japanese Zen |
| **Bold** | Brutalist, Neo-Brutalism, Maximalist, Memphis Design |
| **Modern** | Glassmorphism, Neumorphism, Material 3, Flat Design 2.0 |
| **Premium** | Luxury, Art Deco, Editorial, Magazine Layout |
| **Tech** | Cyberpunk, Terminal/CLI, Retro-Futuristic, HUD/Sci-Fi |
| **Organic** | Natural/Earth, Watercolor, Hand-drawn, Paper/Craft |
| **Sport** | Dynamic/Athletic, Stadium, Racing, Fitness |
| **Playful** | Toy-like, Cartoon, Pixel Art, Bubbly/Round |

### Sport-Specific UI Patterns

Given this is a sports application:
- **Dynamic layouts**: Use asymmetric grids and diagonal elements
- **Bold typography**: Strong, condensed sans-serif fonts work well
- **Energetic colors**: High-saturation accent colors for action elements
- **Live data patterns**: Scores, stats, timers with real-time feel
- **Card-based content**: Match cards, player cards, league tables
- **Motion**: Slide-in transitions, count-up animations for stats

## Color Palette Guidelines

### Sports-Oriented Palettes

| Palette | Primary | Accent | Surface | Use Case |
|---------|---------|--------|---------|----------|
| **Stadium Night** | `oklch(0.55 0.22 250)` | `oklch(0.75 0.20 145)` | `oklch(0.15 0.02 265)` | Dark mode, live events |
| **Athletic Energy** | `oklch(0.60 0.25 30)` | `oklch(0.65 0.24 265)` | `oklch(0.97 0.01 90)` | Bright, action-oriented |
| **Premium Sport** | `oklch(0.30 0.05 265)` | `oklch(0.70 0.18 85)` | `oklch(0.98 0.00 0)` | VIP, luxury betting |
| **Green Field** | `oklch(0.50 0.18 145)` | `oklch(0.65 0.22 30)` | `oklch(0.96 0.01 145)` | Traditional sports |

### Contrast Requirements

| Element | Minimum Ratio | Target Ratio |
|---------|---------------|--------------|
| Body text | 4.5:1 (AA) | 7:1 (AAA) |
| Large text (18px+) | 3:1 | 4.5:1 |
| UI components | 3:1 | 4.5:1 |
| Focus indicators | 3:1 | 4.5:1 |

## Typography Scale

### Recommended Sports Font Pairings

| Style | Display | Body | Mono |
|-------|---------|------|------|
| **Dynamic** | Oswald, Barlow Condensed | Inter, Source Sans 3 | JetBrains Mono |
| **Premium** | Playfair Display | Lato, Nunito Sans | Fira Code |
| **Modern** | Space Grotesk | DM Sans, Outfit | IBM Plex Mono |
| **Bold** | Anton, Big Shoulders | Roboto, Open Sans | Red Hat Mono |

### Type Scale (1.25 ratio)

```css
@theme {
  --text-xs: 0.64rem;    /* 10px */
  --text-sm: 0.8rem;     /* 13px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.25rem;    /* 20px */
  --text-xl: 1.563rem;   /* 25px */
  --text-2xl: 1.953rem;  /* 31px */
  --text-3xl: 2.441rem;  /* 39px */
  --text-4xl: 3.052rem;  /* 49px */
}
```

## Component Specification Pattern

### State Matrix

| Property | Default | Hover | Active | Focus | Disabled |
|----------|---------|-------|--------|-------|----------|
| Background | `primary` | `primary-hover` | `primary` | `primary` | `surface` |
| Text | `on-primary` | `on-primary` | `on-primary` | `on-primary` | `on-surface-muted` |
| Border | `none` | `none` | `none` | `2px ring` | `border` |
| Shadow | `sm` | `md` | `none` | `none` | `none` |
| Opacity | `1` | `1` | `0.9` | `1` | `0.5` |
| Cursor | `pointer` | `pointer` | `pointer` | `pointer` | `not-allowed` |

### Vue Component Template

SFC order: `<script>` → `<template>` → `<style>` (per project convention)

```vue
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const { variant = 'primary', size = 'md', disabled = false } = defineProps<Props>()

const variantClasses: Record<string, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:opacity-90 shadow-sm hover:shadow-md',
  secondary: 'bg-surface text-on-surface border border-border hover:bg-surface-elevated',
  ghost: 'text-on-surface hover:bg-surface-elevated',
  destructive: 'bg-red-500 text-white hover:bg-red-600',
}

const sizeClasses: Record<string, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
}
</script>

<template>
  <button
    :class="[
      'inline-flex items-center justify-center rounded-md font-medium',
      'transition-all duration-200 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
    ]"
    :disabled="disabled"
    data-testid="btn-action"
  >
    <slot />
  </button>
</template>
```

## Accessibility Checklist

### WCAG 2.1 AA Compliance

- [ ] Color contrast meets minimum ratios
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible (2px+ solid ring)
- [ ] ARIA labels on non-text interactive elements
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Motion respects `prefers-reduced-motion`
- [ ] Form inputs have associated labels
- [ ] Error messages are descriptive and accessible
- [ ] Skip navigation link for keyboard users
- [ ] Interactive elements include `data-testid` (format: `module-action`)
- [ ] Images have meaningful alt text

### SVG Requirements

All SVGs must use:
```html
<svg fill="currentColor" stroke="currentColor" ...>
```
Never hardcode colors in SVGs.

## UX Guidelines (Prioritized)

### Critical (Must Have)
1. **Feedback**: Every action must have visual feedback (loading, success, error)
2. **Consistency**: Same patterns for same interactions across the app
3. **Performance**: No layout shifts, instant perceived responses
4. **Error handling**: Graceful degradation with clear recovery paths

### Important (Should Have)
5. **Progressive disclosure**: Show only what's needed, reveal on demand
6. **Hierarchy**: Visual weight guides the eye to important elements first
7. **Affordance**: Interactive elements look interactive
8. **Empty states**: Design for zero-data and loading states

### Nice to Have
9. **Delight**: Micro-animations, easter eggs, satisfying interactions
10. **Personalization**: Remember user preferences
11. **Onboarding**: Guide first-time users naturally
12. **Optimistic UI**: Show changes immediately, sync in background

## Integration Notes

### With Quasar Components
Use Quasar components for complex UI elements (QDialog, QSelect, QTable, etc.) but style them with Tailwind:

```vue
<q-btn class="rounded-lg bg-primary px-4 py-2 text-white shadow-sm hover:shadow-md">
  Action
</q-btn>
```

### With Tailwind v4
No `tailwind.config.js` — use `@theme` in CSS:

```css
@import "tailwindcss";

@theme {
  /* All design tokens here */
}
```

## Build Validation

Before completing any design work:
```bash
pnpm lint   # No lint errors
pnpm build  # No TypeScript errors
```

No production `console.log` statements.
