import {hashHistory, browserHistory} from 'react-router'

const currentHistory = __HASHPATH__ ? hashHistory : browserHistory

export default currentHistory
