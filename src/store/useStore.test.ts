import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/lib/axios'
import { useStore } from './useStore'

vi.mock('@/lib/axios', () => ({ api: { get: vi.fn() } }))

const initialState = useStore.getState()

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState(initialState, true)
  })

  it('increment/decrement adjust count relative to its current value', () => {
    useStore.getState().increment()
    useStore.getState().increment()
    useStore.getState().decrement()
    expect(useStore.getState().count).toBe(1)
  })

  it('resetCount sets count back to 0', () => {
    useStore.setState({ count: 42 })
    useStore.getState().resetCount()
    expect(useStore.getState().count).toBe(0)
  })

  describe('fetchPosts', () => {
    it('sets isLoading while pending, then stores posts on success', async () => {
      const posts = [{ id: 1, title: 't', body: 'b' }]
      let resolveGet!: (v: { data: typeof posts }) => void
      vi.mocked(api.get).mockReturnValue(new Promise((resolve) => { resolveGet = resolve }))

      const promise = useStore.getState().fetchPosts()
      expect(useStore.getState().isLoading).toBe(true)

      resolveGet({ data: posts })
      await promise

      expect(useStore.getState()).toMatchObject({ posts, isLoading: false, error: null })
    })

    it('prefers the API response error message when available', async () => {
      vi.mocked(api.get).mockRejectedValue({ response: { data: { message: 'server exploded' } } })

      await useStore.getState().fetchPosts()

      expect(useStore.getState()).toMatchObject({ isLoading: false, error: 'server exploded' })
    })

    it('falls back to a generic message when the error has no response payload', async () => {
      vi.mocked(api.get).mockRejectedValue({})

      await useStore.getState().fetchPosts()

      expect(useStore.getState()).toMatchObject({ isLoading: false, error: 'Failed to fetch posts' })
    })
  })

  it('clearPosts empties the posts list', () => {
    useStore.setState({ posts: [{ id: 1, title: 't', body: 'b' }] })
    useStore.getState().clearPosts()
    expect(useStore.getState().posts).toEqual([])
  })
})
