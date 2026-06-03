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
