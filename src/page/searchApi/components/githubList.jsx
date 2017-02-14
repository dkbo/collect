import React, { PropTypes } from 'react'
import './githubList.sass'

const renderGithubList = (list) => list.map((json, i) => (
  <li key={json.full_name}>
    <a href={json.html_url} target="_blank" rel="noopener noreferrer">{json.name}</a>
    <div>{json.description}</div>
  </li>
  ),
)

const GithubList = ({showList}) => (
  <div className={showList.github.length > 0 ? "col col-md-6 opacity" : "col col-md-6"}>
    {showList.github.length > 0 ? <div className="h2">Github</div> : null }
    <ul id="githubList">
      {showList.github.length > 0
        ? renderGithubList(showList.github)
        : null
      }
    </ul>
  </div>
)
GithubList.propTypes = {
  showList: PropTypes.object,
}
export default GithubList
