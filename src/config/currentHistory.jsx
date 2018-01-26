import { HashRouter, BrowserRouter } from 'react-router-dom'
const currentHistory = __HASHPATH__ ? HashRouter : BrowserRouter

export default currentHistory
