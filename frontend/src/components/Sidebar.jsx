import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
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
  onRenameConversation,
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameConversationId, setRenameConversationId] = useState(null)
  const [renameTitle, setRenameTitle] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConversationId, setDeleteConversationId] = useState(null)

  const renameConversation = useMemo(() => {
    if (!renameConversationId) return null
    return conversations.find((c) => c.id === renameConversationId) || null
  }, [conversations, renameConversationId])

  const deleteConversation = useMemo(() => {
    if (!deleteConversationId) return null
    return conversations.find((c) => c.id === deleteConversationId) || null
  }, [conversations, deleteConversationId])

  const openRename = (conv) => {
    setRenameConversationId(conv.id)
    setRenameTitle(conv.title || "")
    setRenameOpen(true)
  }

  const openDelete = (convId) => {
    setDeleteConversationId(convId)
    setDeleteOpen(true)
  }

  const handleConfirmRename = async () => {
    if (!renameConversationId) return
    const nextTitle = renameTitle.trim()
    if (!nextTitle) return

    try {
      await onRenameConversation?.(renameConversationId, nextTitle)
      setRenameOpen(false)
    } catch (error) {
      console.error("Rename failed:", error)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConversationId) return

    try {
      await onDeleteConversation?.(deleteConversationId)
      setDeleteOpen(false)
    } catch (error) {
      console.error("Delete failed:", error)
    }
  }

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
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger>
                    <div
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
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => openRename(conv)}>Rename</ContextMenuItem>
                    <ContextMenuItem variant="destructive" onClick={() => openDelete(conv.id)}>
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open)
          if (!open) {
            setRenameConversationId(null)
            setRenameTitle("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Rename {renameConversation?.title ? `“${renameConversation.title}”` : "this conversation"}.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Conversation title"
            className="rounded-md"
            autoFocus
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} disabled={!renameTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setDeleteConversationId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteConversation?.title ? `“${deleteConversation.title}”` : "this conversation"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
