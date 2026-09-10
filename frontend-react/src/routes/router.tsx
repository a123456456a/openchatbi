import { createBrowserRouter, Navigate } from 'react-router'

import DatabasesPage from '@/pages/admin/DatabasesPage'
import UsersPage from '@/pages/admin/UsersPage'
import ChatPage from '@/pages/ChatPage'
import LoginPage from '@/pages/LoginPage'
import RequireAuth from './RequireAuth'

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
