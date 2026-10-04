import { Marquee } from '@/components/toybox'
import AboutSection from '@/pages/Home/AboutSection'
import FooterCta from '@/pages/Home/FooterCta'
import HeroSection from '@/pages/Home/HeroSection'
import JourneySection from '@/pages/Home/JourneySection'
import WorksSection from '@/pages/Home/WorksSection'
import '@/pages/Home/Home.css'

const MARQUEE_ITEMS = ['INSERT COIN', 'VUE', 'REACT 19', 'TYPESCRIPT', 'BABYLON.JS', 'GODOT 4', 'WEBRTC', 'FIREBASE', 'ZUSTAND', 'TAILWIND V4', 'CLAUDE CODE']

export function Home() {
  return (
    <div className="text-left" data-testid="page-home">
      <div className="tb-container">
        <HeroSection />
      </div>
      {/* 跑馬燈滿版，放在 tb-container 外 */}
      <div data-testid="home-marquee">
        <Marquee items={MARQUEE_ITEMS} />
      </div>
      <div className="tb-container">
        <WorksSection />
        <AboutSection />
        <JourneySection />
        <FooterCta />
      </div>
    </div>
  )
}

export default Home
