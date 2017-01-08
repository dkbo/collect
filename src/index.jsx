import './index.sass'

import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';

import {Router} from 'react-router'
import currentHistory from './config/currentHistory'

import { syncHistoryWithStore } from 'react-router-redux'
import { configureStore } from './store/configureStore'
import routes from './router';
import Loading from './components/loading';

import {chat, geo} from './config/firebase'

const store = configureStore();
const history = syncHistoryWithStore(currentHistory, store)



const renderDOM = () => {
  render(
    <Provider store={ store }>
      <Router history={history} routes={routes()} />
    </Provider>,
     document.getElementById("app")
  );
}
const connected = snap => {
  if (snap.val() === true) {
      //連線後取消監聽 database 連線狀況避免 DOM render
      firebase.chatDB.ref(".info/connected").off("value", connected)
      setTimeout(() => {renderDOM();}, 2000)
  } else {
    render(
      <Loading loadText='連線中請稍後' />,
      document.getElementById("app")
    );
  }
}

firebase.initializeApp(chat)
firebase.initializeApp(geo, 'geo')

firebase.chatDB = firebase.database()
firebase.chatAH = firebase.auth()

const geoApp = firebase.app('geo')
firebase.geoDB = firebase.database(geoApp)

firebase.chatDB.ref(".info/connected").on("value", connected)



