import { SEARCH_API } from '../constants'

const url = 'https://zh.wikipedia.org/w/api.php?action=opensearch&limit=10&origin=*&search=';

const getSearchList = keyword => fetch(url + keyword)
  .then(res => res.json())

const searchApi = async (keyword) => {
  const list = await getSearchList(keyword)
  return {
    type: SEARCH_API,
    list,
  }
}
export default searchApi
