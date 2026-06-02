import { useState, useEffect, useCallback, Suspense } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Code2, Sun, Moon, Menu, X } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { to: '/', label: '首頁', end: true, testId: 'nav-home' },
  { to: '/resume', label: 'E-履歷', end: false, testId: 'nav-resume' },
  { to: '/miniGame', label: '小遊戲', end: false, testId: 'nav-minigame' },
  { to: '/rpgroom', label: '遊戲室', end: false, testId: 'nav-rpgroom' },
  { to: '/search', label: '外部查詢', end: false, testId: 'nav-search' },
  { to: '/todos', label: '代辦事項', end: false, testId: 'nav-todos' },
  { to: '/directions', label: '地圖導覽', end: false, testId: 'nav-directions' },
  { to: '/chat', label: '多人聊天', end: false, testId: 'nav-chat' },
  { to: '/map-developer', label: '地圖開發', end: false, testId: 'nav-map-developer' },
] as const

export function Layout() {
  const { theme, toggleTheme } = useThemeStore()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 20)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Close mobile menu on route change by listening to clicks
  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-purple-500 selection:text-white flex flex-col justify-between transition-colors duration-300 relative overflow-x-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-purple-500/5 via-indigo-500/5 to-transparent dark:from-purple-900/10 dark:via-indigo-950/10 pointer-events-none transition-all duration-300" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[120px] pointer-events-none transition-all duration-300" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] pointer-events-none transition-all duration-300" />

      <div className="w-full relative z-10">
        {/* Floating Header */}
        <header
          className={`floating-header ${isScrolled ? 'is-scrolled' : ''}`}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-3 group cursor-pointer" onClick={closeMobileMenu}>
              <div className="bg-gradient-to-tr from-purple-500 to-indigo-500 p-2 rounded-xl shadow-lg shadow-purple-500/20 transition-transform duration-300 group-hover:scale-105">
                <Code2 className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent transition-all duration-300 m-0 leading-normal">
                DKBO&apos;s Collect
              </h1>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <nav className="flex items-center gap-0.5 text-sm font-medium">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `nav-link-pill ${isActive ? 'active' : 'inactive'}`
                    }
                    data-testid={item.testId}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2" />

              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl border-border bg-background hover:bg-muted text-foreground transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center"
                aria-label={theme === 'dark' ? '切換至亮色模式' : '切換至暗色模式'}
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400 fill-amber-400 transition-transform duration-300 hover:rotate-12" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600 fill-indigo-600 transition-transform duration-300 hover:-rotate-12" />
                )}
              </Button>
            </div>

            {/* Mobile Controls */}
            <div className="flex lg:hidden items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl border-border bg-background hover:bg-muted text-foreground transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center"
                aria-label={theme === 'dark' ? '切換至亮色模式' : '切換至暗色模式'}
                data-testid="theme-toggle-mobile"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400 fill-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600 fill-indigo-600" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-9 h-9 rounded-xl border-border bg-background hover:bg-muted text-foreground transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center"
                aria-label={isMobileMenuOpen ? '關閉選單' : '開啟選單'}
                data-testid="mobile-menu-toggle"
              >
                {isMobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <>
            <div
              className="mobile-menu-overlay"
              onClick={closeMobileMenu}
              aria-hidden="true"
            />
            <nav className="mobile-menu-panel" data-testid="mobile-menu">
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                      }`
                    }
                    data-testid={`${item.testId}-mobile`}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          </>
        )}

        {/* Spacer for floating header */}
        <div className="h-40" />

        <main className="relative max-w-6xl mx-auto px-4 pt-6">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">載入中...</p>
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Footer */}
      <footer className="relative max-w-6xl mx-auto px-4 py-8 text-center w-full mt-16 transition-colors duration-300">
        <div className="section-divider mb-6" />
        <p className="text-xs text-slate-500 dark:text-slate-500">
          © 2026 DKBO&apos;s Collect.
        </p>
      </footer>
    </div>
  )
}

export default Layout
