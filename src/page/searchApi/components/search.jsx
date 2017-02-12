import React, { Component, PropTypes } from 'react'
import './search.sass'

export default class Search extends Component {
  componentWillMount() {
    this.changeSubject = new Rx.Subject()

    this.event = this.changeSubject
      .map(e => e.target.value)
      .debounceTime(500)
      .subscribe(value => this.props.searchApi(value))
  }
  componentWillUnmount() {
    this.event.unsubscribe()
  }
  render() {
    return (
      <div id="search">
        <label id="search-icon" htmlFor="search-input"><i className="fa fa-search" /></label>
        <input
          type="search"
          id="search-input"
          defaultValue={this.props.showList ? this.props.showList[0] : ''}
          onChange={e => this.changeSubject.next(e)}
          autoComplete="off"
          placeholder="搜尋 維基百科 關鍵字"
        />
      </div>
    )
  }
}

Search.propTypes = {
  searchApi: PropTypes.func,
}

