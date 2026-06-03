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
