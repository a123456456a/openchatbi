import { Settings, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { canManageLlm } from '@/lib/roles'

export default function SidebarFooter() {
  const navigate = useNavigate()
  const username = useAuthStore((s) => s.username)
  const role = useAuthStore((s) => s.role)
  const logout = useAuthStore((s) => s.logout)
  const openSettings = useSettingsStore((s) => s.openSettings)

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-[var(--color-muted)]/70"
          >
            <Avatar className="h-[30px] w-[30px] shrink-0 shadow-sm">
              <AvatarFallback className="text-white" style={{ background: 'var(--gradient-brand)' }}>
                <UserRound size={16} />
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[7rem] truncate text-sm font-medium text-[var(--color-foreground)]">
              {username || '用户'}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled>资料（占位）</DropdownMenuItem>
          {role === 'admin' && (
            <>
              <DropdownMenuItem onSelect={() => navigate('/admin/users')}>用户管理</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/admin/databases')}>数据库管理</DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void onLogout()}>退出登录</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canManageLlm(role) ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full"
          aria-label="设置"
          onClick={openSettings}
        >
          <Settings size={18} />
        </Button>
      ) : (
        <span className="px-2 text-xs text-[var(--color-muted-foreground)]" title="只读账号">
          只读
        </span>
      )}
    </div>
  )
}
