import React, { PropTypes } from 'react'
import './showList.sass'

const renderShowList = (list1 = [], list2, list3) => list1.map((value, i) => (
  <li key={value}>
    <a href={list3[i]} target="_blank" rel="noopener noreferrer">{value}</a>
    <div>{list2[i]}</div>
  </li>
  ),
)

const ShowList = props => (
  <ul id="showList">
    {props.showList
      ? renderShowList(props.showList[1], props.showList[2], props.showList[3])
      : null
    }
  </ul>
)
ShowList.propTypes = {
  showList: PropTypes.array,
}
export default ShowList
