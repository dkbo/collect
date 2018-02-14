import React, { Component } from 'react'

import App from '../containers/app'
import Loadable from 'react-loadable'
// const getUser = () => firebase.chatAH.currentUser

// const requireAuth = (nextState, replace) => {
//   if(!getUser()) {
//     replace('/auth')
//   }
// }

// const unRequireAuth = (nextState, replace) => {
//   if (getUser()) {
//     replace('/')
//   }
// }
const A = () => <div />
const loadRoute = cb => module => cb(null, module.default)
export const routers = [
	{
		title: '首頁',
		path: '/',
		exact: true,
		component: Loadable({
			loader: () => import(/* webpackChunkName: "home" */ '@P/home/'),
			loading: A
		})
	},
	{
		title: 'RPG Room',
		path: '/rpgroom',
		component: Loadable({
			loader: () => import(/* webpackChunkName: "rpg" */ '@P/rpg/'),
			loading: A
		})
	},
	{
		title: 'Mini Game',
		path: '/minigame',
		component: Loadable({
			loader: () => import(/* webpackChunkName: "miniGame" */ '@P/miniGame/'),
			loading: A
		})
	},
	{
		title: '聊天室',
		path: '/chat',
		component: Loadable({
			loader: () => import(/* webpackChunkName: "chat" */ '@P/chat/'),
			loading: A
		})
	},
	{
		title: 'Auth',
		path: '/auth',
		component: () =>
			Loadable({
				loader: import(/* webpackChunkName: "auth" */ '@P/auth/'),
				loading: A
			})
	}
	// {
	//   title: '地圖查詢',
	//   path: '/directions',
	//   getComponent(location, cb) {
	//     import(/* webpackChunkName: "directions" */ '@P/directions/')
	//     .then(loadRoute(cb))
	//   },
	// },
	// {
	//   title: 'E 履歷',
	//   path: '/resume',
	//   getComponent(location, cb) {
	//     import(/* webpackChunkName: "resume" */ '@P/resume/')
	//     .then(loadRoute(cb))
	//   },
	// },
	// {
	//   path: '/search',
	//   routes: [
	//     {
	//       indexRoute: {
	// 		title: '查詢',
	// 		component: () =>
	// 		Loadable({ loader: import(/* webpackChunkName: "home" */ '@P/searchApi/'), loading: A })
	//       },
	//     },
	//     {
	//       title: '查詢',
	// 	  path: '/search(/:keyword)',
	// 	  component: () =>
	// 	  	Loadable({ loader: import(/* webpackChunkName: "home" */ '@P/searchApi/'), loading: A })
	//       },
	//     },
	//   ],
	// },
	// {
	//   path: '/todos',
	//   routes: [
	//     {
	//       indexRoute: {
	//         title: 'Todos',
	//         getComponent(location, cb) {
	//           import(/* webpackChunkName: "todos" */ '@P/todos/')
	//           .then(loadRoute(cb))
	//         },
	//       },
	//     },
	//     {
	//       title: 'Todos',
	//       path: '/todos/(:keyword)',
	//       getComponent(location, cb) {
	//         import(/* webpackChunkName: "todos" */ '@P/todos/')
	//         .then(loadRoute(cb))
	//       },
	//     },
	//   ],
	// },
	// {
	//   title: '404',
	//   path: '/*',
	//   getComponent(location, cb) {
	//     import(/* webpackChunkName: "notFoundPage" */ '@P/notFoundPage/')
	//     .then(loadRoute(cb))
	//   },
	// },
]
export default routers

// const requireUnauth = getState => {
//   return (nextState, replace) => {
//     if (isAuthenticated(getState())) {
//       replace(paths.TASKS);
//     }
//   };
// };
