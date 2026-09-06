import useScrollAnimation from '@/lib/useScrollAnimation'
import AboutSection from '@/pages/Home/AboutSection'
import FooterCta from '@/pages/Home/FooterCta'
import HeroSection from '@/pages/Home/HeroSection'
import JourneySection from '@/pages/Home/JourneySection'
import TechMarquee from '@/pages/Home/TechMarquee'
import WorksSection from '@/pages/Home/WorksSection'

export function Home() {
  const containerRef = useScrollAnimation()

  return (
    <div className="home-container relative" data-testid="page-home" ref={containerRef}>
      <div className="hero-orb-a" aria-hidden="true" />
      <div className="hero-orb-b" aria-hidden="true" />

      <div className="relative z-10">
        <HeroSection />
        <TechMarquee />
        <div className="animate-on-scroll animate-fade-in-up">
          <WorksSection />
        </div>
        <div className="animate-on-scroll animate-fade-in-up">
          <AboutSection />
        </div>
        <JourneySection />
        <div className="animate-on-scroll animate-fade-in-up">
          <FooterCta />
        </div>
      </div>
    </div>
  )
}

export default Home
