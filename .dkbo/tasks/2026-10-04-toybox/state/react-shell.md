status: done
wave: 4
current: 已刪 HeroSection 的 onB={() => {}} 與過時註解，全閘綠
touched:
  - src/pages/Home/HeroSection.tsx
todo: []
report: state/react-shell.report.md
notes: Handheld.pressB 先 step 再 onB?.(next)，受控模式下 step 照樣呼叫 onIndexChange，故 HeroSection 不傳 onB 仍換張。worktree 的 CandyCrush/index.tsx 變更屬 react-games，非我改。
