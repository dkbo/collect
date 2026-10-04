import { useState, type RefObject } from 'react'
import { ArrowUpRight, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GAME_CATALOG } from '@/babylon/games/catalog'
import { Button, Handheld, StatTile, StatusPill, Tag } from '@/components/toybox'
import { prefersReducedMotion, useCountUp } from '@/lib/useCountUp'
import { HERO_TILES, WORKS } from '@/pages/Home/works'

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { value: shown, ref } = useCountUp(value)
  return <StatTile value={<span ref={ref as RefObject<HTMLSpanElement>}>{shown}</span>} suffix={suffix} label={label} />
}

function scrollToWorks() {
  document.getElementById('works')?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}

const HERO_IMAGES = HERO_TILES.map((w) => w.shot ?? '')
const HERO_ALTS = HERO_TILES.map((w) => `${w.title} 畫面截圖`)

export function HeroSection() {
  const navigate = useNavigate()
  const [tile, setTile] = useState(0)
  const current = HERO_TILES[tile]

  return (
    <section className="home-hero" data-testid="home-hero">
      {/* 左欄：文案 */}
      <div className="home-hero__copy">
        <StatusPill>目前在做：Babylon.js 多人對戰 + AI 協作開發</StatusPill>

        <h1 className="home-hero__title">
          嗨，我是 <span className="home-hero__name tb-tilt-1">DKBO</span>
        </h1>
        <p className="home-hero__sub">把新技術拿來做有趣的東西</p>
        <p className="home-hero__lead">
          13 年前端資歷。這裡放的是我用 React、Babylon.js、Godot 與 WebRTC 做出來的網頁遊戲和工具，全部純前端，打開就能玩。
        </p>

        <div className="home-hero__actions">
          <Button variant="primary" icon={<Play strokeWidth={2.5} aria-hidden="true" />} onClick={scrollToWorks} data-testid="hero-cta-works">
            開始玩
          </Button>
          <Button href="/resume" iconEnd={<ArrowUpRight strokeWidth={2.5} aria-hidden="true" />} data-testid="hero-cta-resume">
            E-履歷
          </Button>
        </div>

        <div className="home-hero__stats">
          <Stat value={13} suffix="+" label="年前端經驗" />
          <Stat value={WORKS.length} label="個站內作品" />
          <Stat value={GAME_CATALOG.length} label="款多人對戰遊戲" />
          <Stat value={2} label="套遊戲引擎" />
        </div>
      </div>

      {/* 右欄：掌機（螢幕輪播 HERO_TILES；A 進入目前作品、B 換下一張） */}
      <div className="home-hero__console" data-testid="home-handheld">
        <Tag tone="sky" size="l" tilt={3} className="home-hero__sticker top-0 left-4">WebRTC</Tag>
        <Tag tone="mint" size="l" tilt={2} className="home-hero__sticker top-1/2 right-0">Godot 4</Tag>
        <Tag tone="pink" size="l" tilt={1} className="home-hero__sticker bottom-6 left-0">Babylon.js</Tag>
        <Handheld
          images={HERO_IMAGES}
          imageAlts={HERO_ALTS}
          index={tile}
          onIndexChange={setTile}
          onA={(i) => navigate(HERO_TILES[i]?.to ?? '/')}
          aLabel={current ? `A 鍵：進入${current.title}` : 'A 鍵'}
          bLabel="B 鍵：下一張"
        />
      </div>
    </section>
  )
}

export default HeroSection
