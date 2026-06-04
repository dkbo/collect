export function AuthorSection() {
  return (
    <section className="resume-card" data-testid="resume-author">
      <h2 className="resume-card-header">人物介紹</h2>
      <div className="p-6 md:p-8 space-y-5 text-left">
        <div className="relative pl-4 border-l-4 border-purple-500 py-1">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
            個性率真不做作，平常喜歡聽聽音樂哼哼歌、玩玩遊戲、吸收新知等來紓解壓力，不喜歡拖泥帶水的事情纏身。
          </p>
        </div>
        <div className="relative pl-4 border-l-4 border-indigo-500 py-1">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
            以 JavaScript / TypeScript 為核心，跨足前端架構、後端服務與網頁遊戲開發，並運用 Docker、Nginx、CI/CD 等工具確保開發與部署的穩定性。
          </p>
        </div>
        <div className="relative pl-4 border-l-4 border-emerald-500 py-1">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
            長期維持 Side Project 開發習慣，涵蓋 Web3、遊戲資料分析、自動化 Bot、量化交易與 Firebase 即時應用，持續將新技術實踐於實際產品中。
          </p>
        </div>
        <div className="relative pl-4 border-l-4 border-amber-500 py-1">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
            近兩年積極投入 AI 輔助開發，熟悉 Claude Code、Codex CLI、Copilot 等工具，運用 AI Agent Workflow 與 Vibe Coding 加速產品原型驗證與系統建置。
          </p>
        </div>
      </div>
    </section>
  )
}

export default AuthorSection
