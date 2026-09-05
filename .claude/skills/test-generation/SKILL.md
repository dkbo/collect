---
name: test-generation
description: 為本專案撰寫測試（單元／整合／邊界案例，目標 80%+ 覆蓋）。Use when asked to write tests, add coverage, or do TDD.
model: sonnet
effort: high
---

# Skill: test-generation

## Responsibilities
- Unit tests
- Integration tests
- Edge case coverage
- Target: 80%+ coverage

## Rules
- No mocking of the database in integration tests
- Follow existing test file naming and structure
- Cover happy path, edge cases, and error states

## Output Format
```
### Test Plan

**Target:** <module or function>

**Tests:**
- [UNIT] <test name> — <what it verifies>
- [INTEGRATION] <test name> — <what it verifies>
- [EDGE] <test name> — <edge case>
```
