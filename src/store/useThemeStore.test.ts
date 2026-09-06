import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useThemeStore } from './useThemeStore'

const initialState = useThemeStore.getState()

// jsdom 未實作 matchMedia，用假的替換整個屬性（非 vi.spyOn，因為原本不存在函式可 spy）
const mockMatchMedia = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList)
}

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
    useThemeStore.setState(initialState, true)
  })

  it('setTheme("dark") adds the dark class, sets colorScheme, and persists to localStorage', () => {
    useThemeStore.getState().setTheme('dark')

    expect(useThemeStore.getState().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('setTheme("light") removes the dark class and sets colorScheme to light', () => {
    document.documentElement.classList.add('dark')
    useThemeStore.getState().setTheme('light')

    expect(useThemeStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('toggleTheme flips between dark and light', () => {
    useThemeStore.getState().setTheme('dark')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('initializeTheme uses the saved theme from localStorage when present', () => {
    localStorage.setItem('theme', 'light')
    mockMatchMedia(true) // 若誤讀系統偏好會得到 dark，用來驗證確實優先讀 localStorage

    useThemeStore.getState().initializeTheme()

    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('initializeTheme falls back to system preference when nothing is saved', () => {
    mockMatchMedia(true)

    useThemeStore.getState().initializeTheme()

    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('initializeTheme falls back to light when system prefers light and nothing is saved', () => {
    mockMatchMedia(false)

    useThemeStore.getState().initializeTheme()

    expect(useThemeStore.getState().theme).toBe('light')
  })
})
