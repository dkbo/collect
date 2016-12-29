import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { routerReducer as routing, routerMiddleware } from 'react-router-redux'
import thunk from 'redux-thunk';
import promise from 'redux-promise';
// import logger from 'redux-logger';
import * as reducers from '../reducers';


const createStoreWithMiddleware = compose(
  // applyMiddleware(thunk, promise, logger()),
  applyMiddleware(thunk, promise, routerMiddleware(history))
)(createStore);
const rootReducer = combineReducers({
  ...reducers,
  routing,
});

export const configureStore = (initialState) => {
  const store = createStoreWithMiddleware(
    rootReducer,
    initialState,
    window.devToolsExtension && window.devToolsExtension()
  );

  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers', () => {
      const nextReducer = require('../reducers');
      store.replaceReducer(nextReducer);
    });
  }

  return store;
}
