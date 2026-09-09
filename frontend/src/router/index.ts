import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import ChatView from '../views/ChatView.vue'
import LoginView from '../views/LoginView.vue'

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

  if (auth.isAuthenticated) {
    return true
  }

  if (auth.getStoredRefresh()) {
    const ok = await auth.refresh()
    if (ok) return true
  }

  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
