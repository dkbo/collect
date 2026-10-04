import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, BookOpen, Star, GitFork, X, Globe, AlertTriangle } from 'lucide-react'
import { IconBox, IconButton, Tag } from '@/components/toybox'
import { useSearchStore } from '@/store/useSearchStore'
import '@/pages/Search/Search.css'

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
    <div className="tb-container search-page" data-testid="page-search">
      <header className="tb-sechead">
        <div className="tb-sechead__text">
          <span className="tb-sechead__eyebrow">— SEARCH —</span>
          <h1 className="tb-sechead__title">外部查詢 (External Search)</h1>
          <p className="search-lead">輸入關鍵字，即可透過 API 同步檢索 GitHub 熱門開源倉庫與 Wikipedia 中文維基百科條目。</p>
        </div>
      </header>

      {/* Search Input Box */}
      <div className="search-box">
        <div className="search-field">
          <Search className="search-field__icon" strokeWidth={2.5} aria-hidden="true" />
          <input
            type="text"
            id="search-input"
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            autoComplete="off"
            placeholder="請輸入關鍵字搜尋，例如：React..."
            className="tb-input search-input"
            data-testid="search-input-field"
            aria-label="搜尋關鍵字"
          />
          {inputValue && (
            <IconButton
              onClick={handleClear}
              className="search-clear"
              label="清除搜尋字詞"
              icon={<X strokeWidth={2.5} aria-hidden="true" />}
            />
          )}
        </div>

        {/* Suggestion tags */}
        <div className="search-suggest select-none">
          <span className="search-suggest__lead">推薦探索:</span>
          {SUGGESTED_KEYWORDS.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => handleSuggestClick(word)}
              className="tb-tag tb-tag--plain tb-lift-s search-chip"
              aria-label={`搜尋 ${word}`}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* Main Results Panel */}
      {showWelcome ? (
        <div className="search-welcome">
          <IconBox icon={<Globe strokeWidth={2.5} />} tone="sky" />
          <h3 className="search-welcome__title">等待搜尋中</h3>
          <p className="search-note">請在上方搜尋欄輸入任何感興趣的單字，或是點選推薦探索的標籤。</p>
        </div>
      ) : (
        <div className="search-results">
          {/* GitHub List Column */}
          <div className="search-col">
            <div className="search-col__head">
              <IconBox icon={<GithubIcon />} tone="pop" />
              <div>
                <h2 className="search-col__title">GitHub 開源倉庫</h2>
                <p className="search-col__desc">按星數 (Stars) 排序的前 10 項專案</p>
              </div>
            </div>

            {isLoadingGithub && (
              <div className="search-list">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="search-card search-pulse">
                    <div className="search-skeleton h-4 w-1/3" />
                    <div className="search-skeleton h-3 w-full" />
                    <div className="search-skeleton h-3 w-5/6" />
                    <div className="flex gap-4 pt-1">
                      <div className="search-skeleton h-3 w-12" />
                      <div className="search-skeleton h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {errorGithub && (
              <div className="search-alert" role="alert">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                <div>
                  <span className="font-bold">檢索失敗：</span>
                  <span>{errorGithub} (可能是觸發了 GitHub API 每分鐘請求上限，請稍候重試)</span>
                </div>
              </div>
            )}

            {!isLoadingGithub && !errorGithub && (
              hasGithubResults ? (
                <ul className="search-list" data-testid="github-results-list">
                  {githubResults.map((repo) => (
                    <li key={repo.full_name} className="search-card">
                      <div className="search-card__top">
                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="search-card__link">
                          {repo.name}
                        </a>
                        {repo.language && <Tag tone="sky" className="shrink-0">{repo.language}</Tag>}
                      </div>

                      <p className="search-card__desc">{repo.description || '無專案說明。'}</p>

                      <div className="search-card__meta">
                        <span className="flex items-center gap-1">
                          <Star className="size-4" strokeWidth={2.5} aria-hidden="true" />
                          <span>{repo.stargazers_count.toLocaleString()}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="size-4" strokeWidth={2.5} aria-hidden="true" />
                          <span>{repo.forks_count.toLocaleString()}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                keyword && !isLoadingGithub && (
                  <div className="search-empty">未找到相關的 GitHub 開源倉庫專案。</div>
                )
              )
            )}
          </div>

          {/* Wikipedia List Column */}
          <div className="search-col">
            <div className="search-col__head">
              <IconBox icon={<BookOpen strokeWidth={2.5} />} tone="sky" />
              <div>
                <h2 className="search-col__title">維基百科條目</h2>
                <p className="search-col__desc">Wikipedia 中文百科前 10 項開放資料</p>
              </div>
            </div>

            {isLoadingWiki && (
              <div className="search-list">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="search-card search-pulse">
                    <div className="search-skeleton h-4 w-1/2" />
                    <div className="search-skeleton h-3 w-full" />
                    <div className="search-skeleton h-3 w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {errorWiki && (
              <div className="search-alert" role="alert">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                <div>
                  <span className="font-bold">檢索失敗：</span>
                  <span>{errorWiki}</span>
                </div>
              </div>
            )}

            {!isLoadingWiki && !errorWiki && (
              hasWikiResults ? (
                <ul className="search-list" data-testid="wiki-results-list">
                  {wikiTitles.map((title, i) => (
                    <li key={title} className="search-card">
                      <div className="flex items-start gap-3">
                        <span className="search-card__num" aria-hidden="true">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <a href={wikiLinks[i]} target="_blank" rel="noopener noreferrer" className="search-card__link">
                            {title}
                          </a>
                          <p className="search-card__desc">{wikiTexts[i] || '無摘要說明。'}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                keyword && !isLoadingWiki && (
                  <div className="search-empty">未找到相關的維基百科中文條目。</div>
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
