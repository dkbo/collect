import { SEARCH_API } from '../constants';

const searchApi = (state = [], action) => {
  switch (action.type) {
    case SEARCH_API:
      return action.list
    default:
      return state
  }
}

export default searchApi
