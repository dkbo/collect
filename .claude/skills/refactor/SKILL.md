---
name: refactor
description: 只重構不改行為：降複雜度、提可讀性、不引入新抽象，改完跑 pnpm lint。Use when asked to refactor / clean up / 整理程式碼.
model: opus
effort: high
---

# Skill: refactor

## Responsibilities
- Preserve existing behavior
- Reduce complexity
- Improve readability

## Rules
- No behavior changes — refactor only
- Do not introduce new abstractions unless explicitly requested
- Prefer editing existing files over creating new ones
- Run `pnpm lint` after changes

## Output Format
```
### Refactor Plan

**Target:** <file or module>

**Changes:**
- <change> — <reason>

**Preserved behavior:** <confirmation>
```
