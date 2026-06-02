import { useState, useEffect, useRef } from 'react'
import { Send, Eraser, MessageCircle, LogIn, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'
import { useMiniChatStore } from '@/store/useMiniChatStore'
import { ref, set } from 'firebase/database'
import { db } from '@/lib/firebase'

interface MiniChatProps {
  style?: React.CSSProperties
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/**
 * 上傳目前使用者的 GPS 地理位置到 Firebase 資料庫中，用以在地圖上繪製標記
 */
const uploadUserLocation = (uid: string, user: { displayName: string | null; photoURL: string | null }, message: string) => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        set(ref(db, `geolocation/${uid}`), {
          uid,
          displayName: user.displayName || '匿名',
          photoURL: user.photoURL || '',
          message,
          timestamp: Date.now(),
          lat: latitude,
          lng: longitude,
        })
      },
      (error) => {
        console.warn('Geolocation error:', error)
      }
    )
  }
}

export function MiniChat({ style }: MiniChatProps) {
  const { isShow, count, toggleMinichat } = useMiniChatStore()
  const { isLogin, user, loading: authLoading, subscribe: subscribeAuth, loginWithGoogle } = useAuthStore()
  const { messages, loading: chatLoading, subscribe: subscribeChat, sendMessage, clearMessages } = useChatStore()
  const [inputMsg, setInputMsg] = useState('')
  const messageBlockRef = useRef<HTMLDivElement>(null)

  // 訂閱 Auth 狀態
  useEffect(() => {
    const unsubscribe = subscribeAuth()
    return unsubscribe
  }, [subscribeAuth])

  // 訂閱聊天訊息
  useEffect(() => {
    const unsubscribe = subscribeChat()
    return unsubscribe
  }, [subscribeChat])

  // 新訊息自動滾動到底部
  useEffect(() => {
    if (messageBlockRef.current) {
      messageBlockRef.current.scrollTop = messageBlockRef.current.scrollHeight
    }
  }, [messages, isShow])

  const handleSend = () => {
    if (inputMsg.trim() && isLogin && user) {
      sendMessage(inputMsg, user)
      uploadUserLocation(user.uid, user, inputMsg.trim())
      setInputMsg('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      id="miniChat"
      style={style}
      className={`fixed bottom-0 left-0 w-full sm:w-[400px] transition-all duration-300 z-50 px-4 sm:px-0 sm:pl-4 pb-4 ${
        isShow ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'
      }`}
    >
      <div id="miniChatBox" className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[400px]">
        {/* Chat Header */}
        <button
          className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-850 text-white font-semibold flex items-center justify-between px-4 cursor-pointer hover:from-purple-500 hover:to-indigo-500 transition-all duration-200"
          onClick={toggleMinichat}
          aria-label="Toggle chat window"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4.5 w-4.5 animate-pulse" />
            <span>多人聊天窗口</span>
          </div>
          {!isShow && count > 0 && (
            <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full animate-bounce">
              {count}
            </span>
          )}
        </button>

        {/* Chat Message Box */}
        <div
          ref={messageBlockRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-purple-500/30"
        >
          {chatLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
              <span className="text-[11px] text-slate-400">載入訊息中...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-10">
              暫無留言
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = user?.uid === msg.uid
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 items-end ${isSelf ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  {msg.photoURL ? (
                    <img
                      src={msg.photoURL}
                      alt={msg.displayName}
                      className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                      {msg.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[72%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-0.5 px-0.5">
                      {msg.displayName}
                    </span>
                    {msg.type === 'youtube' ? (
                      <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800 aspect-video w-48 sm:w-56">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${msg.message}`}
                          frameBorder="0"
                          allowFullScreen
                          title="YouTube video"
                        />
                      </div>
                    ) : (
                      <div
                        className={`text-xs px-3 py-2 rounded-xl shadow-sm break-words leading-relaxed ${
                          isSelf
                            ? 'bg-purple-600 text-white rounded-br-none'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 rounded-bl-none border border-slate-200/50 dark:border-slate-700/50'
                        }`}
                      >
                        {msg.message}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input Bar or Login Action */}
        {authLoading ? (
          <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          </div>
        ) : isLogin ? (
          <div className="border-t border-slate-200 dark:border-slate-800 p-2 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-1.5">
            <input
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-purple-500/50 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
              type="text"
              value={inputMsg}
              placeholder="輸入留言...（支援 YouTube 連結）"
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="minichat-input"
            />
            <button
              onClick={handleSend}
              className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all duration-200 cursor-pointer shadow-sm shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="發送"
              disabled={!inputMsg.trim()}
              data-testid="minichat-send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={clearMessages}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-all duration-200 cursor-pointer"
              title="清除"
              data-testid="minichat-clear"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <LogIn className="h-3.5 w-3.5" />
              <span>登入後即可即時發言</span>
            </div>
            <button
              onClick={loginWithGoogle}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-sm shadow-purple-500/10"
              data-testid="minichat-login-google"
            >
              <GoogleIcon className="h-3.5 w-3.5" />
              <span>Google 登入</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MiniChat
