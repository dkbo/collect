import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  RefreshCw, 
  Trash2, 
  Globe, 
  Database, 
  Cpu 
} from 'lucide-react'

export function Dashboard() {
  const { 
    count, 
    posts, 
    isLoading, 
    error, 
    increment, 
    decrement, 
    resetCount, 
    fetchPosts, 
    clearPosts 
  } = useStore()

  // Fetch initial posts on load
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Core Configurations Overview Card */}
      <section className="md:col-span-3 bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Cpu className="text-purple-400 h-5 w-5" />
          已配置的套件與架構 (Installed Packages)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/30 border border-slate-800 hover:border-purple-500/30 p-4 rounded-xl transition duration-300">
            <div className="text-purple-400 font-bold mb-1">Tailwind CSS v4</div>
            <p className="text-xs text-slate-400">基於 Vite 插件的最新 CSS-first 編譯，支援 CSS 變數主題設定。</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 hover:border-indigo-500/30 p-4 rounded-xl transition duration-300">
            <div className="text-indigo-400 font-bold mb-1">shadcn/ui (Radix)</div>
            <p className="text-xs text-slate-400">已配置組件庫，包含路徑別名映射與 <code className="text-slate-300">Button</code> 示範組件。</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 hover:border-pink-500/30 p-4 rounded-xl transition duration-300">
            <div className="text-pink-400 font-bold mb-1">Zustand 5</div>
            <p className="text-xs text-slate-400">極簡且直覺的 React 狀態管理庫，支援非同步 API 資料存取狀態。</p>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 hover:border-emerald-500/30 p-4 rounded-xl transition duration-300">
            <div className="text-emerald-400 font-bold mb-1">Axios</div>
            <p className="text-xs text-slate-400">已封裝請求實例 (<code className="text-slate-300">src/lib/axios.ts</code>)，並配置通用攔截器。</p>
          </div>
        </div>
      </section>

      {/* Zustand & Shadcn Demo Card */}
      <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <Database className="text-pink-400 h-5 w-5" />
            Zustand 狀態管理
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            此計數器狀態由全域 Zustand Store 管理，點擊按鈕即時變更全域狀態。
          </p>
          
          {/* Display Area */}
          <div className="flex flex-col items-center justify-center bg-slate-950/80 border border-slate-800/80 rounded-xl p-8 mb-6">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Counter Value</span>
            <span className="text-5xl font-extrabold text-white mt-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent animate-fade-in">
              {count}
            </span>
          </div>
        </div>

        {/* Action Buttons using shadcn Button components */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={decrement}
              className="w-full flex items-center justify-center gap-1.5 border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white"
            >
              <Minus className="h-4 w-4" /> 減少 (Dec)
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={increment}
              className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/20"
            >
              <Plus className="h-4 w-4" /> 增加 (Inc)
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetCount}
            className="w-full flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 重設計數器
          </Button>
        </div>
      </section>

      {/* Axios API Loading Demo Card */}
      <section className="md:col-span-2 bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Globe className="text-emerald-400 h-5 w-5" />
              Axios 非同步請求示範
            </h2>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="xs" 
                onClick={clearPosts} 
                disabled={posts.length === 0}
                className="border-slate-800 text-slate-400 hover:text-slate-200"
              >
                <Trash2 className="h-3 w-3 mr-1" /> 清除
              </Button>
              <Button 
                variant="default" 
                size="xs" 
                onClick={fetchPosts} 
                disabled={isLoading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> 重新整理
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            使用封裝的 Axios 實例發送請求至 JSONPlaceholder 獲取 JSON 資料，並更新 Zustand Store。
          </p>

          {/* Loading / Error States */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-500 mb-2" />
              <span className="text-sm">正在載入 API 資料...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl mb-4">
              錯誤：{error}
            </div>
          )}

          {/* Posts List */}
          {!isLoading && !error && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-800 rounded-xl">
                  <p className="text-sm text-slate-500">尚無資料，請點擊「重新整理」載入</p>
                </div>
              ) : (
                posts.map((post) => (
                  <article 
                      key={post.id} 
                      className="group bg-slate-950/50 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 p-4 rounded-xl transition duration-300"
                    >
                    <h3 className="text-sm font-semibold text-slate-200 group-hover:text-purple-400 transition-colors line-clamp-1">
                      #{post.id} - {post.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {post.body}
                    </p>
                  </article>
                ))
              )}
            </div>
          )}
        </div>
        
        <div className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-4 mt-6">
          API 來源：<span className="font-mono">https://jsonplaceholder.typicode.com/posts</span>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
