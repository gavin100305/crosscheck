import { useMemo, useState } from "react"

import MarkdownRenderer from "@/components/MarkdownRenderer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState("")

  const firstModel = useMemo(() => {
    if (!responses || responses.length === 0) {
      return ""
    }
    return responses[0].model
  }, [responses])

  const currentTab = activeTab || firstModel

  if (!responses || responses.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage 1: Individual Responses</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3 flex w-full flex-wrap gap-1">
            {responses.map((resp) => (
              <TabsTrigger key={resp.model} value={resp.model}>
                {resp.model.split("/")[1] || resp.model}
              </TabsTrigger>
            ))}
          </TabsList>

          {responses.map((resp) => (
            <TabsContent key={resp.model} value={resp.model}>
              <div className="mb-3 text-xs text-muted-foreground">{resp.model}</div>
              <MarkdownRenderer content={resp.response} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
