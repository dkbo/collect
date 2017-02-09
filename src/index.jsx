import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'

import { Router } from 'react-router'
import { syncHistoryWithStore } from 'react-router-redux'

import currentHistory from './config/currentHistory'

import configureStore from './store/configureStore'
import routes from './router'

import { chat, geo } from './config/firebase'

import './index.sass'

const store = configureStore();
const history = syncHistoryWithStore(currentHistory, store)

firebase.initializeApp(chat)
firebase.initializeApp(geo, 'geo')

firebase.chatDB = firebase.database()
firebase.chatAH = firebase.auth()

const geoApp = firebase.app('geo')
firebase.geoDB = firebase.database(geoApp)


render(
  <Provider store={store}>
    <Router history={history} routes={routes} />
  </Provider>,
    document.getElementById('app'),
)
