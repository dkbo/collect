import AboutSection from './AboutSection'
import AuthorSection from './AuthorSection'
import StateSection from './StateSection'
import HistorySection from './HistorySection'
import SkillSection from './SkillSection'
import useScrollAnimation from '@/lib/useScrollAnimation'

export function Resume() {
  const containerRef = useScrollAnimation()

  return (
    <div className="max-w-4xl mx-auto pb-12" data-testid="page-resume" ref={containerRef}>
      {/* Title Header */}
      <header className="text-center mb-10 animate-on-scroll animate-fade-in-up">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-tight">
          E-履歷 (E-Resume)
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          以互動式的圖表、時序線以及動態標籤雲，呈現個人開發歷程與專業技能組合。
        </p>
      </header>

      {/* Grid / Masonry columns */}
      <div className="columns-1 md:columns-2 gap-6 [column-fill:_balance]">
        <div className="break-inside-avoid w-full mb-6 animate-on-scroll animate-fade-in-up">
          <AboutSection />
        </div>
        <div className="break-inside-avoid w-full mb-6 animate-on-scroll animate-fade-in-up animate-stagger-1">
          <AuthorSection />
        </div>
        <div className="break-inside-avoid w-full mb-6 animate-on-scroll animate-fade-in-up animate-stagger-2">
          <StateSection />
        </div>
        <div className="break-inside-avoid w-full mb-6 animate-on-scroll animate-fade-in-up animate-stagger-3">
          <HistorySection />
        </div>
        <div className="break-inside-avoid w-full mb-6 animate-on-scroll animate-fade-in-up animate-stagger-4">
          <SkillSection />
        </div>
      </div>
    </div>
  )
}

export default Resume
