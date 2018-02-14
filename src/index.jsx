import 'babel-polyfill'
import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { Route, Switch } from 'react-router-dom'
import { ConnectedRouter } from 'react-router-redux'
import { configureStore, history } from './store/configureStore'
import { chat, geo } from './config/firebase'
// import './index.sass'
import App from './containers/app'

const store = configureStore()

firebase.initializeApp(chat)
firebase.initializeApp(geo, 'geo')

firebase.chatDB = firebase.database()
firebase.chatAH = firebase.auth()

const geoApp = firebase.app('geo')
firebase.geoDB = firebase.database(geoApp)
console.log(store)
render(
	<Provider store={store}>
		<ConnectedRouter history={history}>
			<App />
		</ConnectedRouter>
	</Provider>,
	document.getElementById('app')
)
