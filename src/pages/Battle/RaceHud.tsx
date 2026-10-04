import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { Box, Flag, RotateCcw, Shield, Timer } from 'lucide-react'
import type { RaceHud } from '@/babylon/types'
import type { ItemKind } from '@/babylon/games/raceRules/items'
import { hudScale } from '@/pages/Battle/bomberHud'
import {
  RACE_BEST_FLASH_MS,
  RACE_COLORS,
  RACE_FINAL_BANNER_MS,
  RACE_ITEM_LABELS,
  RACE_ITEM_REEL,
  RACE_MAP_H,
  RACE_MAP_PAD,
  RACE_MAP_W,
  RANK_TONES,
  bestLapImproved,
  formatLapMs,
  itemSlotView,
  mapCars,
  mapTransform,
  ordinalSuffix,
  rankOf,
  rankTone,
  resultRows,
  startTick,
  trackPoints,
} from '@/pages/Battle/raceHud'

const INK = '#2B2440'

/** 道具圖示（spec §9.6）：viewBox 48×48、墨色描邊 2.5 */
export function RaceItemIcon({ kind, className }: { kind: ItemKind; className?: string }) {
  const uid = useId().replace(/[^\w-]/g, '')
  if (kind === 'shield') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <circle cx="24" cy="24" r="19" fill="#1FB5E0" stroke={INK} strokeWidth="2.5" />
        <Shield x="11" y="11" size={26} color="#FFFFFF" strokeWidth={2.5} fill="#7FE8FF" />
      </svg>
    )
  }
  if (kind === 'banana') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M24 14 C16 18 10 28 9 38 C14 36 19 30 22 24 Z" fill="#FFD23F" />
          <path d="M24 14 C32 18 38 28 39 38 C34 36 29 30 26 24 Z" fill="#FFD23F" />
          <path d="M21 16 C20 26 21 34 24 40 C27 34 28 26 27 16 Z" fill="#FFD23F" />
          <circle cx="9" cy="38" r="2" fill="#C79A00" />
          <circle cx="39" cy="38" r="2" fill="#C79A00" />
          <circle cx="24" cy="40" r="2" fill="#C79A00" />
          <rect x="22" y="8" width="4" height="7" rx="1.5" fill="#7A4A1D" />
        </g>
      </svg>
    )
  }
  if (kind === 'shell') {
    const grad = `race-shell-${uid}`
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <defs>
          <radialGradient id={grad} cx="35%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#FF8A80" />
            <stop offset="50%" stopColor="#E8413A" />
            <stop offset="100%" stopColor="#A82A24" />
          </radialGradient>
        </defs>
        <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M8 30 A16 15 0 0 1 40 30 Z" fill={`url(#${grad})`} />
          <rect x="6" y="29" width="36" height="7" rx="3.5" fill="#FFF6E3" />
          <g fill="#FF8A80" strokeWidth="1.5">
            <circle cx="17" cy="22" r="3" />
            <circle cx="24" cy="17" r="3" />
            <circle cx="31" cy="22" r="3" />
          </g>
        </g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M6 26 C6 14 14 8 24 8 C34 8 42 14 42 26 Z" fill="#FF7A3D" />
        <g fill="#FFF6E3" strokeWidth="1.5">
          <circle cx="16" cy="17" r="4" />
          <circle cx="30" cy="14" r="3.5" />
          <circle cx="37" cy="22" r="2.5" />
        </g>
        <rect x="15" y="25" width="18" height="15" rx="6" fill="#FFF1E0" />
      </g>
      <ellipse cx="21" cy="31" rx="1.6" ry="2.4" fill={INK} />
      <ellipse cx="27" cy="31" rx="1.6" ry="2.4" fill={INK} />
    </svg>
  )
}

/** 左上道具欄：轉盤膠卷／落定圖示（彈一下＋外框閃白）／空 */
function ItemSlot({ item, rolling }: { item: ItemKind | null; rolling: boolean }) {
  const slot = itemSlotView(item, rolling)
  const label = slot === 'item' && item ? RACE_ITEM_LABELS[item] : slot === 'rolling' ? '抽道具中' : '沒有道具'
  return (
    <div className="race-item" data-race-item={slot === 'item' ? item : slot} aria-label={`道具：${label}`}>
      <div className="race-item-well">
        {slot === 'rolling' ? (
          <div className="race-item-rolling">
            {[...RACE_ITEM_REEL, RACE_ITEM_REEL[0]].map((k, i) => (
              <span key={i} className="race-item-reel-cell" data-race-reel={k}>
                <RaceItemIcon kind={k} className="race-item-reel-icon" />
              </span>
            ))}
          </div>
        ) : slot === 'item' && item ? (
          <RaceItemIcon key={item} kind={item} className="race-item-icon" />
        ) : (
          <Box className="race-item-empty" />
        )}
      </div>
      {slot === 'item' && item && <span key={item} className="race-item-flash" />}
    </div>
  )
}

/** 左下小地圖：賽道輪廓只在 pts 參照改變時重算 */
function MiniMap({ map }: { map: RaceHud['map'] }) {
  const { pts, cars } = map
  const tf = useMemo(() => mapTransform(pts, RACE_MAP_W, RACE_MAP_H, RACE_MAP_PAD), [pts])
  const track = useMemo(() => trackPoints(pts, tf), [pts, tf])
  const tick = useMemo(() => startTick(pts, tf, 4), [pts, tf])
  return (
    <div className="race-map" data-race-map="">
      <svg viewBox={`0 0 ${RACE_MAP_W} ${RACE_MAP_H}`} className="race-map-svg" aria-label="小地圖">
        <polyline points={track} fill="none" stroke={INK} strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={track} fill="none" stroke="#5A5380" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" />
        <line {...tick} stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        {mapCars(cars, tf).map((c) => (
          <g key={c.id} data-race-car={c.isSelf ? 'self' : c.id}>
            {c.isSelf && <circle cx={c.cx} cy={c.cy} r={c.r + 2} fill="#FFFFFF" />}
            <circle cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} stroke={INK} strokeWidth="1.5" />
          </g>
        ))}
      </svg>
    </div>
  )
}

/** 衝線後置中的名次表 */
function Results({ hud }: { hud: RaceHud }) {
  const selfId = hud.map.cars.find((c) => c.isSelf)?.id ?? null
  return (
    <div className="race-results" data-race-results="">
      <div className="race-results-flagbar" />
      <div className="race-results-head">
        <Flag className="race-results-flag" />
        <span>完賽！</span>
      </div>
      {resultRows(hud.results, selfId).map((r) => (
        <div
          key={r.id}
          className={r.time === null ? 'race-results-row race-results-row-pending' : 'race-results-row'}
          data-race-row={r.id}
        >
          <span className="race-results-badge" style={{ backgroundColor: RANK_TONES[r.tone] }}>
            {r.rank}
          </span>
          <span className="race-results-dot" style={{ backgroundColor: (RACE_COLORS[r.colorIndex] ?? RACE_COLORS[0]).base }} />
          <span className="race-results-name">
            {r.isBot && <span className="race-ai-tag">AI</span>}
            <span className="race-results-name-text">{r.isSelf ? '你' : r.name}</span>
          </span>
          {r.time === null ? (
            <span className="race-results-pending">衝線中…</span>
          ) : (
            <span className="race-num race-results-time">{r.time}</span>
          )}
          <span className="race-num race-results-best">{r.best}</span>
        </div>
      ))}
    </div>
  )
}

interface RaceHudViewProps {
  hud: RaceHud
  /** 「最後一圈！」大字是否顯示（由外層在 finalLap 轉 true 時掛 2.2 秒） */
  banner?: boolean
  /** BEST 是否正在閃新最佳圈色 */
  bestFlash?: boolean
  scale?: number
  rootRef?: Ref<HTMLDivElement>
}

/** 賽車 HUD 的純呈現（無副作用，可在 node 靜態渲染自查） */
export function RaceHudView({ hud, banner = false, bestFlash = false, scale = 1, rootRef }: RaceHudViewProps) {
  const tone = rankTone(hud.rank)
  const rankStyle = { '--race-rank-fill': RANK_TONES[tone] } as CSSProperties
  return (
    <div ref={rootRef} className="race-hud" style={{ '--race-scale': scale } as CSSProperties} data-race-hud="">
      <div className="race-tl">
        <ItemSlot item={hud.item} rolling={hud.rolling} />
        <div className="race-tl-col">
          <div className={hud.finalLap ? 'race-lap race-lap-final' : 'race-lap'} data-race-lap={hud.lap}>
            <span className="race-lap-label">LAP</span>
            <span className="race-num race-lap-cur">{hud.lap}</span>
            <span className="race-num race-lap-total">/{hud.laps}</span>
          </div>
          <div className="race-time">
            <div className="race-time-row">
              <Timer className="race-time-icon" />
              <span className="race-num race-time-cur">{formatLapMs(hud.lapMs)}</span>
            </div>
            <div className={bestFlash ? 'race-time-best race-time-best-new' : 'race-time-best'}>
              <span className="race-time-best-label">BEST</span>
              <span className="race-num race-time-best-num">{formatLapMs(hud.bestLapMs)}</span>
            </div>
          </div>
        </div>
      </div>

      <MiniMap map={hud.map} />

      <div className="race-rank" style={rankStyle} data-race-rank={hud.rank} data-race-tone={tone}>
        <span key={hud.rank} className="race-rank-num">
          <span>{rankOf(hud.rank)}</span>
          <span className="race-rank-suffix">{ordinalSuffix(hud.rank)}</span>
        </span>
        <span className="race-rank-total">/{hud.total}</span>
      </div>

      {hud.wrongWay && (
        <div className="race-wrongway" data-race-wrongway="" role="alert">
          <RotateCcw className="race-wrongway-icon" />
          <span>逆向行駛！</span>
        </div>
      )}

      {banner && (
        <div className="race-finallap" data-race-finallap="">
          <span className="race-finallap-ribbon" />
          <span className="race-finallap-text">最後一圈！</span>
        </div>
      )}

      {hud.finished && <Results hud={hud} />}
    </div>
  )
}

/**
 * 極速賽車的 React HUD（spec §9）：左上道具欄＋圈數＋時間、左下小地圖、右下名次大字，
 * 中上逆向警告、最後一圈大字、衝線後名次表。以 960×540 設計尺寸排版，依容器等比縮放（--race-scale）；
 * 矮畫面（max-height 500px）由 CSS 改排精簡版。
 */
export function RaceHud({ hud }: { hud: RaceHud }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  // finalLap 由 false 轉 true 的瞬間掛上大字；best 刷新時閃色（render 期間比對前值，見 React「依 props 調整 state」）
  const [prevFinal, setPrevFinal] = useState(hud.finalLap)
  const [banner, setBanner] = useState(false)
  const [prevBest, setPrevBest] = useState(hud.bestLapMs)
  const [bestFlash, setBestFlash] = useState(false)
  if (hud.finalLap !== prevFinal) {
    setPrevFinal(hud.finalLap)
    setBanner(hud.finalLap)
  }
  if (hud.bestLapMs !== prevBest) {
    setPrevBest(hud.bestLapMs)
    if (bestLapImproved(prevBest, hud.bestLapMs)) setBestFlash(true)
  }

  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(false), RACE_FINAL_BANNER_MS)
    return () => window.clearTimeout(t)
  }, [banner])

  useEffect(() => {
    if (!bestFlash) return
    const t = window.setTimeout(() => setBestFlash(false), RACE_BEST_FLASH_MS)
    return () => window.clearTimeout(t)
  }, [bestFlash, prevBest])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setScale(hudScale(el.clientWidth, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return <RaceHudView hud={hud} banner={banner} bestFlash={bestFlash} scale={scale} rootRef={rootRef} />
}

export default RaceHud
