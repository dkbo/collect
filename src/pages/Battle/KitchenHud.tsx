import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react'
import { AlarmClock, BookOpen, Check, ChevronRight, Coins, CookingPot, Hand, Slice, TriangleAlert } from 'lucide-react'
import type { KitchenHud, KitchenHudOrder, KitchenHudPlayer, KitchenIng, KitchenItemKind } from '@/babylon/types'
import { hudScale, playerLabel } from '@/pages/Battle/bomberHud'
import {
  KITCHEN_COLORS,
  KITCHEN_DISHES,
  clockView,
  dishName,
  goneFloatText,
  isRecipeToggleKey,
  orderLevel,
  orderRatio,
  orderRow,
  orderSeconds,
  sortKitchenPlayers,
  type LeavingOrder,
} from '@/pages/Battle/kitchenHud'

const INK = '#2B2440'
/** 物品色票（spec 特寫表色票） */
const ITEM = {
  veg: '#6FCF3F',
  vegDark: '#3E9A1E',
  vegChop: '#B6F07A',
  meat: '#E8525E',
  meatDark: '#A92A38',
  meatFat: '#FFE9DE',
  vegSoup: '#9BD65A',
  meatSoup: '#EE8A3A',
  burnt: '#2E2424',
  bowl: '#FFFFFF',
  bowlShade: '#C9C3DA',
} as const

/** 玩家色以 CSS 變數交給 .kitchen-* class 取用 */
function colorVars(colorIndex: number): CSSProperties {
  const c = KITCHEN_COLORS[colorIndex] ?? KITCHEN_COLORS[0]
  return { '--kc-light': c.light, '--kc-base': c.base, '--kc-dark': c.dark } as CSSProperties
}

/** 碗（湯或焦炭）：白碗、內緣湯面；焦了是黑色焦塊 */
function Bowl({ ing, burnt }: { ing: KitchenIng; burnt?: boolean }) {
  const soup = ing === 'v' ? ITEM.vegSoup : ITEM.meatSoup
  return (
    <g>
      <path d="M8 30 H56 C56 45 46 54 32 54 C18 54 8 45 8 30 Z" fill={ITEM.bowl} stroke={INK} strokeWidth="2.5" />
      <path d="M13 38 C16 47 23 51 32 51" fill="none" stroke={ITEM.bowlShade} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="32" cy="30" rx="24" ry="7" fill={burnt ? ITEM.burnt : soup} stroke={INK} strokeWidth="2.5" />
      {burnt ? (
        <g>
          <path d="M22 30 C24 20 40 20 42 30 Z" fill={ITEM.burnt} stroke={INK} strokeWidth="2" />
          <path d="M28 25 l3 3 l-3 2 M36 24 l-2 4 l3 1" fill="none" stroke="#FF7A1A" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : ing === 'v' ? (
        <g fill={ITEM.vegDark}>
          <circle cx="24" cy="29" r="2.4" />
          <circle cx="34" cy="31" r="2" />
          <circle cx="41" cy="28" r="2.2" />
        </g>
      ) : (
        <g fill={ITEM.meat} stroke={INK} strokeWidth="1.2">
          <rect x="21" y="26.5" width="5" height="4.5" rx="1.2" />
          <rect x="31" y="28" width="5" height="4.5" rx="1.2" />
          <rect x="39" y="26" width="5" height="4.5" rx="1.2" />
        </g>
      )}
      <ellipse cx="24" cy="28" rx="5" ry="1.4" fill="#fff" opacity="0.55" />
    </g>
  )
}

function Raw({ ing }: { ing: KitchenIng }) {
  if (ing === 'v') {
    return (
      <g>
        <circle cx="32" cy="34" r="19" fill={ITEM.veg} stroke={INK} strokeWidth="2.5" />
        <path d="M32 16 V52 M32 34 C24 30 20 24 20 20 M32 40 C40 36 44 30 44 25" fill="none" stroke={ITEM.vegDark} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M14 34 C14 44 20 50 26 52 M50 34 C50 44 44 50 38 52" fill="none" stroke={INK} strokeWidth="2.5" />
      </g>
    )
  }
  return (
    <g>
      <path d="M10 34 C10 22 22 16 34 16 C48 16 56 24 56 34 C56 46 44 52 32 52 C18 52 10 44 10 34 Z" fill={ITEM.meat} stroke={INK} strokeWidth="2.5" />
      <path d="M16 34 C16 26 24 22 34 22 C45 22 50 28 50 34" fill="none" stroke={ITEM.meatFat} strokeWidth="3" strokeLinecap="round" />
      <circle cx="47" cy="42" r="4.5" fill={ITEM.meatFat} stroke={INK} strokeWidth="2" />
    </g>
  )
}

function Chopped({ ing }: { ing: KitchenIng }) {
  const fill = ing === 'v' ? ITEM.vegChop : ITEM.meat
  const edge = ing === 'v' ? ITEM.vegDark : ITEM.meatDark
  return (
    <g stroke={INK} strokeWidth="2.2">
      {[
        [12, 30],
        [30, 22],
        [26, 38],
        [42, 34],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="14" height="12" rx="3.5" fill={fill} />
          <path d={`M${x + 3} ${y + 9} H${x + 11}`} stroke={edge} strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </g>
  )
}

/** 食材／成品圖示（inline SVG，照特寫表 2×4 矩陣） */
export function KitchenItemIcon({ ing, kind, className }: { ing: KitchenIng; kind: KitchenItemKind; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {kind === 'raw' && <Raw ing={ing} />}
      {kind === 'chop' && <Chopped ing={ing} />}
      {(kind === 'soup' || kind === 'burnt') && <Bowl ing={ing} burnt={kind === 'burnt'} />}
    </svg>
  )
}

/** Q 版廚師頭像（同 BomberAvatar 的臉，拿掉天線換白色廚師帽） */
export function KitchenAvatar({ colorIndex, className }: { colorIndex: number; className?: string }) {
  const c = KITCHEN_COLORS[colorIndex] ?? KITCHEN_COLORS[0]
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="36" r="17" fill={c.base} stroke={INK} strokeWidth="2.2" />
      <path d="M17 42 C20 50 26 53 32 53" fill="none" stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
      <rect x="20" y="30" width="24" height="16" rx="7.5" fill="#FFF1E0" stroke={INK} strokeWidth="1.8" />
      <ellipse cx="27.5" cy="38" rx="2.5" ry="3.5" fill={INK} />
      <ellipse cx="36.5" cy="38" rx="2.5" ry="3.5" fill={INK} />
      <circle cx="28.4" cy="36.5" r="1" fill="#fff" />
      <circle cx="37.4" cy="36.5" r="1" fill="#fff" />
      <g fill="#fff" stroke={INK} strokeWidth="2">
        <circle cx="22" cy="14" r="7.5" />
        <circle cx="42" cy="14" r="7.5" />
        <circle cx="32" cy="10" r="8.5" />
        <rect x="18" y="16" width="28" height="8" rx="3" />
      </g>
      <path d="M22 22 H42" stroke="#C9C3DA" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** 步驟列：食材 › 切 › 煮（兩道湯都是這三步） */
function Steps({ ing }: { ing: KitchenIng }) {
  return (
    <span className="kitchen-steps" aria-hidden="true">
      <KitchenItemIcon ing={ing} kind="raw" className="kitchen-steps-ing" />
      <ChevronRight className="kitchen-steps-sep" />
      <Slice className="kitchen-steps-icon" />
      <ChevronRight className="kitchen-steps-sep" />
      <CookingPot className="kitchen-steps-icon" />
    </span>
  )
}

function OrderCard({ order, leave }: { order: KitchenHudOrder; leave?: LeavingOrder['reason'] }) {
  const level = orderLevel(order.remainMs)
  const dish = KITCHEN_DISHES.find((d) => d.ing === order.ing)
  return (
    <div
      className={`kitchen-order kitchen-order-${level}${leave ? ` kitchen-order-leave-${leave}` : ''}`}
      data-kitchen-order={order.id}
      data-level={level}
    >
      {level === 'danger' && <TriangleAlert className="kitchen-order-alert" aria-label="快逾時" />}
      <span className="kitchen-order-badge">+{dish?.score}</span>
      <div className="kitchen-order-dish">
        <KitchenItemIcon ing={order.ing} kind="soup" className="kitchen-order-dish-svg" />
      </div>
      <div className="kitchen-order-body">
        <span className="kitchen-order-name">{dishName(order.ing)}</span>
        <Steps ing={order.ing} />
        <div className="kitchen-order-timer">
          <span className="kitchen-order-bar">
            <span className="kitchen-order-fill" style={{ width: `${orderRatio(order.remainMs) * 100}%` }} />
          </span>
          <span className="kitchen-order-sec">{orderSeconds(order.remainMs)}s</span>
        </div>
      </div>
      {leave === 'served' && (
        <span className="kitchen-order-check" aria-label="出餐">
          <Check className="kitchen-order-check-icon" />
        </span>
      )}
    </div>
  )
}

/** 離場卡：留在原槽位播動畫（出餐打勾飛出、逾時掉落淡出），尾段收寬度讓後面的單補位；浮字與卡片分開，不跟著淡出 */
function LeavingCard({ l }: { l: LeavingOrder }) {
  const float = goneFloatText(l)
  return (
    <div className={`kitchen-order-leaving kitchen-order-leaving-${l.reason}`} data-leaving={l.reason}>
      <OrderCard order={{ id: l.id, ing: l.ing, remainMs: l.remainMs }} leave={l.reason} />
      {float && <span className="kitchen-order-float">{float}</span>}
    </div>
  )
}

function PlayerCard({ p }: { p: KitchenHudPlayer }) {
  return (
    <div
      className="kitchen-player"
      style={colorVars(p.colorIndex)}
      data-kitchen-player={p.colorIndex}
      data-self={p.isSelf}
      data-held={p.held ? `${p.held.kind}-${p.held.ing}` : 'none'}
      title={p.name}
    >
      {p.isSelf && <span className="kitchen-player-you">你</span>}
      <div className="kitchen-player-avatar">
        <KitchenAvatar colorIndex={p.colorIndex} className="kitchen-player-avatar-svg" />
      </div>
      <div className="kitchen-player-info">
        <span className="kitchen-player-name">{p.isSelf ? '你' : p.name}</span>
        <span className="kitchen-player-no">{playerLabel(p.colorIndex)}</span>
      </div>
      <div className="kitchen-player-held" aria-label={p.held ? '手持物' : '空手'}>
        {p.held ? (
          <KitchenItemIcon ing={p.held.ing} kind={p.held.kind} className="kitchen-player-held-svg" />
        ) : (
          <Hand className="kitchen-player-held-empty" />
        )}
      </div>
    </div>
  )
}

interface KitchenHudViewProps {
  hud: KitchenHud
  leaving: LeavingOrder[]
  scale?: number
  recipeOpen?: boolean
  onToggleRecipe?: () => void
  rootRef?: Ref<HTMLDivElement>
}

/** 廚房 HUD 的純呈現（無副作用，可在 node 靜態渲染自查） */
export function KitchenHudView({ hud, leaving, scale = 1, recipeOpen = true, onToggleRecipe, rootRef }: KitchenHudViewProps) {
  const clock = clockView(hud.remainSec)
  return (
    <div
      ref={rootRef}
      className="kitchen-hud"
      style={{ '--kitchen-scale': scale } as CSSProperties}
      data-kitchen-hud=""
    >
      <div className="kitchen-orders">
        {orderRow(hud.orders, leaving).map((c) =>
          c.leave ? <LeavingCard key={c.key} l={c.leave} /> : <OrderCard key={c.key} order={c.order} />,
        )}
      </div>

      <div className="kitchen-clock" data-urgent={clock.urgent}>
        <AlarmClock className="kitchen-clock-icon" />
        <span className="kitchen-clock-text">{clock.text}</span>
        <span className="kitchen-clock-sep" />
        <Coins className="kitchen-clock-coins" />
        <span className="kitchen-clock-score">
          <span className="kitchen-clock-points">{hud.score}</span>
          <span className="kitchen-clock-served">出餐 {hud.delivered}</span>
        </span>
      </div>

      <div className="kitchen-players">
        {sortKitchenPlayers(hud.players).map((p) => (
          <PlayerCard key={p.id} p={p} />
        ))}
      </div>

      <div className="kitchen-recipe" data-open={recipeOpen}>
        <button
          type="button"
          className="kitchen-recipe-head"
          aria-expanded={recipeOpen}
          aria-label="食譜（R）"
          onClick={(e) => {
            // 點完交還焦點：否則空白鍵／Enter（遊戲的互動鍵）會再觸發這顆按鈕
            e.currentTarget.blur()
            onToggleRecipe?.()
          }}
        >
          <BookOpen className="kitchen-recipe-icon" />
          <span className="kitchen-recipe-title">食譜</span>
        </button>
        <ul className="kitchen-recipe-list">
          {KITCHEN_DISHES.map((d) => (
            <li key={d.ing} className="kitchen-recipe-row" data-kitchen-recipe={d.ing}>
              <span className="kitchen-recipe-dish">
                <KitchenItemIcon ing={d.ing} kind="soup" className="kitchen-recipe-dish-svg" />
              </span>
              <span className="kitchen-recipe-info">
                <span className="kitchen-recipe-name">
                  {d.name}
                  <span className="kitchen-recipe-score">+{d.score}</span>
                </span>
                <Steps ing={d.ing} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * 廚房快手的 React HUD（spec §8）：左上訂單卡、右上計時＋分數、左側玩家卡、右側食譜。
 * 以 960×540 設計尺寸排版，依容器等比縮放（--kitchen-scale）；矮畫面由 CSS 切成精簡版。
 * R 鍵收合食譜的監聽只在本元件掛載期間存在。
 */
export function KitchenHud({ hud, leaving }: { hud: KitchenHud; leaving: LeavingOrder[] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [recipeOpen, setRecipeOpen] = useState(true)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setScale(hudScale(el.clientWidth, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isRecipeToggleKey(e)) setRecipeOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <KitchenHudView
      hud={hud}
      leaving={leaving}
      scale={scale}
      recipeOpen={recipeOpen}
      onToggleRecipe={() => setRecipeOpen((v) => !v)}
      rootRef={rootRef}
    />
  )
}

export default KitchenHud
