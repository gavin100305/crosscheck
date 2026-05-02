import { useMemo, useState } from "react"

import MarkdownRenderer from "@/components/MarkdownRenderer"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function modelLabel(model) {
  return model?.split("/")[1] || model || "Unknown model"
}

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text

  let result = text
  Object.entries(labelToModel).forEach(([label, model]) => {
    result = result.replace(new RegExp(label, "g"), `**${modelLabel(model)}**`)
  })
  return result
}

function LegacyRankings({ rankings, labelToModel, aggregateRankings }) {
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
    <Card className="border-l-2 border-l-chart-2/50">
      <CardHeader>
        <CardTitle>Stage 2: Peer Rankings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Model names are shown for readability; source evaluations are anonymized in the prompt.
        </p>

        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3 flex w-full flex-wrap gap-1">
            {rankings.map((rank) => (
              <TabsTrigger key={rank.model} value={rank.model}>
                {modelLabel(rank.model)}
              </TabsTrigger>
            ))}
          </TabsList>

          {rankings.map((rank) => (
            <TabsContent key={rank.model} value={rank.model} className="flex flex-col gap-3">
              <div className="text-xs text-muted-foreground">{rank.model}</div>
              <MarkdownRenderer content={deAnonymizeText(rank.ranking, labelToModel)} />

              {rank.parsed_ranking && rank.parsed_ranking.length > 0 && (
                <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="text-sm font-medium">Extracted ranking</div>
                  <ol className="list-decimal pl-5 text-sm [&>li]:mt-1">
                    {rank.parsed_ranking.map((label, i) => (
                      <li key={`${label}-${i}`}>
                        {labelToModel && labelToModel[label]
                          ? modelLabel(labelToModel[label])
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
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Aggregate rankings</div>
            <div className="flex flex-col gap-2">
              {aggregateRankings.map((agg, index) => (
                <div
                  key={`${agg.model}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    <span className="text-sm font-medium">{modelLabel(agg.model)}</span>
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

export default function Stage2({ rankings, labelToModel, aggregateRankings, pipelineVersion }) {
  const isLegacy = Array.isArray(rankings) || pipelineVersion !== 2

  if (isLegacy) {
    return (
      <LegacyRankings
        rankings={rankings}
        labelToModel={labelToModel}
        aggregateRankings={aggregateRankings}
      />
    )
  }

  const rounds = rankings?.rounds || []
  const audit = rankings?.audit_summary || {}

  return (
    <Card className="border-l-2 border-l-chart-2/50">
      <CardHeader>
        <CardTitle>Stage 2: Debate and Audit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {rounds.length === 0 ? (
          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            Debate was skipped because too few debaters responded. The audit below is based on the
            available answers.
          </div>
        ) : (
          rounds.map((round) => (
            <div key={round.round_number} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Round {round.round_number}</Badge>
                <span className="text-sm text-muted-foreground">
                  Focused peer critique and revised answers
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {(round.exchanges || []).map((exchange, index) => (
                  <div
                    key={`${exchange.critic_model}-${exchange.target_model}-${index}`}
                    className="rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{modelLabel(exchange.critic_model)}</Badge>
                      <span className="text-muted-foreground">challenged</span>
                      <Badge variant="outline">{modelLabel(exchange.target_model)}</Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Critique</div>
                        <MarkdownRenderer content={exchange.critique || "No critique available."} />
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Rebuttal</div>
                        <MarkdownRenderer content={exchange.rebuttal || "No rebuttal available."} />
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Revised answer</div>
                        <MarkdownRenderer
                          content={exchange.revised_response || "No revised answer available."}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">Audit summary</div>
            <Badge variant="secondary">
              Consensus: {audit.consensus_level || "unknown"}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Agreements</div>
              {audit.agreements?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {audit.agreements.map((item, index) => (
                    <li key={`agreement-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">No clear agreements recorded.</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Conflicts</div>
              {audit.conflicts?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {audit.conflicts.map((item, index) => (
                    <li key={`conflict-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">No major conflicts remained.</div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Unresolved risks</div>
              {audit.unresolved_risks?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {audit.unresolved_risks.map((item, index) => (
                    <li key={`risk-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">No unresolved risks were flagged.</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Recommendation</div>
              <MarkdownRenderer
                content={audit.recommendation || "No auditor recommendation was produced."}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
