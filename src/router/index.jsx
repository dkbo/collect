import App from '../containers/app'
import Home from '../page/home/'
import Card from '../page/card/'
import Rpg from '../page/rpg/'
import Auth from '../page/auth/'
import Chat from '../page/chat/'
import Resume from '../page/resume/'
import Directions from '../page/directions/'
import NotFoundPage from '../page/notFoundPage/'

const getUser = () => firebase.chatAH.currentUser

// const requireAuth = (nextState, replace) => {
//   if(!getUser()) {
//     replace('/auth')
//   }
// }

const unRequireAuth = (nextState, replace) => {
  if(getUser()) {
    replace('/')
  }
}

export const routers = {
  path: '/',
  component: App,
  childRoutes: [
    {
      indexRoute: {
        title: 'Home',
        component: Home,
      }
    },
    {
      title: 'BootStrap Card',
      path: '/card',
      component: Card,
    },
    {
      title: 'RPG Room',
      path: '/rpgroom',
      component: Rpg,
    },
    {
      title: 'Chat',
      path: '/chat',
      component: Chat,
    },
    {
      title: 'Auth',
      path: '/auth',
      component: Auth,
    },
    {
      title: 'directions',
      path: '/directions',
      component: Directions,
    },
    {
      title: 'resume',
      path: '/resume',
      component: Resume,
    },
    {
      title: '404',
      path: '/*',
      component: NotFoundPage,
    }
  ]
}

export default routers




// const requireUnauth = getState => {
//   return (nextState, replace) => {
//     if (isAuthenticated(getState())) {
//       replace(paths.TASKS);
//     }
//   };
// };



