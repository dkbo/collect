import { create } from 'zustand'
import axios from 'axios'

export interface GithubRepo {
  name: string
  full_name: string
  html_url: string
  description: string
  stargazers_count: number
  forks_count: number
  language: string
}

// Wikipedia OpenSearch format: [original_keyword, titles[], descriptions[], links[]]
export type WikiSearchResponse = [string, string[], string[], string[]]

interface SearchStore {
  // State
  wikiResults: WikiSearchResponse
  githubResults: GithubRepo[]
  isLoadingWiki: boolean
  isLoadingGithub: boolean
  errorWiki: string | null
  errorGithub: string | null

  // Actions
  searchWiki: (keyword: string) => Promise<void>
  searchGithub: (keyword: string) => Promise<void>
  clearResults: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  // Initial State
  wikiResults: ['', [], [], []],
  githubResults: [],
  isLoadingWiki: false,
  isLoadingGithub: false,
  errorWiki: null,
  errorGithub: null,

  // Actions
  searchWiki: async (keyword: string) => {
    if (!keyword.trim()) return
    set({ isLoadingWiki: true, errorWiki: null })
    try {
      const response = await axios.get<WikiSearchResponse>(
        `https://zh.wikipedia.org/w/api.php?action=opensearch&limit=10&origin=*&search=${encodeURIComponent(keyword)}`
      )
      set({ wikiResults: response.data, isLoadingWiki: false })
    } catch (err) {
      console.error('Wikipedia search error:', err)
      set({ 
        errorWiki: err instanceof Error ? err.message : 'Wikipedia search failed', 
        isLoadingWiki: false 
      })
    }
  },

  searchGithub: async (keyword: string) => {
    if (!keyword.trim()) return
    set({ isLoadingGithub: true, errorGithub: null })
    try {
      const response = await axios.get<{ items: GithubRepo[] }>(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&order=desc`
      )
      const topItems = (response.data.items || []).slice(0, 10)
      set({ githubResults: topItems, isLoadingGithub: false })
    } catch (err) {
      console.error('GitHub search error:', err)
      set({ 
        errorGithub: err instanceof Error ? err.message : 'GitHub search failed', 
        isLoadingGithub: false 
      })
    }
  },

  clearResults: () => set({
    wikiResults: ['', [], [], []],
    githubResults: [],
    errorWiki: null,
    errorGithub: null,
  }),
}))

export default useSearchStore
