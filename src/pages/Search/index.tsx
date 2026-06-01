import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  BookOpen, 
  Star, 
  GitFork, 
  CornerDownRight, 
  Sparkles, 
  X,
  Globe,
  AlertTriangle
} from 'lucide-react'
import { useSearchStore } from '@/store/useSearchStore'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

const SUGGESTED_KEYWORDS = ['React', 'TypeScript', 'Vite', 'Tailwind', 'Zustand', 'CSS']

export function SearchApi() {
  const { keyword } = useParams<{ keyword?: string }>()
  const navigate = useNavigate()
  
  const {
    wikiResults,
    githubResults,
    isLoadingWiki,
    isLoadingGithub,
    errorWiki,
    errorGithub,
    searchWiki,
    searchGithub,
    clearResults,
  } = useSearchStore()

  const [prevKeyword, setPrevKeyword] = useState(keyword)
  const [inputValue, setInputValue] = useState(keyword || '')

  if (keyword !== prevKeyword) {
    setPrevKeyword(keyword)
    setInputValue(keyword || '')
  }


  // Debounced input updates the URL keyword
  useEffect(() => {
    const term = inputValue.trim()
    const timer = setTimeout(() => {
      if (term) {
        if (term !== keyword) {
          navigate(`/search/${encodeURIComponent(term)}`)
        }
      } else {
        if (keyword) {
          navigate('/search')
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [inputValue, keyword, navigate])

  // Fire API calls when URL keyword updates
  useEffect(() => {
    if (keyword && keyword.trim()) {
      const term = keyword.trim()
      searchWiki(term)
      searchGithub(term)
    } else {
      clearResults()
    }
  }, [keyword, searchWiki, searchGithub, clearResults])

  const handleClear = () => {
    setInputValue('')
    navigate('/search')
  }

  const handleSuggestClick = (word: string) => {
    setInputValue(word)
    navigate(`/search/${encodeURIComponent(word)}`)
  }

  const wikiTitles = wikiResults[1] || []
  const wikiTexts = wikiResults[2] || []
  const wikiLinks = wikiResults[3] || []

  const showWelcome = !keyword
  const hasGithubResults = githubResults.length > 0
  const hasWikiResults = wikiTitles.length > 0

  return (
    <div className="max-w-6xl mx-auto pb-12" data-testid="page-search">
      {/* Title Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-tight">
          外部查詢 (External Search)
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          輸入關鍵字，即可透過 API 同步檢索 GitHub 熱門開源倉庫與 Wikipedia 中文維基百科條目。
        </p>
      </header>

      {/* Search Input Box */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="relative group/search bg-card/60 backdrop-blur-md rounded-2xl p-2 border border-border shadow-lg transition-all duration-300 focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-500/50">
          <div className="flex items-center gap-2">
            <div className="pl-3 text-slate-400">
              <Search className="size-5" />
            </div>
            <input
              type="text"
              id="search-input"
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              autoComplete="off"
              placeholder="請輸入關鍵字搜尋，例如：React..."
              className="flex-1 border-0 bg-transparent py-3 px-3 text-base text-foreground placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
              data-testid="search-input-field"
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="size-9 text-slate-400 hover:text-foreground rounded-xl cursor-pointer"
                aria-label="清除搜尋字詞"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Suggestion tags */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs select-none">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Sparkles className="size-3 text-purple-400" />
            推薦探索:
          </span>
          {SUGGESTED_KEYWORDS.map((word) => (
            <button
              key={word}
              onClick={() => handleSuggestClick(word)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition-colors duration-200 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 font-medium"
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* Main Results Panel */}
      {showWelcome ? (
        /* Welcome Placeholder Screen */
        <div className="max-w-md mx-auto text-center p-8 bg-card/40 border border-border/80 rounded-2xl backdrop-blur-sm shadow-md animate-fade-in">
          <div className="bg-gradient-to-tr from-purple-500 to-indigo-500 w-12 h-12 rounded-xl shadow-lg flex items-center justify-center text-white mx-auto mb-4">
            <Globe className="size-6 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">等待搜尋中</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            請在上方搜尋欄輸入任何感興趣的單字，或是點選推薦探索的標籤。
          </p>
        </div>
      ) : (
        /* Dual column grid layout */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* GitHub List Column */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="bg-slate-900 dark:bg-slate-800 text-white p-2 rounded-xl shadow-sm">
                <GithubIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">GitHub 開源倉庫</h2>
                <p className="text-xs text-slate-500">按星數 (Stars) 排序的前 10 項專案</p>
              </div>
            </div>

            {/* GitHub Loading State */}
            {isLoadingGithub && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border border-border/60 rounded-xl bg-slate-50/20 dark:bg-slate-900/10 space-y-2 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                    <div className="flex gap-4 pt-1">
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-12" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-12" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* GitHub Error State */}
            {errorGithub && (
              <div className="p-4 border border-rose-500/20 bg-rose-500/5 text-rose-500 dark:text-rose-400 rounded-xl text-sm flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">檢索失敗：</span>
                  <span>{errorGithub} (可能是觸發了 GitHub API 每分鐘請求上限，請稍候重試)</span>
                </div>
              </div>
            )}

            {/* GitHub Result Cards */}
            {!isLoadingGithub && !errorGithub && (
              hasGithubResults ? (
                <ul className="space-y-4" data-testid="github-results-list">
                  {githubResults.map((repo) => (
                    <li 
                      key={repo.full_name}
                      className="p-4 rounded-xl border border-border/80 bg-card hover:bg-slate-50/40 dark:hover:bg-slate-900/30 shadow-sm transition-all hover:-translate-y-0.5 duration-200 group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <a 
                          href={repo.html_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-bold text-slate-800 dark:text-slate-100 hover:text-purple-500 dark:hover:text-purple-400 text-base underline-offset-4 hover:underline break-all"
                        >
                          {repo.name}
                        </a>
                        {repo.language && (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold rounded-md border border-purple-200/40">
                            {repo.language}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {repo.description || '無專案說明。'}
                      </p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 select-none">
                        <div className="flex items-center gap-1 hover:text-amber-500 transition-colors">
                          <Star className="size-3.5" />
                          <span>{repo.stargazers_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                          <GitFork className="size-3.5" />
                          <span>{repo.forks_count.toLocaleString()}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                keyword && !isLoadingGithub && (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    未找到相關的 GitHub 開源倉庫專案。
                  </div>
                )
              )
            )}
          </div>

          {/* Wikipedia List Column */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-xl shadow-sm border border-border/40">
                <BookOpen className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">維基百科條目</h2>
                <p className="text-xs text-slate-500">Wikipedia 中文百科前 10 項開放資料</p>
              </div>
            </div>

            {/* Wikipedia Loading State */}
            {isLoadingWiki && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border border-border/60 rounded-xl bg-slate-50/20 dark:bg-slate-900/10 space-y-2 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {/* Wikipedia Error State */}
            {errorWiki && (
              <div className="p-4 border border-rose-500/20 bg-rose-500/5 text-rose-500 dark:text-rose-400 rounded-xl text-sm flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">檢索失敗：</span>
                  <span>{errorWiki}</span>
                </div>
              </div>
            )}

            {/* Wikipedia Result Cards */}
            {!isLoadingWiki && !errorWiki && (
              hasWikiResults ? (
                <ul className="space-y-4" data-testid="wiki-results-list">
                  {wikiTitles.map((title, i) => (
                    <li 
                      key={title}
                      className="p-4 rounded-xl border border-border/80 bg-card hover:bg-slate-50/40 dark:hover:bg-slate-900/30 shadow-sm transition-all hover:-translate-y-0.5 duration-200 group"
                    >
                      <div className="flex items-start gap-2">
                        <CornerDownRight className="size-4 text-purple-500 mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        <div className="space-y-1.5 flex-1">
                          <a 
                            href={wikiLinks[i]} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-bold text-slate-800 dark:text-slate-100 hover:text-purple-500 dark:hover:text-purple-400 text-base underline-offset-4 hover:underline"
                          >
                            {title}
                          </a>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {wikiTexts[i] || '無摘要說明。'}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                keyword && !isLoadingWiki && (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    未找到相關的維基百科中文條目。
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchApi
