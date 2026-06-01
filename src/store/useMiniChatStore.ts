import { create } from 'zustand'
import { useChatStore } from './useChatStore'

interface MiniChatStore {
  /** 聊天窗口是否展開 */
  isShow: boolean
  /** 未讀訊息數 */
  count: number
  
  /** 切換聊天窗口狀態 */
  toggleMinichat: () => void
  /** 重設計數 */
  resetCount: () => void
  /** 增加計數 */
  incrementCount: () => void
}

export const useMiniChatStore = create<MiniChatStore>((set, get) => {
  // 記錄上一次的訊息長度，用以計算未讀數
  let prevMessagesLength = 0

  // 訂閱 useChatStore 訊息列表的變化
  useChatStore.subscribe((state) => {
    const currentLength = state.messages.length
    
    // 如果窗口關閉，且有新的訊息進來，則增加未讀計數
    if (!get().isShow && currentLength > prevMessagesLength && prevMessagesLength > 0) {
      set({ count: get().count + (currentLength - prevMessagesLength) })
    }
    
    prevMessagesLength = currentLength
  })

  return {
    isShow: false,
    count: 0,

    toggleMinichat: () => {
      const nextIsShow = !get().isShow
      set({
        isShow: nextIsShow,
        count: nextIsShow ? 0 : get().count,
      })
    },

    resetCount: () => set({ count: 0 }),
    incrementCount: () => set((state) => ({ count: state.count + 1 })),
  }
})

export default useMiniChatStore
