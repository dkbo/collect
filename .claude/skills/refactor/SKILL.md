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
