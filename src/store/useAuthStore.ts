import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
  type User,
} from 'firebase/auth'
import { ref, set, onDisconnect } from 'firebase/database'
import { auth, db } from '@/lib/firebase'

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthState {
  /** 目前是否已登入 */
  isLogin: boolean
  /** 登入的使用者資訊 */
  user: AuthUser | null
  /** 初始化載入狀態 */
  loading: boolean
  /** 錯誤訊息 */
  error: string | null

  /** 訂閱 Firebase Auth 狀態變化，回傳取消訂閱函數 */
  subscribe: () => () => void
  /** Google 登入 */
  loginWithGoogle: () => Promise<void>
  /** GitHub 登入 */
  loginWithGithub: () => Promise<void>
  /** 登出 */
  logout: () => Promise<void>
}

/**
 * 將 Firebase User 序列化為可存放在 store 中的純物件
 */
function serializeUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
}

/**
 * 將使用者標記為線上，並設定斷線時自動切回離線
 */
function setOnlinePresence(user: AuthUser) {
  const memberRef = ref(db, `members/${user.uid}`)
  const onlineRef = ref(db, `members/${user.uid}/onlineState`)
  set(memberRef, {
    displayName: user.displayName,
    photoURL: user.photoURL,
    onlineState: true,
  })
  onDisconnect(onlineRef).set(false)
}

export const useAuthStore = create<AuthState>((set) => ({
  isLogin: false,
  user: null,
  loading: true,
  error: null,

  subscribe: () => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const user = serializeUser(firebaseUser)
        set({ isLogin: true, user, loading: false, error: null })
        setOnlinePresence(user)
      } else {
        set({ isLogin: false, user: null, loading: false, error: null })
      }
    })
    return unsubscribe
  },

  loginWithGoogle: async () => {
    set({ error: null })
    try {
      const provider = new GoogleAuthProvider()
      provider.addScope('profile')
      const result = await signInWithPopup(auth, provider)
      const user = serializeUser(result.user)
      setOnlinePresence(user)
    } catch (err) {
      const message = err instanceof Error ? err.message : '登入失敗'
      set({ error: message })
    }
  },

  loginWithGithub: async () => {
    set({ error: null })
    try {
      const provider = new GithubAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = serializeUser(result.user)
      setOnlinePresence(user)
    } catch (err) {
      const message = err instanceof Error ? err.message : '登入失敗'
      set({ error: message })
    }
  },

  logout: async () => {
    try {
      await signOut(auth)
      set({ isLogin: false, user: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : '登出失敗'
      set({ error: message })
    }
  },
}))

export default useAuthStore
