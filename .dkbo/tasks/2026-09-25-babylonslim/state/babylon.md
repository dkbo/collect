status: done
wave: 2
current: 波2 完成：AC7 修好（preload-helper 高優先度獨立 group），AC3/AC4 仍過，已交 leader
touched:
  - vite.config.ts
  - src/babylon/babylonCore.ts
todo: []
blocked_by: dk-msg 給 qa 未送達（qa 不在本波、尚未上線，已記 log）
report: state/babylon.report.md
notes: 根因：rolldown group 預設遞迴收依賴，__vitePreload helper 被 vendor-babylon 吃掉 → 每頁 preload Babylon。
  修法：manualChunks → codeSplitting.groups [preload-helper priority 1, vendorChunk 函式]。
  index 仍含 vendor-babylon 字串＝lazy 路由 mapDeps（非 import），見 report 疑慮。
  自查腳本 net.mjs／solo.mjs 在本 session scratchpad。
