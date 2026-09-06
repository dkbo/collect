import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { useSearchStore, type GithubRepo, type WikiSearchResponse } from './useSearchStore'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))

const initialState = useSearchStore.getState()

const makeRepo = (name: string): GithubRepo => ({
  name, full_name: name, html_url: `https://x/${name}`, description: '', stargazers_count: 0, forks_count: 0, language: 'TS',
})

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState(initialState, true)
  })

  describe('searchWiki', () => {
    it('sets isLoadingWiki while pending, then stores the response on success', async () => {
      const data: WikiSearchResponse = ['cat', ['Cat'], ['desc'], ['url']]
      let resolveGet!: (v: { data: WikiSearchResponse }) => void
      vi.mocked(axios.get).mockReturnValue(new Promise((resolve) => { resolveGet = resolve }))

      const promise = useSearchStore.getState().searchWiki('cat')
      expect(useSearchStore.getState().isLoadingWiki).toBe(true)

      resolveGet({ data })
      await promise

      expect(useSearchStore.getState()).toMatchObject({ wikiResults: data, isLoadingWiki: false, errorWiki: null })
      expect(vi.mocked(axios.get).mock.calls[0][0]).toContain('search=cat')
    })

    it('sets errorWiki and clears loading on failure', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('network down'))

      await useSearchStore.getState().searchWiki('cat')

      expect(useSearchStore.getState()).toMatchObject({ isLoadingWiki: false, errorWiki: 'network down' })
    })

    it('ignores a blank keyword without calling the API', async () => {
      await useSearchStore.getState().searchWiki('   ')
      expect(axios.get).not.toHaveBeenCalled()
      expect(useSearchStore.getState().isLoadingWiki).toBe(false)
    })
  })

  describe('searchGithub', () => {
    it('keeps only the top 10 results on success', async () => {
      const items = Array.from({ length: 15 }, (_, i) => makeRepo(`repo${i}`))
      vi.mocked(axios.get).mockResolvedValue({ data: { items } })

      await useSearchStore.getState().searchGithub('react')

      expect(useSearchStore.getState().githubResults).toHaveLength(10)
      expect(useSearchStore.getState().isLoadingGithub).toBe(false)
    })

    it('sets errorGithub on failure', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('rate limited'))

      await useSearchStore.getState().searchGithub('react')

      expect(useSearchStore.getState()).toMatchObject({ isLoadingGithub: false, errorGithub: 'rate limited' })
    })

    it('ignores a blank keyword without calling the API', async () => {
      await useSearchStore.getState().searchGithub('')
      expect(axios.get).not.toHaveBeenCalled()
    })
  })

  it('clearResults resets both result sets and error state', () => {
    useSearchStore.setState({
      wikiResults: ['x', ['a'], ['b'], ['c']],
      githubResults: [makeRepo('r')],
      errorWiki: 'e1',
      errorGithub: 'e2',
    })

    useSearchStore.getState().clearResults()

    expect(useSearchStore.getState()).toMatchObject({
      wikiResults: ['', [], [], []], githubResults: [], errorWiki: null, errorGithub: null,
    })
  })
})
