import IntroSection from '@/pages/Home/IntroSection'
import PastSection from '@/pages/Home/PastSection'
import RpgSection from '@/pages/Home/RpgSection'
import FirebaseSection from '@/pages/Home/FirebaseSection'
import useScrollAnimation from '@/lib/useScrollAnimation'

export function Home() {
  const containerRef = useScrollAnimation()

  return (
    <div className="home-container" data-testid="page-home" ref={containerRef}>
      {/* Hero Header */}
      <header className="text-center mb-10 animate-on-scroll animate-fade-in-up">
        <h1 className="hero-title">
          DKBO&apos;s Collect
        </h1>
        <p className="hero-subtitle">
          網站由純前端建置，後端方面結合 firebase 的授權及即時資料庫的特性，重構昔日的作品。主要由 React + React-Router + React-Redux 所構成，隨著經驗的累積會陸續把技術應用在此網頁上。
        </p>
      </header>

      {/* Content Sections */}
      <div className="space-y-8">
        <div className="animate-on-scroll animate-fade-in-up animate-stagger-1">
          <IntroSection />
        </div>
        <div className="animate-on-scroll animate-fade-in-up animate-stagger-2">
          <PastSection />
        </div>
        <div className="animate-on-scroll animate-fade-in-up animate-stagger-3">
          <RpgSection />
        </div>
        <div className="animate-on-scroll animate-fade-in-up animate-stagger-4">
          <FirebaseSection />
        </div>
      </div>
    </div>
  )
}

export default Home
