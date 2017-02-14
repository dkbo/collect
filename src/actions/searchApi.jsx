import { SEARCH_WIKI_KEYWORD, SEARCH_GITHUB_KEYWORD } from '../constants'

const fetchGithub = keyword => fetch(`https://api.github.com/search/repositories?q=${keyword}&sort=stars&order=desc`)
  .then(res => res.json())

const fetchWiki = keyword => fetch(`https://zh.wikipedia.org/w/api.php?action=opensearch&limit=10&origin=*&search=${keyword}`)
  .then(res => res.json())

export const searchWikiKeyword = async (keyword) => {
  const list = await fetchWiki(keyword)
  return {
    type: SEARCH_WIKI_KEYWORD,
    list,
  }
}

export const searchGithubKeyword = async (keyword) => {
  const list = await fetchGithub(keyword)
  list.items.splice(10, Number.MAX_VALUE)
  return {
    type: SEARCH_GITHUB_KEYWORD,
    list: list.items,
  }
}
