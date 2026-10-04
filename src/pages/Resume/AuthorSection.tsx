import PanelHead from '@/pages/Resume/PanelHead'

const PARAGRAPHS = [
  '個性率真不做作，平常喜歡聽聽音樂哼哼歌、玩玩遊戲、吸收新知等來紓解壓力，不喜歡拖泥帶水的事情纏身。',
  '以 JavaScript / TypeScript 為核心，跨足前端架構、後端服務與網頁遊戲開發，並運用 Docker、Nginx、CI/CD 等工具確保開發與部署的穩定性。',
  '長期維持 Side Project 開發習慣，涵蓋 Web3、遊戲資料分析、自動化 Bot、量化交易與 Firebase 即時應用，持續將新技術實踐於實際產品中。',
  '近兩年積極投入 AI 輔助開發，熟悉 Claude Code、Codex CLI、Copilot 等工具，運用 AI Agent Workflow 與 Vibe Coding 加速產品原型驗證與系統建置。',
]

export function AuthorSection() {
  return (
    <section className="resume-panel" data-testid="resume-author">
      <PanelHead title="人物介紹" code="BIO" />
      <div className="resume-panel__body">
        {PARAGRAPHS.map((text, i) => (
          <div key={i} className="resume-bio-row">
            <span className="resume-bio-row__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="resume-bio">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AuthorSection
