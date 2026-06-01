import { useState, useEffect, useRef } from 'react'
import { Send, Eraser, MessageSquareCode, LogIn, LogOut, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'
import { Button } from '@/components/ui/button'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  )
}

export function ChatPage() {
  const { isLogin, user, loading: authLoading, error: authError, subscribe: subscribeAuth, loginWithGoogle, loginWithGithub, logout } = useAuthStore()
  const { messages, loading: chatLoading, onlineCount, subscribe: subscribeChat, sendMessage, clearMessages } = useChatStore()
  const [inputMsg, setInputMsg] = useState('')
  const messageBlockRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // 新訊息自動捲到底部
  useEffect(() => {
    if (messageBlockRef.current) {
      messageBlockRef.current.scrollTop = messageBlockRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (inputMsg.trim() && isLogin && user) {
      sendMessage(inputMsg, user)
      setInputMsg('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: number) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div id="chat" className="chat-container">
      <div id="chatBox" className="chat-box">
        {/* Chat Header */}
        <div className="chat-header">
          <h1 className="chat-title">
            <MessageSquareCode className="h-5 w-5 text-indigo-200 animate-pulse" />
            <span>多人聊天室</span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-white/20 text-indigo-100 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount} 位成員在線
            </span>

            {/* Auth 按鈕 */}
            {authLoading ? (
              <Loader2 className="h-4 w-4 text-white/60 animate-spin" />
            ) : isLogin ? (
              <div className="flex items-center gap-2">
                {user?.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || '使用者'}
                    className="w-7 h-7 rounded-full border-2 border-white/30 shadow-sm"
                  />
                )}
                <span className="text-xs text-white/80 font-medium hidden sm:inline max-w-[100px] truncate">
                  {user?.displayName || user?.email}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors duration-200"
                  title="登出"
                  data-testid="chat-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Message block */}
        <div
          ref={messageBlockRef}
          id="messageBlock"
          className="chat-messages space-y-5"
        >
          {chatLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
              <span className="text-sm text-slate-400 dark:text-slate-500">
                載入訊息中...
              </span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <MessageSquareCode className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              <span className="text-sm text-slate-400 dark:text-slate-500">
                尚無訊息，成為第一位留言者吧！
              </span>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = user?.uid === msg.uid
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 items-end ${isSelf ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className="shrink-0">
                    {msg.photoURL ? (
                      <img
                        src={msg.photoURL}
                        alt={msg.displayName}
                        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {msg.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Message details */}
                  <div className={`max-w-[75%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 px-1 ${isSelf ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        {msg.displayName}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>

                    {msg.type === 'youtube' ? (
                      <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 aspect-video w-64 sm:w-80">
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
                        className={`text-sm px-4 py-2.5 rounded-2xl shadow-sm break-words leading-relaxed ${
                          isSelf
                            ? 'bg-purple-600 text-white rounded-br-md'
                            : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-bl-md border border-slate-200/60 dark:border-slate-700/50'
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

        {/* Auth Error Toast */}
        {authError && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600 dark:text-red-400">
            {authError}
          </div>
        )}

        {/* Input Bar or Login Prompt */}
        {isLogin ? (
          <div className="chat-input-bar">
            <input
              ref={inputRef}
              className="chat-input-field shadow-inner"
              type="text"
              value={inputMsg}
              placeholder="輸入訊息...（支援 YouTube 連結）"
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="chat-input"
            />
            <button
              onClick={handleSend}
              className="chat-btn-send h-12 w-12"
              title="發送"
              disabled={!inputMsg.trim()}
              data-testid="chat-send"
            >
              <Send className="h-5 w-5" />
            </button>
            <button
              onClick={clearMessages}
              className="chat-btn-clear h-12 w-12"
              title="清除全部"
              data-testid="chat-clear"
            >
              <Eraser className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="chat-login-bar">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <LogIn className="h-4 w-4" />
              <span>登入後即可留言</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={loginWithGoogle}
                className="chat-login-btn cursor-pointer"
                data-testid="chat-login-google"
              >
                <GoogleIcon className="h-4 w-4" />
                <span>Google 登入</span>
              </Button>
              <Button
                onClick={loginWithGithub}
                variant="outline"
                className="chat-login-btn-outline cursor-pointer"
                data-testid="chat-login-github"
              >
                <GithubIcon className="h-4 w-4" />
                <span>GitHub</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatPage
