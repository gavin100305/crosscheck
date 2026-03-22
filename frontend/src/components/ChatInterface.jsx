import { useEffect, useRef, useState } from "react"

import MarkdownRenderer from "@/components/MarkdownRenderer"
import Stage1 from "@/components/Stage1"
import Stage2 from "@/components/Stage2"
import Stage3 from "@/components/Stage3"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
}) {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      onSendMessage(input)
      setInput("")
    }
  }

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (!conversation) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Welcome to crosscheck.</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create a conversation from the sidebar and send a question to start the 3-stage review.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-background">
      <ScrollArea className="h-[calc(100vh-170px)] px-4 py-4 md:px-6">
        {conversation.messages.length === 0 ? (
          <Card className="mx-auto mt-10 max-w-3xl">
            <CardHeader>
              <CardTitle>Start a conversation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Ask your question and Crosscheck will run all three stages: responses, peer ranking, and synthesis.
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {conversation.messages.map((msg, index) => (
              <div key={`${msg.role}-${index}`} className="flex flex-col gap-3">
                {msg.role === "user" ? (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm">You</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MarkdownRenderer content={msg.content} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm">Crosscheck</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {msg.loading?.stage1 && (
                        <div className="text-sm text-muted-foreground">Running Stage 1...</div>
                      )}
                      {msg.stage1 && <Stage1 responses={msg.stage1} />}

                      {msg.loading?.stage2 && (
                        <div className="text-sm text-muted-foreground">Running Stage 2...</div>
                      )}
                      {msg.stage2 && (
                        <Stage2
                          rankings={msg.stage2}
                          labelToModel={msg.metadata?.label_to_model}
                          aggregateRankings={msg.metadata?.aggregate_rankings}
                        />
                      )}

                      {msg.loading?.stage3 && (
                        <div className="text-sm text-muted-foreground">Running Stage 3...</div>
                      )}
                      {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}

            {isLoading && <div className="text-sm text-muted-foreground">Consulting models...</div>}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <Separator />
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl p-4 md:px-6">
        <div className="relative">
          <Textarea
            placeholder="Ask your question... (Shift+Enter for newline, Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={4}
            className="no-scrollbar pr-20"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="absolute bottom-2 right-2"
          >
            Send
          </Button>
        </div>
      </form>
    </main>
  )
}
