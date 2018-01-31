import App from '../containers/app'

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
const loadRoute = cb => module => cb(null, module.default)
export const routers = {
  path: '/',
  component: App,
  routes: [
    {
      path: '/',
      title: '首頁',
      getComponent(location, cb) {
        import(/* webpackChunkName: "home" */ '@P/home/')
        .then(loadRoute(cb))
      },
    },
    {
      title: 'RPG Room',
      path: '/rpgroom',
      getComponent(location, cb) {
        import(/* webpackChunkName: "rpg" */ '@P/rpg/')
        .then(loadRoute(cb))
      },
    },
    {
      title: 'Mini Game',
      path: '/minigame',
      getComponent(location, cb) {
        import(/* webpackChunkName: "miniGame" */ '@P/miniGame/')
        .then(loadRoute(cb))
      },
    },
    {
      title: '聊天室',
      path: '/chat',
      getComponent(location, cb) {
        import(/* webpackChunkName: "chat" */ '@P/chat/')
        .then(loadRoute(cb))
      },
    },
    {
      title: 'Auth',
      path: '/auth',
      getComponent(location, cb) {
        import(/* webpackChunkName: "auth" */ '@P/auth/')
        .then(loadRoute(cb))
      },
    },
    {
      title: '地圖查詢',
      path: '/directions',
      getComponent(location, cb) {
        import(/* webpackChunkName: "directions" */ '@P/directions/')
        .then(loadRoute(cb))
      },
    },
    {
      title: 'E 履歷',
      path: '/resume',
      getComponent(location, cb) {
        import(/* webpackChunkName: "resume" */ '@P/resume/')
        .then(loadRoute(cb))
      },
    },
    {
      path: '/search',
      routes: [
        {
          indexRoute: {
            title: '查詢',
            getComponent(location, cb) {
              import(/* webpackChunkName: "searchApi" */ '@P/searchApi/')
              .then(loadRoute(cb))
            },
          },
        },
        {
          title: '查詢',
          path: '/search(/:keyword)',
          getComponent(location, cb) {
            import(/* webpackChunkName: "searchApi" */ '@P/searchApi/')
            .then(loadRoute(cb))
          },
        },
      ],
    },
    {
      path: '/todos',
      routes: [
        {
          indexRoute: {
            title: 'Todos',
            getComponent(location, cb) {
              import(/* webpackChunkName: "todos" */ '@P/todos/')
              .then(loadRoute(cb))
            },
          },
        },
        {
          title: 'Todos',
          path: '/todos/(:keyword)',
          getComponent(location, cb) {
            import(/* webpackChunkName: "todos" */ '@P/todos/')
            .then(loadRoute(cb))
          },
        },
      ],
    },
    {
      title: '404',
      path: '/*',
      getComponent(location, cb) {
        import(/* webpackChunkName: "notFoundPage" */ '@P/notFoundPage/')
        .then(loadRoute(cb))
      },
    },
  ],
}
export default routers

// const requireUnauth = getState => {
//   return (nextState, replace) => {
//     if (isAuthenticated(getState())) {
//       replace(paths.TASKS);
//     }
//   };
// };
