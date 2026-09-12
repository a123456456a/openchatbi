import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import LoginPage from '@/pages/LoginPage'
import RequireAuth from './RequireAuth'

// Heavy chat / admin pages stay out of the login entry chunk.
const ChatPage = lazy(() => import('@/pages/ChatPage'))
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'))
const DatabasesPage = lazy(() => import('@/pages/admin/DatabasesPage'))

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/chat', element: <ChatPage /> },
      { path: '/chat/:sessionId', element: <ChatPage /> },
    ],
  },
  {
    element: <RequireAuth roles={['admin']} />,
    children: [
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/databases', element: <DatabasesPage /> },
    ],
  },
  { path: '/', element: <Navigate to="/chat" replace /> },
  { path: '*', element: <Navigate to="/chat" replace /> },
])
