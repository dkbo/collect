import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home, ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4">
      {/* Animated floating 404 */}
      <div className="relative">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-purple-500/20 blur-3xl rounded-full scale-150 pointer-events-none" />

        <div className="relative float-slow">
          <div className="bg-gradient-to-br from-red-500/15 to-purple-500/15 border border-red-500/20 dark:border-red-500/30 p-8 rounded-3xl shadow-xl shadow-red-950/10 dark:shadow-red-950/20 backdrop-blur-sm">
            <AlertCircle className="h-16 w-16 text-red-500 dark:text-red-400" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
          404
        </h2>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          找不到頁面
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          抱歉，您所尋找的頁面似乎並不存在，或是已經被移除了。
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all duration-200"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回上頁
        </Button>
        <Link to="/">
          <Button
            variant="default"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 rounded-xl cursor-pointer transition-all duration-200"
          >
            <Home className="mr-2 h-4 w-4" /> 返回首頁
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default NotFound
