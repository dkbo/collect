#!/usr/bin/env bash
# PreToolUse(mcp__playwright__*)：Playwright MCP 在本機需要 /opt/google/chrome/chrome（安裝要 sudo）。
# 缺 Chrome 時 MCP 一定失敗，直接擋下並指向 verify-web skill 的 chromium 備援，省掉那一輪。
set -uo pipefail
[ -x /opt/google/chrome/chrome ] && exit 0
cat >&2 <<'MSG'
擋下：Playwright MCP 需要 /opt/google/chrome/chrome，本機沒有（安裝需 sudo，無法自動化）。

改用 verify-web skill 的備援：快取的 chromium + node 腳本
  ls /home/bal/.cache/ms-playwright/          # 找 chromium-<ver>
  ls /home/bal/.npm/_npx/*/node_modules/playwright  # 找 playwright 模組
  # chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] })
細節（hash 路由、Godot iframe、/battle 多 context）見 .claude/skills/verify-web/SKILL.md。
MSG
exit 2
