import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import ThemeToggle from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  return (
    <aside className="flex h-screen w-full flex-col border-r border-border bg-sidebar/60 text-sidebar-foreground backdrop-blur-sm md:w-xs">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
        <CardTitle className="text-xl font-semibold tracking-tight">crosscheck.</CardTitle>
        <div className="flex flex-row items-center gap-2">
          <Button variant="default" size="default" onClick={onNewConversation}>
            New Conversation
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        {conversations.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No conversations yet</div>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId
              return (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium">
                      {conv.title || "New Conversation"}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="secondary">{conv.message_count || 0} msgs</Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {new Date(conv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-label="Delete conversation"
                    onClick={() => onDeleteConversation?.(conv.id)}
                    className="shrink-0"
                  >
                    ×
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />
    </aside>
  )
}
