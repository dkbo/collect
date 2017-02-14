import React from 'react'
import Search from './components/search'
import WikiList from './components/wikiList'
import GithubList from './components/githubList'
import MiniChat from '../../components/miniChat'


import './searchApi.sass'

const SearchApi = props => (
  <div className="container" id="searchApi">
    <Search {...props} />
    <GithubList {...props} />
    <WikiList {...props} />
    <MiniChat {...props} miniChatStyle={{ left: 0 }} />
  </div>
)

export default SearchApi
