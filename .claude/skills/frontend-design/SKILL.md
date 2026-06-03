---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when building web components, pages, or applications. Generates creative, polished code and UI design that avoids generic AI aesthetics. Adapted for Vue 3 + Quasar + Tailwind CSS v4 stack.
---

# Frontend Design Skill (Vue + Quasar + Tailwind v4)

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

> Adapted from [anthropics/skills/frontend-design](https://github.com/anthropics/skills) for Vue 3 + Quasar + Tailwind CSS v4 stack.

## Stack Context

This project uses:

- **Vue 3.5** with Composition API (`<script setup lang="ts">`)
- **Quasar** as component library (layout/spacing must use Tailwind, NOT Quasar utility classes)
- **Tailwind CSS v4** with `@theme` and CSS variables (no `tailwind.config.js`)
- **TypeScript** (no `any` types)
- **Vite** build tool

### Forbidden Patterns

- Quasar layout utilities: `row`, `col`, `q-pa-*`, `q-ma-*`, `q-gutter-*`
- Use Tailwind equivalents: `flex`, `grid`, `p-*`, `m-*`, `gap-*`

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a direction: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, sporty/dynamic, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code that is:

- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

### Typography

- Choose fonts that are beautiful, unique, and interesting
- Avoid generic fonts like Arial and system defaults unless intentional
- Use proper font scale with clear hierarchy (display, heading, body, caption)
- Import from Google Fonts or use locally bundled fonts
- Define in Tailwind v4 `@theme`:
  ```css
  @theme {
    --font-display: 'Your Display Font', serif;
    --font-body: 'Your Body Font', sans-serif;
  }
  ```

### Color

- Build a cohesive color palette — not random colors
- Use HSL-based color systems for better control
- Ensure adequate contrast ratios (WCAG AA minimum)
- Define semantic color tokens:
  ```css
  @theme {
    --color-primary: oklch(0.65 0.24 265);
    --color-surface: oklch(0.15 0.02 265);
    --color-accent: oklch(0.75 0.18 145);
  }
  ```

### Layout

- Use CSS Grid and Flexbox via Tailwind utilities
- Design for mobile-first responsive layouts
- Use proper spacing scale — avoid arbitrary values
- Create rhythm and visual flow

### Motion & Interaction

- Add subtle micro-animations for state changes
- Use CSS transitions for hover/focus states
- Keep animations performant (transform, opacity only)
- Respect `prefers-reduced-motion`

### Visual Depth

- Use shadows, gradients, and layering intentionally
- Consider glassmorphism, neumorphism, or other depth techniques when appropriate
- Avoid flat design unless it's a deliberate aesthetic choice

## Vue Component Patterns

### SFC Order

`<script>` → `<template>` → `<style>` (per project convention)

### Component Example

```vue
<script setup lang="ts">
interface Props {
  variant?: 'default' | 'elevated' | 'outlined'
}

const { variant = 'default' } = defineProps<Props>()
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl bg-surface"
    data-testid="card-surface"
  >
    <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
    <div class="relative z-10 p-6">
      <slot />
    </div>
  </div>
</template>
```

### Composable for Design Tokens

```ts
import { computed } from 'vue'

export function useDesignTokens() {
  const isDark = computed(() => document.documentElement.classList.contains('dark'))

  return { isDark }
}
```

## Quality Checklist

Before completing any UI work:

- [ ] Typography hierarchy is clear and intentional
- [ ] Color palette is cohesive with adequate contrast
- [ ] Responsive layout works on mobile, tablet, desktop
- [ ] Interactive elements have hover/focus/active states
- [ ] Animations are smooth and purposeful
- [ ] No hardcoded colors — use Tailwind theme tokens
- [ ] All SVGs use `fill="currentColor"` and `stroke="currentColor"`
- [ ] No Quasar layout utilities (use Tailwind instead)
- [ ] Interactive elements include `data-testid` (format: `module-action`)
- [ ] User-facing text uses `$t()` / `t()` for i18n
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] No production `console.log`
