---
name: security-audit
description: 安全審計（唯讀）：Firebase 規則、WebRTC signaling、注入、密鑰、權限。Use when 要檢查安全問題或合併前做安全掃描。forked 到 arch-security-reviewer（opus high）執行。
context: fork
agent: arch-security-reviewer
effort: high
background: false
---

# Skill: security-audit

## Responsibilities
- Auth & authz review
- Injection risk detection (XSS, SQLi, command injection)
- Secrets detection (hardcoded keys, tokens, credentials)
- Dependency vulnerability scanning

## Scope
- Review authentication flows and access control
- Scan for OWASP Top 10 vulnerabilities
- Check environment variable and secret handling
- Flag insecure third-party dependencies

## Output Format
```
### Security Audit

**Risk Level:** LOW | MEDIUM | HIGH | CRITICAL

**Findings:**
- [SEVERITY] <finding> — <location>

**Recommendations:**
- <action>
```
