import React, { Component } from 'react'

import App from '../containers/app'
function loadRoute(loader) {
	let Component = null

	return class AsyncRouteComponent extends React.Component {
		constructor() {
			super()
			this.updateState = this.updateState.bind(this)
			this.state = {
				Component
			}
		}

		componentWillMount() {
			AsyncRouteComponent.load().then(this.updateState)
		}

		updateState() {
			// Only update state if we don't already have a reference to the
			// component, this prevent unnecessary renders.
			if (this.state.Component !== Component) {
				this.setState({
					Component
				})
			}
		}

		/**
		 * Static so that you can call load against an uninstantiated version of
		 * this component. This should only be called one time outside of the
		 * normal render path.
		 */
		static load() {
			return loader().then(ResolvedComponent => {
				Component = ResolvedComponent.default || ResolvedComponent
			})
		}

		render() {
			const { Component: ComponentFromState } = this.state
			if (ComponentFromState) {
				return <ComponentFromState {...this.props} />
			}
			// if (Placeholder) {
			//   return <Placeholder {...this.props} />;
			// }
			return null
		}
	}
}
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
export const routers = [
	{
		title: '首頁',
		path: '/',
		exact: true,
		component: loadRoute(() => import(/* webpackChunkName: "directions" */ '@P/home/')),
	},
	{
		title: 'RPG Room',
		path: '/rpgroom',
		component: loadRoute(() => import(/* webpackChunkName: "rpg" */ '@P/rpg/'))
	},
	{
		title: 'Mini Game',
		path: '/minigame',
		component: loadRoute(() => import(/* webpackChunkName: "miniGame" */ '@P/miniGame/'))
	},
	{
		title: '聊天室',
		path: '/chat',
		component: loadRoute(() => import(/* webpackChunkName: "chat" */ '@P/chat/'))
	},
	{
		title: 'Auth',
		path: '/auth',
		component: loadRoute(() => import(/* webpackChunkName: "auth" */ '@P/auth/'))
	},
	{
	  	title: '地圖查詢',
	  	path: '/directions',
		component: loadRoute(() => import(/* webpackChunkName: "directions" */ '@P/directions/'))
	},
	{
	  	title: 'E 履歷',
	  	path: '/resume',
		component: loadRoute(() => import(/* webpackChunkName: "resume" */ '@P/resume/'))
	},
	{
		title: '查詢',
		path: '/search/:keyword',
		component: loadRoute(() => import(/* webpackChunkName: "home" */ '@P/searchApi/'))
	},
	{
		path: '/search',
		title: '查詢',
		component: loadRoute(() => import(/* webpackChunkName: "home" */ '@P/searchApi/'))
	},
	{
		path: '/todos/:keyword',
		title: 'Todos',
		component: loadRoute(() => import(/* webpackChunkName: "todos" */ '@P/todos/')),
	},
	{
		path: '/todos',
		title: 'Todos',
		component: loadRoute(() => import(/* webpackChunkName: "todos" */ '@P/todos/')),
	},
	{
		title: '404',
		path: '/*',
		component: loadRoute(() => import(/* webpackChunkName: "notFoundPage" */ '@P/notFoundPage/'))
	}
]
export default routers

// const requireUnauth = getState => {
//   return (nextState, replace) => {
//     if (isAuthenticated(getState())) {
//       replace(paths.TASKS);
//     }
//   };
// };
