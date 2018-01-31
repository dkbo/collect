import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import { routerReducer, routerMiddleware } from 'react-router-redux'
import createHistory from 'history/createHashHistory'
import { createEpicMiddleware } from 'redux-observable'
import promise from 'redux-promise'
// import logger from 'redux-logger';
import * as reducers from '../reducers'
import rootEpics from '../epics'
const rootReducer = combineReducers({
	...reducers,
	router: routerReducer
})
export const history = createHistory()
const routeMiddleware = routerMiddleware(history)
const epicMiddleware = createEpicMiddleware(rootEpics)

const middleware = [
	rootReducer,
	routeMiddleware
]
// if (process.env.NODE_ENV !== 'production') {
// 	middleware.push(window.devToolsExtension && window.devToolsExtension())
// }

export const configureStore = initialState => {
	const store = createStore(
		...middleware,
		compose(applyMiddleware(promise, epicMiddleware), window.devToolsExtension && window.devToolsExtension()),
		initialState
	)
	if (module.hot) {
		// Enable Webpack hot module replacement for reducers
		module.hot.accept('../reducers', () => {
			store.replaceReducer(reducers)
		})
	}

	return store
}
