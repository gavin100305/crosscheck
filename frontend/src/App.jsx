import { useCallback, useEffect, useState } from "react"

import ChatInterface from "@/components/ChatInterface"
import Sidebar from "@/components/Sidebar"
import { api } from "@/api"
import {
  createConversationInFirebase,
  deleteConversationFromFirebase,
  getConversationFromFirebase,
  listConversationsFromFirebase,
  saveConversationToFirebase,
} from "@/lib/conversations"
import { hasFirebaseConfig } from "@/lib/firebase"

const LOCAL_IDS_KEY = "crosscheck-conversation-ids"

function loadLocalConversationIds() {
  try {
    const raw = localStorage.getItem(LOCAL_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []
  } catch {
    return []
  }
}

function saveLocalConversationIds(ids) {
  localStorage.setItem(LOCAL_IDS_KEY, JSON.stringify(ids))
}

function formatConversationMetadata(conv) {
  return {
    id: conv.id,
    created_at: conv.created_at,
    title: conv.title || "New Conversation",
    message_count: conv.messages?.length || 0,
  }
}

function updateConversationState(prev, updater) {
  if (!prev) {
    return prev
  }
  return updater(prev)
}

function App() {
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [currentConversation, setCurrentConversation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [storageError, setStorageError] = useState("")

  const loadConversations = useCallback(async () => {
    if (!hasFirebaseConfig) {
      setStorageError("Firebase is not configured. Add VITE_FIREBASE_* values to frontend env.")
      return
    }

    try {
      const allowedIds = new Set(loadLocalConversationIds())
      if (allowedIds.size === 0) {
        setConversations([])
        setStorageError("")
        return
      }
      const convs = await listConversationsFromFirebase()
      const filtered = convs.filter((c) => allowedIds.has(c.id))
      setConversations(filtered.map(formatConversationMetadata))
      setStorageError("")
    } catch (error) {
      console.error("Failed to load conversations:", error)
      setStorageError(error.message)
    }
  }, [])

  const loadConversation = useCallback(async (id) => {
    if (!hasFirebaseConfig) {
      return
    }

    const allowedIds = new Set(loadLocalConversationIds())
    if (!allowedIds.has(id)) {
      setCurrentConversation(null)
      return
    }

    try {
      const conv = await getConversationFromFirebase(id)
      setCurrentConversation(conv)
    } catch (error) {
      console.error("Failed to load conversation:", error)
    }
  }, [])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId)
    }
  }, [currentConversationId, loadConversation])

  const handleNewConversation = async () => {
    if (!hasFirebaseConfig) {
      return
    }

    try {
      const backendConv = await api.createConversation()
      const newConv = {
        id: backendConv.id,
        created_at: backendConv.created_at,
        updated_at: backendConv.created_at,
        title: "New Conversation",
        messages: [],
        message_count: 0,
      }

      await createConversationInFirebase(newConv)

      const ids = loadLocalConversationIds()
      if (!ids.includes(newConv.id)) {
        saveLocalConversationIds([newConv.id, ...ids])
      }

      await loadConversations()
      setCurrentConversationId(newConv.id)
      setCurrentConversation(newConv)
      setStorageError("")
    } catch (error) {
      console.error("Failed to create conversation:", error)
      const message = error instanceof Error ? error.message : String(error)
      setStorageError(
        `Failed to create conversation. Is the backend running at ${import.meta.env.VITE_API_BASE_URL || "http://localhost:8001"}? (${message})`
      )
    }
  }

  const handleSelectConversation = (id) => {
    const allowedIds = new Set(loadLocalConversationIds())
    if (!allowedIds.has(id)) {
      return
    }
    setCurrentConversationId(id)
  }

  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversationFromFirebase(id)
    } catch (error) {
      console.error("Failed to delete conversation:", error)
      const message = error instanceof Error ? error.message : String(error)
      setStorageError(`Failed to delete conversation. (${message})`)
      return
    }

    const nextIds = loadLocalConversationIds().filter((x) => x !== id)
    saveLocalConversationIds(nextIds)

    if (currentConversationId === id) {
      setCurrentConversationId(null)
      setCurrentConversation(null)
    }

    await loadConversations()
  }

  const handleSendMessage = async (content) => {
    if (!currentConversationId || !currentConversation) return

    setIsLoading(true)
    try {
      // Optimistically add user message to UI
      const userMessage = { role: "user", content }

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: "assistant",
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      }

      const baseConversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage, assistantMessage],
      }

      setCurrentConversation(baseConversation)
      await saveConversationToFirebase(baseConversation)

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, (eventType, event) => {
        let nextConversation = null

        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => {
                const messages = [...conversation.messages]
                const lastMsg = { ...messages[messages.length - 1] }
                lastMsg.loading = { ...lastMsg.loading, stage1: true }
                messages[messages.length - 1] = lastMsg
                return { ...conversation, messages }
              })
              return nextConversation
            })
            break

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => {
                const messages = [...conversation.messages]
                const lastMsg = { ...messages[messages.length - 1] }
                lastMsg.stage1 = event.data
                lastMsg.loading = { ...lastMsg.loading, stage1: false }
                messages[messages.length - 1] = lastMsg
                return { ...conversation, messages }
              })
              return nextConversation
            })
            break

          case 'stage2_start':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => {
                const messages = [...conversation.messages]
                const lastMsg = { ...messages[messages.length - 1] }
                lastMsg.loading = { ...lastMsg.loading, stage2: true }
                messages[messages.length - 1] = lastMsg
                return { ...conversation, messages }
              })
              return nextConversation
            })
            break

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => {
                const messages = [...conversation.messages]
                const lastMsg = { ...messages[messages.length - 1] }
                lastMsg.stage2 = event.data
                lastMsg.metadata = event.metadata
                lastMsg.loading = { ...lastMsg.loading, stage2: false }
                messages[messages.length - 1] = lastMsg
                return { ...conversation, messages }
              })
              return nextConversation
            })
            break

          case 'stage3_start':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => {
                const messages = [...conversation.messages]
                const lastMsg = { ...messages[messages.length - 1] }
                lastMsg.loading = { ...lastMsg.loading, stage3: true }
                messages[messages.length - 1] = lastMsg
                return { ...conversation, messages }
              })
              return nextConversation
            })
            break

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => {
                const messages = [...conversation.messages]
                const lastMsg = { ...messages[messages.length - 1] }
                lastMsg.stage3 = event.data
                lastMsg.loading = { ...lastMsg.loading, stage3: false }
                messages[messages.length - 1] = lastMsg
                return { ...conversation, messages }
              })
              return nextConversation
            })
            break

          case 'title_complete':
            setCurrentConversation((prev) => {
              nextConversation = updateConversationState(prev, (conversation) => ({
                ...conversation,
                title: event.data?.title || conversation.title,
              }))
              return nextConversation
            })
            break

          case 'complete':
            setIsLoading(false)
            break

          case 'error':
            console.error('Stream error:', event.message)
            setIsLoading(false)
            break

          default:
            console.log('Unknown event type:', eventType)
        }

        if (nextConversation) {
          saveConversationToFirebase(nextConversation).catch((error) => {
            console.error("Failed to persist conversation update:", error)
          })
        }
      });

      await loadConversations()
    } catch (error) {
      console.error('Failed to send message:', error)
      // Remove optimistic messages on error
      const reverted = {
        ...currentConversation,
        messages: currentConversation.messages,
      }
      setCurrentConversation(reverted)
      await saveConversationToFirebase(reverted)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        {storageError && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {storageError}
          </div>
        )}
        <ChatInterface
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

export default App
