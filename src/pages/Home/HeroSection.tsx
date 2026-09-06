import { type CSSProperties, type RefObject } from 'react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GAME_CATALOG } from '@/babylon/games/catalog'
import { prefersReducedMotion, useCountUp } from '@/lib/useCountUp'
import { WorkShot } from '@/pages/Home/WorkShot'
import { HERO_TILES, WORKS } from '@/pages/Home/works'

const TILE_LAYOUT = [
  { className: 'hero-tile hero-tile-a left-10 top-5 w-[340px]', shotClass: 'h-[150px]' },
  { className: 'hero-tile hero-tile-b left-[236px] top-[200px] w-[260px]', shotClass: 'h-[130px]' },
  { className: 'hero-tile hero-tile-c left-0 top-[300px] w-[240px]', shotClass: 'h-[92px]' },
] as const

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { value: shown, ref } = useCountUp(value)
  return (
    <div className="flex flex-col gap-0.5">
      <div ref={ref as RefObject<HTMLDivElement>} className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white">
        {shown}
        {suffix && <span className="text-purple-600 dark:text-purple-400">{suffix}</span>}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function scrollToWorks() {
  document.getElementById('works')?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}

export function HeroSection() {
  return (
    <section className="hero-dots relative pt-16 pb-20 lg:pt-28 lg:pb-24" data-testid="home-hero">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* 左欄：文案 */}
        <div className="flex flex-col gap-5">
          <div
            className="hero-reveal inline-flex self-start items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/25 bg-purple-500/5 text-[13px] font-medium text-purple-700 dark:text-purple-300"
            style={{ '--delay': '0s' } as CSSProperties}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" aria-hidden="true" />
            目前在做：Babylon.js 多人對戰 + AI 協作開發
          </div>

          <h1
            className="hero-reveal m-0 text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-slate-900 dark:text-white"
            style={{ '--delay': '0.1s' } as CSSProperties}
          >
            嗨，我是 <span className="hero-grad-text">DKBO</span>
            <br />
            <span className="text-[26px] md:text-3xl lg:text-[38px] font-bold text-slate-700 dark:text-slate-300">
              把新技術拿來做有趣的東西
            </span>
          </h1>

          <p
            className="hero-reveal m-0 max-w-[520px] text-base lg:text-[17px] leading-relaxed text-slate-600 dark:text-slate-300"
            style={{ '--delay': '0.2s' } as CSSProperties}
          >
            13 年前端資歷。這裡放的是我用 React、Babylon.js、Godot 與 WebRTC 做出來的網頁遊戲和工具，全部純前端，打開就能玩。
          </p>

          <div className="hero-reveal flex flex-col sm:flex-row gap-3" style={{ '--delay': '0.3s' } as CSSProperties}>
            <button type="button" className="cta-primary" onClick={scrollToWorks} data-testid="hero-cta-works">
              看作品
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
            </button>
            <Link to="/resume" className="cta-secondary" data-testid="hero-cta-resume">
              E-履歷
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div
            className="hero-reveal grid grid-cols-2 sm:flex sm:gap-9 gap-4 mt-2 pt-5 border-t border-slate-200 dark:border-slate-800"
            style={{ '--delay': '0.4s' } as CSSProperties}
          >
            <Stat value={13} suffix="+" label="年前端經驗" />
            <Stat value={WORKS.length} label="個站內作品" />
            <Stat value={GAME_CATALOG.length} label="款多人對戰遊戲" />
            <Stat value={2} label="套遊戲引擎" />
          </div>
        </div>

        {/* 右欄：漂浮預覽卡（lg 以下隱藏） */}
        <div className="hidden lg:block relative h-[480px]" aria-hidden="true">
          {HERO_TILES.map((work, i) => {
            const layout = TILE_LAYOUT[i]
            if (!layout) return null
            return (
              <div key={work.id} className={layout.className}>
                <WorkShot work={work} className={layout.shotClass} />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="text-[15px] font-bold text-slate-900 dark:text-white">{work.title}</div>
                  <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">{work.tags[0]}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default HeroSection
