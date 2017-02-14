import { SEARCH_WIKI_KEYWORD, SEARCH_GITHUB_KEYWORD } from '../constants';

const stateInitial = {
  wiki: [],
  github: [],
}

const searchApi = (state = stateInitial, action) => {
  switch (action.type) {
    case SEARCH_WIKI_KEYWORD:
      return Object.assign({}, state, {wiki: action.list})
    case SEARCH_GITHUB_KEYWORD:
      return Object.assign({}, state, {github: action.list})
    default:
      return state
  }
}

export default searchApi
