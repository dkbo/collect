import React, { useEffect, useLayoutEffect, useState } from 'react'
import PropTypes from 'prop-types'
import currentHistory from '../../../config/currentHistory'
import './search.sass'

const changeSubject = new Rx.Subject()
const Search = (props) => {
  useLayoutEffect(() => {
    const search = changeSubject
      .filter(value => value.trim())
      .debounceTime(500)
      .do(value => currentHistory.push(`/search/${value}`))
      .share()

    const wikiSearch = search.subscribe(props.searchWikiKeyword)
    const githubSearch = search.subscribe(props.searchGithubKeyword)
    const keyword = props.match.params.keyword
    if (keyword) {
      changeSubject.next(keyword)
    }
    return () => {
      wikiSearch.unsubscribe()
      githubSearch.unsubscribe()
    }
  }, [])
  // useEffect(() => {

  // }, [])
  // shouldComponentUpdate() {
  //   return false
  // }
  const getDefaultValue = () => {
    if (props.match.params.keyword) {
      return props.match.params.keyword
    }
    return props.showList.wiki ? props.showList.wiki[0] : ''
  }

  return (
    <div id="search">
      <label htmlFor="search-input" id="search-icon"><i className="fa fa-search" /></label>
      <input
        type="search"
        id="search-input"
        defaultValue={getDefaultValue()}
        onChange={e => changeSubject.next(e.target.value)}
        autoComplete="off"
        placeholder="搜尋關鍵字"
      />
    </div>
  )
}

Search.propTypes = {
  searchWikiKeyword: PropTypes.func,
  searchGithubKeyword: PropTypes.func,
  showList: PropTypes.object,
  router: PropTypes.object,
}

export default Search
