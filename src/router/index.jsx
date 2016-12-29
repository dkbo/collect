import App from '../containers/app'
import Home from '../page/home/'
import Card from '../page/card/'
import Rpg from '../page/rpg/'
import Auth from '../page/auth/'
import Chat from '../page/chat/'
import Directions from '../page/directions/'
import NotFoundPage from '../page/notFoundPage/'

const getUser = () => firebase.chatAH.currentUser

const requireAuth = (nextState, replace) => {
  if(!getUser()) {
    replace('/auth')
  }
}

const unRequireAuth = (nextState, replace) => {
  if(getUser()) {
    replace('/')
  }
}

export const routers = () => {
  return {
    path: '/',
    component: App,
    childRoutes: [
      {
        indexRoute: {
          title: 'Home',
          component: Home,
          onEnter: null
        }
      },
      {
        title: 'BootStrap Card',
        path: '/card',
        component: Card,
        onEnter: null
      },
      {
        title: 'RPG Room',
        path: '/rpgroom',
        component: Rpg,
        onEnter: null
      },
      {
        title: 'Chat',
        path: '/chat',
        component: Chat,
        onEnter: requireAuth
      },
      {
        title: 'Auth',
        path: '/auth',
        component: Auth,
        onEnter: unRequireAuth
      },
      {
        title: 'directions',
        path: '/directions',
        component: Directions,
      },
      {
        title: '404',
        path: '/*',
        component: NotFoundPage,
        onEnter: null
      }
    ]
  };
};

export default routers




// const requireUnauth = getState => {
//   return (nextState, replace) => {
//     if (isAuthenticated(getState())) {
//       replace(paths.TASKS);
//     }
//   };
// };



