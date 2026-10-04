import AboutSection from '@/pages/Resume/AboutSection'
import AuthorSection from '@/pages/Resume/AuthorSection'
import StateSection from '@/pages/Resume/StateSection'
import HistorySection from '@/pages/Resume/HistorySection'
import SkillSection from '@/pages/Resume/SkillSection'
import useScrollAnimation from '@/lib/useScrollAnimation'
import '@/pages/Resume/Resume.css'

export function Resume() {
  const containerRef = useScrollAnimation()

  return (
    <div className="tb-container resume-page" data-testid="page-resume" ref={containerRef}>
      <header className="tb-sechead animate-on-scroll animate-fade-in-up">
        <div className="tb-sechead__text">
          <span className="tb-sechead__eyebrow">— PLAYER PROFILE —</span>
          <h1 className="tb-sechead__title">E-履歷 (E-Resume)</h1>
          <p className="resume-lead">以互動式的圖表、時序線以及動態標籤雲，呈現個人開發歷程與專業技能組合。</p>
        </div>
      </header>

      {/* 瀑布流兩欄 */}
      <div className="resume-columns">
        <div className="resume-cell animate-on-scroll animate-fade-in-up">
          <AboutSection />
        </div>
        <div className="resume-cell animate-on-scroll animate-fade-in-up animate-stagger-1">
          <AuthorSection />
        </div>
        <div className="resume-cell animate-on-scroll animate-fade-in-up animate-stagger-2">
          <StateSection />
        </div>
        <div className="resume-cell animate-on-scroll animate-fade-in-up animate-stagger-3">
          <HistorySection />
        </div>
        <div className="resume-cell animate-on-scroll animate-fade-in-up animate-stagger-4">
          <SkillSection />
        </div>
      </div>
    </div>
  )
}

export default Resume
