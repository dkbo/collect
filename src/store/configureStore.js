import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import { routerReducer as routing, routerMiddleware } from 'react-router-redux'
import { createEpicMiddleware } from 'redux-observable'
import promise from 'redux-promise';
// import logger from 'redux-logger';
import * as reducers from '../reducers'
import rootEpics from '../epics'

const epicMiddleware = createEpicMiddleware(rootEpics)
// const epicMiddleware = createEpicMiddleware(epics.searchGithubKeywordEpics)
const createStoreWithMiddleware = compose(
  applyMiddleware(promise, routerMiddleware(history)),
)(createStore);
const rootReducer = combineReducers({
  ...reducers,
  routing,
});

const middleware = [rootReducer]
if (process.env.NODE_ENV !== 'production') {
  middleware.push(window.devToolsExtension && window.devToolsExtension())
}
const configureStore = (initialState) => {
  const store = createStoreWithMiddleware(
    ...middleware,
    applyMiddleware(epicMiddleware),
    initialState,
  );

  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers', () => {
      store.replaceReducer(reducers);
    });
  }

  return store;
}

export default configureStore
