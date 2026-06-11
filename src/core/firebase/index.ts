/**
 * Firebase 控制平面：app 初始化 + 匿名登入 + Firestore client。
 *
 * 設定來自 VITE_FIREBASE_*（見 .env.example）。公開 Web App config 非機密，
 * 安全靠 Firestore Security Rules（見專案根 firestore.rules）。
 * 設定缺失時 isFirebaseConfigured=false，App 不會崩潰，由 UI 顯示提示。
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from 'firebase/auth'
import { initializeFirestore, type Firestore } from 'firebase/firestore'

/** Firestore 資料庫 ID；留空連預設 (default)，填值則連具名資料庫（見 .env.example） */
const FIRESTORE_DB_ID = import.meta.env.VITE_FIREBASE_FIRESTORE_DB?.trim()

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** 是否已提供必要設定（缺則停用連線功能而非整站崩潰） */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

const init = () => {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase 未設定：請於 .env.local 填入 VITE_FIREBASE_*（見 .env.example）')
  }
  if (!app) {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    // experimentalAutoDetectLongPolling：在串流不通的網路/代理環境（含 headless 瀏覽器）
    // 自動退回 long-polling，避免 WebChannel 卡住；對一般瀏覽器無副作用。
    // 自動偵測仍失敗的環境（如 WSL2 headless e2e）可設 VITE_FIREBASE_FORCE_LONG_POLLING=1 強制。
    const settings =
      import.meta.env.VITE_FIREBASE_FORCE_LONG_POLLING === '1'
        ? { experimentalForceLongPolling: true }
        : { experimentalAutoDetectLongPolling: true }
    db = FIRESTORE_DB_ID
      ? initializeFirestore(app, settings, FIRESTORE_DB_ID)
      : initializeFirestore(app, settings)
  }
}

/** 取得 Firestore（必要時惰性初始化） */
export const getDb = (): Firestore => {
  init()
  return db!
}

/**
 * 確保已匿名登入，回傳 uid（即 playerId）。
 * 已登入則直接回傳現有 uid，否則匿名登入後回傳。
 */
export const ensureAuth = (): Promise<string> => {
  init()
  const a = auth!
  if (a.currentUser) return Promise.resolve(a.currentUser.uid)
  return new Promise<string>((resolve, reject) => {
    const unsub = onAuthStateChanged(a, (user) => {
      if (user) {
        unsub()
        resolve(user.uid)
      }
    })
    signInAnonymously(a).catch((err) => {
      unsub()
      reject(err)
    })
  })
}
