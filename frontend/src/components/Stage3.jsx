import MarkdownRenderer from "@/components/MarkdownRenderer"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function modelLabel(model) {
  return model?.split("/")[1] || model || "Unknown model"
}

function LegacyStage3({ finalResponse }) {
  if (!finalResponse) {
    return null
  }

  return (
    <Card className="border-l-2 border-l-chart-3/50">
      <CardHeader>
        <CardTitle>Stage 3: Final Crosscheck Answer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badge variant="secondary">
          Synthesized by: {modelLabel(finalResponse.model)}
        </Badge>
        <MarkdownRenderer content={finalResponse.response} />
      </CardContent>
    </Card>
  )
}

export default function Stage3({ finalResponse, pipelineVersion }) {
  const isLegacy = !finalResponse?.final_response || pipelineVersion !== 2

  if (isLegacy) {
    return <LegacyStage3 finalResponse={finalResponse} />
  }

  const conclusion = finalResponse.final_response
  const judgeReviews = finalResponse.judge_reviews || []
  const finalRating = finalResponse.final_rating || {}

  return (
    <Card className="border-l-2 border-l-chart-3/50">
      <CardHeader>
        <CardTitle>Stage 3: Final Conclusion and Judge Ratings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Synthesizer: {modelLabel(conclusion?.model)}</Badge>
          <Badge variant="outline">
            Final rating: {finalRating.average_score_0_to_10 ?? 0}/10
          </Badge>
          <Badge variant="outline">{finalRating.label || "Unavailable"}</Badge>
          <Badge variant="outline">
            Judges responded: {finalRating.responding_judges ?? 0}
          </Badge>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-2 text-sm font-medium">Final answer</div>
          <MarkdownRenderer content={conclusion?.response || "No final answer available."} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {judgeReviews.length > 0 ? (
            judgeReviews.map((review) => (
              <div
                key={review.model}
                className="rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{modelLabel(review.model)}</Badge>
                  <Badge variant="outline">Overall {review.overall_score_0_to_10}/10</Badge>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Accuracy {review.accuracy_score}/10</span>
                  <span>Reasoning {review.reasoning_score}/10</span>
                  <span>Completeness {review.completeness_score}/10</span>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Verdict</div>
                  <MarkdownRenderer content={review.verdict || "No verdict provided."} />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">Concerns</div>
                  {review.concerns?.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {review.concerns.map((item, index) => (
                        <li key={`${review.model}-concern-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground">No major concerns raised.</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No judge reviews were available for this answer.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
