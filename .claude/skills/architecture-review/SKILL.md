---
name: architecture-review
description: 架構審查（唯讀）：模組相依、耦合、狀態流、可擴展性。Use when 要審系統設計或大改前評估影響面。forked 到 arch-security-reviewer（opus high）執行。
context: fork
agent: arch-security-reviewer
effort: high
background: false
---

# Skill: architecture-review

## Responsibilities
- System design analysis
- Dependency flow review
- Scalability analysis

## Scope
- Identify coupling and cohesion issues
- Evaluate module boundaries and interface contracts
- Assess data flow and state management patterns
- Flag scalability bottlenecks

## Output Format
```
### Architecture Review

**Summary:** <one-line verdict>

**Issues:**
- <issue> — <impact>

**Recommendations:**
- <action>
```
