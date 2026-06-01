import { create } from 'zustand'
import {
  ref,
  push,
  onValue,
  off,
  serverTimestamp,
  query,
  limitToLast,
  remove,
} from 'firebase/database'
import { db } from '@/lib/firebase'

export interface ChatMessage {
  id: string
  uid: string
  displayName: string
  photoURL: string
  message: string
  timestamp: number
  type?: 'youtube' | string
}

interface ChatState {
  /** 訊息列表 */
  messages: ChatMessage[]
  /** 是否載入中 */
  loading: boolean
  /** 線上人數 */
  onlineCount: number

  /** 訂閱 Firebase messages，回傳取消訂閱函數 */
  subscribe: () => () => void
  /** 發送文字訊息 */
  sendMessage: (text: string, user: { uid: string; displayName: string | null; photoURL: string | null }) => void
  /** 清除全部訊息 */
  clearMessages: () => void
}

const YOUTUBE_REGEX = /(?:[?&]v=|\/embed\/|\/1\/|\/v\/|https:\/\/(?:www\.)?youtu\.be\/)([^&\n?#]+)/
const messagesRef = ref(db, 'messages')
const messagesQuery = query(messagesRef, limitToLast(100))
const membersRef = ref(db, 'members')

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: true,
  onlineCount: 0,

  subscribe: () => {
    // 訂閱聊天訊息
    const messagesListener = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val()
      const list: ChatMessage[] = data
        ? Object.entries(data)
            .map(([id, val]) => {
              const v = val as Record<string, unknown>
              return {
                id,
                uid: (v.uid as string) || '',
                displayName: (v.displayName as string) || '匿名',
                photoURL: (v.photoURL as string) || '',
                message: (v.message as string) || '',
                timestamp: (v.timestamp as number) || 0,
                type: v.type as string | undefined,
              }
            })
            .sort((a, b) => a.timestamp - b.timestamp)
        : []
      set({ messages: list, loading: false })
    })

    // 訂閱線上人數
    const membersListener = onValue(membersRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        set({ onlineCount: 0 })
        return
      }
      const count = Object.values(data).filter(
        (m) => (m as Record<string, unknown>).onlineState === true
      ).length
      set({ onlineCount: count })
    })

    return () => {
      off(messagesQuery, 'value', messagesListener)
      off(membersRef, 'value', membersListener)
    }
  },

  sendMessage: (text, user) => {
    if (!text.trim()) return

    const youtubeMatch = text.match(YOUTUBE_REGEX)

    const payload: Record<string, unknown> = youtubeMatch
      ? {
          uid: user.uid,
          displayName: user.displayName || '匿名',
          photoURL: user.photoURL || '',
          message: youtubeMatch[1],
          type: 'youtube',
          timestamp: serverTimestamp(),
        }
      : {
          uid: user.uid,
          displayName: user.displayName || '匿名',
          photoURL: user.photoURL || '',
          message: text.trim(),
          timestamp: serverTimestamp(),
        }

    push(messagesRef, payload)
  },

  clearMessages: () => {
    remove(messagesRef)
  },
}))

export default useChatStore
