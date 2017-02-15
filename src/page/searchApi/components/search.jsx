import React, { Component, PropTypes } from 'react'
import currentHistory from '../../../config/currentHistory'
import './search.sass'

export default class Search extends Component {
  componentWillMount() {
    this.changeSubject = new Rx.Subject()

    const search = this.changeSubject
      .filter(value => value.trim())
      .debounceTime(500)
      .do(value => currentHistory.push(`/search/${value}`))
      .share()

    this.wikiSearch = search.subscribe(this.props.searchWikiKeyword)
    this.githubSearch = search.subscribe(this.props.searchGithubKeyword)
  }

  componentDidMount() {
    const keyword = this.props.router.params.keyword
    if (keyword) {
      this.changeSubject.next(keyword)
    }
  }
  shouldComponentUpdate() {
    return false
  }
  componentWillUnmount() {
    this.wikiSearch.unsubscribe()
    this.githubSearch.unsubscribe()
  }

  getDefaultValue = () => {
    if (this.props.router.params.keyword) {
      return this.props.router.params.keyword
    }
    return this.props.showList.wiki ? this.props.showList.wiki[0] : ''
  }

  render() {
    return (
      <div id="search">
        <label id="search-icon" htmlFor="search-input"><i className="fa fa-search" /></label>
        <input
          type="search"
          id="search-input"
          defaultValue={this.getDefaultValue()}
          onChange={e => this.changeSubject.next(e.target.value)}
          autoComplete="off"
          placeholder="搜尋關鍵字"
        />
      </div>
    )
  }
}

Search.propTypes = {
  searchWikiKeyword: PropTypes.func,
  searchGithubKeyword: PropTypes.func,
  showList: PropTypes.object,
  router: PropTypes.object,
}

