import { createHashRouter, RouterProvider } from 'react-router-dom'
import Layout from '@/components/Layout'
import { lazy } from 'react'

const Home = lazy(() => import('@/pages/Home'))
const Resume = lazy(() => import('@/pages/Resume'))
const MiniGame = lazy(() => import('@/pages/MiniGame'))
const RpgRoom = lazy(() => import('@/pages/RpgRoom'))
const SearchApi = lazy(() => import('@/pages/Search'))
const TodoList = lazy(() => import('@/pages/Todos'))
const DirectionsPage = lazy(() => import('@/pages/Directions'))

const MapDeveloper = lazy(() => import('@/pages/MapDeveloper'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Configure standard browser router with Layout wrapper
const router = createHashRouter([
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
        path: 'map-developer',
        element: <MapDeveloper />,
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

