import { createBrowserHistory, createHashHistory } from 'history'

const currentHistory = __HASHPATH__ ? createHashHistory : createBrowserHistory

export default currentHistory()
