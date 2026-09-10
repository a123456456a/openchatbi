import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useChatStore } from '@/stores/chat'

export default function InterruptDialog() {
  const lastInterrupt = useChatStore((s) => s.lastInterrupt)

  function close() {
    useChatStore.setState({ lastInterrupt: null })
  }

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
        <p className="whitespace-pre-wrap text-sm text-slate-700">{lastInterrupt?.text}</p>
        {lastInterrupt?.buttons?.length ? (
          <div className="flex flex-wrap gap-2">
            {lastInterrupt.buttons.map((b, i) => (
              <Badge key={i} variant="secondary">
                {String(b)}
              </Badge>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={close}>知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
