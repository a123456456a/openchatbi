import { MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

function redirectTarget(raw: string | null): string {
  return raw && raw.startsWith('/') ? raw : '/chat'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const target = redirectTarget(searchParams.get('redirect'))

  useEffect(() => {
    if (isAuthenticated) {
      navigate(target, { replace: true })
      return
    }
    const { getStoredRefresh, refresh } = useAuthStore.getState()
    if (!getStoredRefresh()) return
    let active = true
    void refresh().then((ok) => {
      if (active && ok) navigate(target, { replace: true })
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  async function onLogin() {
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate(target, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  async function onBootstrap() {
    if (!username || !password) {
      setError('请输入首个管理员用户名和密码')
      return
    }
    setError(null)
    setNotice(null)
    setBootstrapping(true)
    try {
      await bootstrap(username, password)
      setNotice('已创建首个管理员，请登录')
    } catch (e) {
      setError(e instanceof Error ? e.message : '初始化失败')
    } finally {
      setBootstrapping(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void onLogin()
    }
  }

  return (
    <div className="login-page relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-lg shadow-teal-900/20"
            aria-hidden="true"
          >
            <MessageSquare size={28} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-foreground)]">
            OpenChatBI
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">用对话探索业务数据</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">登录</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">使用自建账号继续</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
            {notice && !error && <p className="text-sm text-[var(--color-primary)]">{notice}</p>}

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 flex-1 rounded-xl" disabled={loading} onClick={onLogin}>
                {loading ? '登录中…' : '登录'}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                disabled={bootstrapping}
                onClick={onBootstrap}
              >
                {bootstrapping ? '初始化中…' : '首次初始化'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgb(15 118 110 / 0.16), transparent),
            linear-gradient(180deg, #f0fdfa 0%, var(--color-background) 45%, #f1f5f9 100%);
        }
        .login-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgb(15 118 110 / 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgb(15 118 110 / 0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent);
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
