import { create } from 'zustand'
import { api } from '@/lib/axios'

interface Post {
  id: number
  title: string
  body: string
}

interface AppStore {
  // State
  count: number
  posts: Post[]
  isLoading: boolean
  error: string | null

  // Actions
  increment: () => void
  decrement: () => void
  resetCount: () => void
  fetchPosts: () => Promise<void>
  clearPosts: () => void
}

export const useStore = create<AppStore>((set) => ({
  // Initial State
  count: 0,
  posts: [],
  isLoading: false,
  error: null,

  // Actions
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  resetCount: () => set({ count: 0 }),

  fetchPosts: async () => {
    set({ isLoading: true, error: null })
    try {
      // Fetching sample posts from JSONPlaceholder using our configured axios instance
      const response = await api.get<Post[]>('/posts?_limit=5')
      set({ posts: response.data, isLoading: false })
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      set({ 
        error: error.response?.data?.message || error.message || 'Failed to fetch posts', 
        isLoading: false 
      })
    }
  },

  clearPosts: () => set({ posts: [] }),
}))
