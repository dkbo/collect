import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import createHistory from 'history/createHashHistory';
import { Router } from 'react-router'
import { Route, Switch } from 'react-router-dom';
import { ConnectedRouter, routerReducer, routerMiddleware } from 'react-router-redux';

import currentHistory from './config/currentHistory'

import configureStore from './store/configureStore'
import routes from './router'

import { chat, geo } from './config/firebase'

// import './index.sass'
const history = createHistory();

const store = configureStore();

firebase.initializeApp(chat)
firebase.initializeApp(geo, 'geo')

firebase.chatDB = firebase.database()
firebase.chatAH = firebase.auth()

const geoApp = firebase.app('geo')
firebase.geoDB = firebase.database(geoApp)


render(
  <Provider store={store}>
    <ConnectedRouter history={history} routes={routes} />
    {/* <Router history={history} routes={routes} /> */}
  </Provider>,
    document.getElementById('app'),
)
