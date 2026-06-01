import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Resume from '@/pages/Resume'
import MiniGame from '@/pages/MiniGame'
import RpgRoom from '@/pages/RpgRoom'
import SearchApi from '@/pages/Search'
import TodoList from '@/pages/Todos'
import DirectionsPage from '@/pages/Directions'
import ChatPage from '@/pages/Chat'
import NotFound from '@/pages/NotFound'

// Configure standard browser router with Layout wrapper
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'resume',
        element: <Resume />,
      },
      {
        path: 'miniGame',
        element: <MiniGame />,
      },
      {
        path: 'rpgroom',
        element: <RpgRoom />,
      },
      {
        path: 'search',
        element: <SearchApi />,
      },
      {
        path: 'search/:keyword',
        element: <SearchApi />,
      },
      {
        path: 'todos',
        element: <TodoList />,
      },
      {
        path: 'todos/:keyword',
        element: <TodoList />,
      },
      {
        path: 'directions',
        element: <DirectionsPage />,
      },
      {
        path: 'chat',
        element: <ChatPage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}

export default App

