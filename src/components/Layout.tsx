import { useState, useEffect, useRef, Suspense } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sun, Moon, Menu, X, ChevronDown } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'
import { IconButton, NavLink, tbCn } from '@/components/toybox'
import '@/components/Layout.css'

type NavLinkItem = { to: string; label: string; end: boolean; testId: string }
type NavEntry =
  | ({ type: 'link' } & NavLinkItem)
  | { type: 'group'; label: string; eyebrow: string; testId: string; items: NavLinkItem[] }

const NAV_ENTRIES: NavEntry[] = [
  { type: 'link', to: '/', label: '首頁', end: true, testId: 'nav-home' },
  { type: 'link', to: '/resume', label: 'E-履歷', end: false, testId: 'nav-resume' },
  {
    type: 'group',
    label: '遊戲',
    eyebrow: 'GAMES',
    testId: 'nav-games',
    items: [
      { to: '/miniGame', label: '小遊戲', end: false, testId: 'nav-minigame' },
      { to: '/rpgroom', label: '遊戲室', end: false, testId: 'nav-rpgroom' },
      { to: '/godot-game', label: 'Godot遊戲', end: false, testId: 'nav-godot-game' },
      { to: '/candy-crush', label: '糖果消消樂', end: false, testId: 'nav-candy-crush' },
      { to: '/battle', label: '多人對戰', end: false, testId: 'nav-battle' },
    ],
  },
  {
    type: 'group',
    label: '工具',
    eyebrow: 'TOOLS',
    testId: 'nav-tools',
    items: [
      { to: '/search', label: '外部查詢', end: false, testId: 'nav-search' },
      { to: '/todos', label: 'Todos', end: false, testId: 'nav-todos' },
      { to: '/directions', label: '地圖導覽', end: false, testId: 'nav-directions' },
      { to: '/map-developer', label: '地圖開發', end: false, testId: 'nav-map-developer' },
    ],
  },
]

function LoadingScreen() {
  return (
    <div className="layout-loading">
      <div className="layout-loading__screen">
        <span className="layout-loading__title">LOADING</span>
        <span className="layout-loading__sub">載入中...</span>
      </div>
    </div>
  )
}

export function Layout() {
  const { theme, toggleTheme } = useThemeStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const location = useLocation()

  // 換頁時收起下拉與手機選單：在 render 期間比對上一次的 pathname 並重設，
  // 而不是在 effect 裡 setState（react-hooks/set-state-in-effect 會多一次 cascading render）
  const [menuPath, setMenuPath] = useState(location.pathname)
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname)
    setOpenDropdown(null)
    setIsMobileMenuOpen(false)
  }

  // 下拉面板：點外面或按 Esc 收起
  useEffect(() => {
    if (!openDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openDropdown])

  useEffect(() => {
    const path = location.pathname
    let title: string
    let description: string
    let keywords: string

    if (path === '/') {
      title = "首頁 | DKBO's Collect"
      description = "DKBO's Collect - 個人作品集與技術展示。結合 React、TypeScript、Zustand、Firebase 等現代前端開發技術的精選專案彙整。"
      keywords = "React, firebase, DKBO, 前端, front End, TypeScript, Vite"
    } else if (path.startsWith('/resume')) {
      title = "E-履歷 | DKBO's Collect"
      description = "DKBO (盧宏寶) 的個人履歷。資深前端架構師，專注於 React 生態系、Vite、TypeScript 專案建置與效能優化。"
      keywords = "DKBO, 履歷, 前端工程師, React, TypeScript, 履歷表"
    } else if (path.startsWith('/miniGame')) {
      title = "小遊戲 | DKBO's Collect"
      description = "趣味休閒網頁小遊戲，展示純前端互動邏輯、鍵盤/滑鼠事件處理與 React 狀態管理。"
      keywords = "小遊戲, React遊戲, 前端遊戲, 網頁遊戲"
    } else if (path.startsWith('/rpgroom')) {
      title = "RPG 遊戲室 | DKBO's Collect"
      description = "互動式 RPG 虛擬角色遊戲室，支援地圖場景繪製、碰撞邊界、鍵盤移動控制與 NPC 對話系統。"
      keywords = "RPG, 遊戲室, 虛擬角色, 地圖繪製, Canvas"
    } else if (path.startsWith('/godot-game')) {
      title = "Godot 遊戲 | DKBO's Collect"
      description = "以 Godot 4 遊戲引擎重構的 RPG 遊戲室，透過 iframe 嵌入與 postMessage 通訊架構，整合地圖探索與 NPC 對話系統。"
      keywords = "Godot, 遊戲引擎, RPG, iframe, postMessage, WebAssembly"
    } else if (path.startsWith('/candy-crush')) {
      title = "糖果消消樂 | DKBO's Collect"
      description = "以 Godot 4 打造的 match-3 三消遊戲（Sweet Crush），8×8 盤面、6 色糖果、特殊道具與關卡制，透過 iframe 嵌入與 React HUD 整合。"
      keywords = "糖果消消樂, 三消遊戲, match-3, Godot, Sweet Crush, 網頁遊戲"
    } else if (path.startsWith('/battle')) {
      title = "多人對戰 | DKBO's Collect"
      description = "1~4 人即時多人對戰平台。Firebase 管理房間與配對，WebRTC 點對點傳輸，Babylon.js 渲染戰場，部署於 GitHub Pages。"
      keywords = "多人對戰, WebRTC, Firebase, Babylon.js, 即時遊戲, P2P, 線上對戰"
    } else if (path.startsWith('/search')) {
      title = "外部查詢 | DKBO's Collect"
      description = "整合外部 API 查詢工具，實作資料檢索、防抖（Debounce）處理與即時搜尋建議。"
      keywords = "API查詢, 資料檢索, React查詢, 搜尋引擎"
    } else if (path.startsWith('/todos')) {
      title = "待辦事項 | DKBO's Collect"
      description = "現代化的 Todo List 代辦事項管理，整合 Zustand 狀態管理、Firebase 即時資料庫與拖拽排序/篩選功能。"
      keywords = "Todo List, 待辦事項, Zustand, Firebase"
    } else if (path.startsWith('/directions')) {
      title = "地圖導覽 | DKBO's Collect"
      description = "地圖定位與路線導覽功能，結合第三方地圖 API 與地理定位技術，提供精準的地點查詢。"
      keywords = "地圖導覽, 地理定位, 路線規劃, Map"
    } else if (path.startsWith('/map-developer')) {
      title = "地圖開發工具 | DKBO's Collect"
      description = "地圖編輯與開發者工具，支援 RPG 地圖場景預覽、網格定位編輯、碰撞邊界設定與 JSON 檔案匯出。"
      keywords = "地圖開發, RPG地圖編輯器, 地圖編輯器, 開發者工具"
    } else {
      title = "404 找不到頁面 | DKBO's Collect"
      description = "找不到您要求的頁面，請使用導覽列返回首頁。"
      keywords = "React, firebase, DKBO, 前端, front End, TypeScript, Vite"
    }

    document.title = title

    // Update meta tags
    const updateMetaTag = (name: string, value: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let el = document.querySelector(selector)
      if (!el) {
        el = document.createElement('meta')
        if (isProperty) {
          el.setAttribute('property', name)
        } else {
          el.setAttribute('name', name)
        }
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    updateMetaTag('description', description)
    updateMetaTag('keywords', keywords)
    updateMetaTag('og:title', title, true)
    updateMetaTag('og:description', description, true)
    updateMetaTag('twitter:title', title)
    updateMetaTag('twitter:description', description)
  }, [location.pathname])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)
  const themeLabel = theme === 'dark' ? '切換至亮色模式' : '切換至暗色模式'
  const themeIcon = theme === 'dark' ? <Sun strokeWidth={2.5} /> : <Moon strokeWidth={2.5} />

  return (
    <div className="layout-root">
      <header className="layout-header">
        <div className="tb-container layout-header__row">
          <Link to="/" className="layout-logo" onClick={closeMobileMenu} aria-label="DKBO's Collect 首頁">
            <span className="layout-logo__box" aria-hidden="true">D</span>
            <span className="layout-logo__word hidden min-[400px]:inline">DKBO&apos;s Collect</span>
            <span className="layout-logo__word min-[400px]:hidden">DKBO</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            <nav ref={navRef} className="flex items-center gap-2" aria-label="主選單">
              {NAV_ENTRIES.map((entry) =>
                entry.type === 'link' ? (
                  <NavLink key={entry.to} to={entry.to} end={entry.end} data-testid={entry.testId}>
                    {entry.label}
                  </NavLink>
                ) : (
                  <div key={entry.label} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === entry.label ? null : entry.label)}
                      className={tbCn(
                        'tb-nav cursor-pointer',
                        entry.items.some((item) => location.pathname.startsWith(item.to)) && 'border-line bg-pop text-on-fill hover:bg-pop',
                      )}
                      aria-expanded={openDropdown === entry.label}
                      data-testid={entry.testId}
                    >
                      {entry.label}
                      <ChevronDown
                        strokeWidth={2.5}
                        aria-hidden="true"
                        className={tbCn('transition-transform duration-120 motion-reduce:transition-none', openDropdown === entry.label && 'rotate-180')}
                      />
                    </button>
                    {openDropdown === entry.label && (
                      <div className="layout-dropdown" data-testid={`${entry.testId}-dropdown`}>
                        {entry.items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className="w-full justify-start rounded-toy-md"
                            data-testid={item.testId}
                          >
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
            </nav>

            <IconButton icon={themeIcon} label={themeLabel} onClick={toggleTheme} className="ml-2" data-testid="theme-toggle" />
          </div>

          {/* Mobile Controls */}
          <div className="flex lg:hidden items-center gap-2">
            <IconButton icon={themeIcon} label={themeLabel} onClick={toggleTheme} data-testid="theme-toggle-mobile" />
            <IconButton
              icon={isMobileMenuOpen ? <X strokeWidth={2.5} /> : <Menu strokeWidth={2.5} />}
              label={isMobileMenuOpen ? '關閉選單' : '開啟選單'}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="layout-mobile-menu"
              data-testid="mobile-menu-toggle"
            />
          </div>
        </div>
      </header>

      {/* Mobile Menu：header 下方整寬面板，不加遮罩、不鎖捲動 */}
      {isMobileMenuOpen && (
        <div className="tb-container lg:hidden">
          <nav id="layout-mobile-menu" className="layout-mobile-menu" aria-label="主選單" data-testid="mobile-menu">
            {NAV_ENTRIES.map((entry) =>
              entry.type === 'link' ? (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.end}
                  className="w-full justify-start rounded-toy-md"
                  data-testid={`${entry.testId}-mobile`}
                  onClick={closeMobileMenu}
                >
                  {entry.label}
                </NavLink>
              ) : (
                <div key={entry.label} role="group" aria-label={entry.label} className="flex flex-col gap-1">
                  <p className="layout-mobile-menu__group" aria-hidden="true">{entry.eyebrow}</p>
                  {entry.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className="w-full justify-start rounded-toy-md"
                      data-testid={`${item.testId}-mobile`}
                      onClick={closeMobileMenu}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ),
            )}
          </nav>
        </div>
      )}

      <main className="relative w-full grow">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="layout-footer">© 2026 DKBO&apos;s Collect · GAME OVER? PRESS START</footer>
    </div>
  )
}

export default Layout
