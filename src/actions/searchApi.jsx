import { SEARCH_WIKI_KEYWORD_EPICS, SEARCH_GITHUB_KEYWORD_EPICS } from '../constants'


export const searchGithubKeyword = keyword => ({
  type: SEARCH_GITHUB_KEYWORD_EPICS,
  keyword,
})

export const searchWikiKeyword = keyword => ({
  type: SEARCH_WIKI_KEYWORD_EPICS,
  keyword,
})
