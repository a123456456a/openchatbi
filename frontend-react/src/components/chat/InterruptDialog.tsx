import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { sanitizeInterruptText } from '@/lib/interruptText'
import { useChatStore } from '@/stores/chat'

export default function InterruptDialog() {
  const lastInterrupt = useChatStore((s) => s.lastInterrupt)
  const sessionId = useChatStore((s) => s.sessionId)

  function close() {
    useChatStore.setState({ lastInterrupt: null })
  }

  function choose(option: string) {
    const sid = sessionId
    close()
    if (sid) void useChatStore.getState().send(sid, option)
  }

  const displayText = lastInterrupt ? sanitizeInterruptText(lastInterrupt.text) : null
  const buttons = (lastInterrupt?.buttons ?? []).map((b) => String(b))

  return (
    <Dialog
      open={!!lastInterrupt}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>需要你的确认</DialogTitle>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {displayText ?? (buttons.length ? '请选择以下选项继续' : '请在下方输入框中回复以继续对话')}
        </p>
        {buttons.length ? (
          <div className="flex flex-wrap gap-2">
            {buttons.map((option, i) => (
              <Button key={i} variant="secondary" size="sm" onClick={() => choose(option)}>
                {option}
              </Button>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
