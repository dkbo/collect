status: done
wave: 3
current: 驗收完成（單人四款＋AC6＋AC7 與基準一致）；多人 AC5 因 Firestore DB NOT_FOUND 未驗，已 ESCALATE
touched:
  - scripts/qa/babylonslim/mp.mjs
todo: []
blocked_by: Firestore 具名 DB dkbo-collect 在 test-73ce3 回 gRPC 5 NOT_FOUND（外部環境）
report: state/qa.report.md
notes: 多人補驗：起 5174 preview 後 node scripts/qa/babylonslim/mp.mjs http://localhost:5174/collect/ <out>（無旗標=兩個 context）。
  廚房出餐不可達＝既有 bug overcookedKitchen.ts:225/:191（master 同）。5173/5174 preview 都已關。
