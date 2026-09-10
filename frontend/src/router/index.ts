import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import ChatView from '../views/ChatView.vue'
import LoginView from '../views/LoginView.vue'
import DatabasesView from '../views/admin/DatabasesView.vue'
import UsersView from '../views/admin/UsersView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/chat',
      name: 'chat',
      component: ChatView,
    },
    {
      path: '/chat/:sessionId',
      name: 'chat-session',
      component: ChatView,
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: UsersView,
      meta: { roles: ['admin'] },
    },
    {
      path: '/admin/databases',
      name: 'admin-databases',
      component: DatabasesView,
      meta: { roles: ['admin'] },
    },
    {
      path: '/',
      redirect: '/chat',
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/chat',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (auth.isAuthenticated) {
      return { name: 'chat' }
    }
    if (auth.getStoredRefresh()) {
      const ok = await auth.refresh()
      if (ok) return { name: 'chat' }
    }
    return true
  }

  if (!auth.isAuthenticated) {
    if (auth.getStoredRefresh()) {
      const ok = await auth.refresh()
      if (!ok) return { name: 'login', query: { redirect: to.fullPath } }
    } else {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  const roles = to.meta.roles as string[] | undefined
  if (roles?.length && (!auth.role || !roles.includes(auth.role))) {
    return { name: 'chat' }
  }

  return true
})

export default router
