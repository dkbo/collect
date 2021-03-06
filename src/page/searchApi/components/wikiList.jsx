import React from 'react'
import PropTypes from 'prop-types'
import './wikiList.sass'

const renderwikiList = (list1 = [], list2, list3) => list1.map((value, i) => (
  <li key={value}>
    <a href={list3[i]} target="_blank" rel="noopener noreferrer">{value}</a>
    <div>{list2[i]}</div>
  </li>
  ),
)

const WikiList = ({ showList }) => (
  <div className={showList.wiki[1].length > 0 ? 'col col-md-6 opacity' : 'col col-md-6'}>
    {showList.wiki[1].length > 0 ? <div><i className="fa fa-wikipedia-w fa-5x" /></div> : null }
    <ul id="wikiList">
      {showList.wiki[1].length > 0
        ? renderwikiList(showList.wiki[1], showList.wiki[2], showList.wiki[3])
        : null
      }
    </ul>
  </div>
)

WikiList.propTypes = {
  showList: PropTypes.object,
}
export default WikiList
