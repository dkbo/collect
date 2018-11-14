import 'babel-polyfill'
import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { Switch } from 'react-router-dom'
import { ConnectedRouter } from 'react-router-redux'
import { renderRoutes } from 'react-router-config'
import { configureStore } from './store/configureStore'
import history from './config/currentHistory'
import { chat, geo } from './config/firebase'
import './index.sass'
import App from './containers/app'

const store = configureStore()

firebase.initializeApp(chat)
firebase.initializeApp(geo, 'geo')

firebase.chatDB = firebase.database()
firebase.chatAH = firebase.auth()

const geoApp = firebase.app('geo')
firebase.geoDB = firebase.database(geoApp)
render(
	<Provider store={store}>
		<ConnectedRouter history={history}>
			<App />
		</ConnectedRouter>
	</Provider>,
	document.getElementById('app')
)
