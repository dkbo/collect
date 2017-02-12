import React from 'react'
import Search from './components/search'
import ShowList from './components/showList'
import MiniChat from '../../components/miniChat'


import './searchApi.sass'

const SearchApi = props => (
  <div className="container" id="searchApi">
    <Search {...props} />
    <ShowList {...props} />
    <MiniChat {...props} miniChatStyle={{ left: 0 }} />
  </div>
)

export default SearchApi
