import { combineEpics } from 'redux-observable'
import * as searchApi from './searchApi'
import * as todos from './todos'

const rootEpic = combineEpics(
  ...Object.values(todos),
  ...Object.values(searchApi),
)
export default rootEpic
