import App from '../containers/app'
import Home from '../page/home/'
import Rpg from '../page/rpg/'
import Auth from '../page/auth/'
import Chat from '../page/chat/'
import Resume from '../page/resume/'
import Directions from '../page/directions/'
import SearchApi from '../page/searchApi/'
import Todos from '../page/todos/'
import NotFoundPage from '../page/notFoundPage/'

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

export const routers = {
  path: '/',
  component: App,
  childRoutes: [
    {
      indexRoute: {
        title: '首頁',
        component: Home,
      },
    },
    {
      title: 'RPG Room',
      path: '/rpgroom',
      component: Rpg,
    },
    {
      title: '聊天室',
      path: '/chat',
      component: Chat,
    },
    {
      title: 'Auth',
      path: '/auth',
      component: Auth,
    },
    {
      title: '地圖查詢',
      path: '/directions',
      component: Directions,
    },
    {
      title: 'E 履歷',
      path: '/resume',
      component: Resume,
    },
    {
      path: '/search',
      childRoutes: [
        {
          indexRoute: {
            title: '查詢',
            component: SearchApi,
          },
        },
        {
          title: '查詢',
          path: '/search(/:keyword)',
          component: SearchApi,
        },
      ],
    },
    {
      path: '/todos',
      childRoutes: [
        {
          indexRoute: {
            title: 'Todos',
            component: Todos,
          },
        },
        {
          title: 'Todos',
          path: '/todos/(:keyword)',
          component: Todos,
        },
      ],
    },
    {
      title: '404',
      path: '/*',
      component: NotFoundPage,
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
