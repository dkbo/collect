import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  initializeTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark', // default theme

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(nextTheme)
  },

  setTheme: (theme: Theme) => {
    localStorage.setItem('theme', theme)
    
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
    
    set({ theme })
  },

  initializeTheme: () => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      get().setTheme(savedTheme)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      get().setTheme(prefersDark ? 'dark' : 'light')
    }
  }
}))
