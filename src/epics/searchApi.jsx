import { ajax } from 'rxjs/observable/dom/ajax'
import 'rxjs/add/operator/mergeMap'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/mapTo'
import 'rxjs/add/operator/pluck'
import 'rxjs/add/operator/do'
import {
  SEARCH_WIKI_KEYWORD,
  SEARCH_GITHUB_KEYWORD,
  SEARCH_WIKI_KEYWORD_EPICS,
  SEARCH_GITHUB_KEYWORD_EPICS,
 } from '../constants'

export const searchWikiKeywordEpics = action$ =>
  action$.ofType(SEARCH_WIKI_KEYWORD_EPICS)
    .pluck('keyword')
    .mergeMap(action =>
      ajax
        .getJSON(`https://api.github.com/search/repositories?q=${action}&sort=stars&order=desc`)
        .pluck('items')
        .map(items => items.slice(0, 10))
        .map(list => ({ type: SEARCH_WIKI_KEYWORD, list }))
    )
export const searchGithubKeywordEpics = action$ =>
  action$.ofType(SEARCH_GITHUB_KEYWORD_EPICS)
    .pluck('keyword')
    .mergeMap(action =>
      ajax
        .getJSON(`https://api.github.com/search/repositories?q=${action}&sort=stars&order=desc`)
        .pluck('items')
        .map(items => items.slice(0, 10))
        .map((list) => ({ type: SEARCH_GITHUB_KEYWORD, list }))
  )

