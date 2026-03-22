import { useMemo, useState } from "react"

import MarkdownRenderer from "@/components/MarkdownRenderer"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text

  let result = text
  // Replace each "Response X" with the actual model name
  Object.entries(labelToModel).forEach(([label, model]) => {
    const modelShortName = model.split('/')[1] || model
    result = result.replace(new RegExp(label, 'g'), `**${modelShortName}**`)
  })
  return result
}

export default function Stage2({ rankings, labelToModel, aggregateRankings }) {
  const [activeTab, setActiveTab] = useState("")

  const firstModel = useMemo(() => {
    if (!rankings || rankings.length === 0) {
      return ""
    }
    return rankings[0].model
  }, [rankings])

  const currentTab = activeTab || firstModel

  if (!rankings || rankings.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage 2: Peer Rankings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Model names are shown for readability; source evaluations are anonymized in the prompt.
        </p>

        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3 flex w-full flex-wrap gap-1">
            {rankings.map((rank) => (
              <TabsTrigger key={rank.model} value={rank.model}>
                {rank.model.split("/")[1] || rank.model}
              </TabsTrigger>
            ))}
          </TabsList>

          {rankings.map((rank) => (
            <TabsContent key={rank.model} value={rank.model} className="space-y-3">
              <div className="text-xs text-muted-foreground">{rank.model}</div>
              <MarkdownRenderer content={deAnonymizeText(rank.ranking, labelToModel)} />

              {rank.parsed_ranking && rank.parsed_ranking.length > 0 && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <div className="text-sm font-medium">Extracted ranking</div>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {rank.parsed_ranking.map((label, i) => (
                      <li key={`${label}-${i}`}>
                        {labelToModel && labelToModel[label]
                          ? labelToModel[label].split("/")[1] || labelToModel[label]
                          : label}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {aggregateRankings && aggregateRankings.length > 0 && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Aggregate rankings</div>
            <div className="flex flex-col gap-2">
              {aggregateRankings.map((agg, index) => (
                <div
                  key={`${agg.model}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    <span className="text-sm font-medium">{agg.model.split("/")[1] || agg.model}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Avg {agg.average_rank.toFixed(2)} ({agg.rankings_count} votes)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
