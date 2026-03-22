import MarkdownRenderer from "@/components/MarkdownRenderer"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Stage3({ finalResponse }) {
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
          Synthesized by: {finalResponse.model.split("/")[1] || finalResponse.model}
        </Badge>
        <MarkdownRenderer content={finalResponse.response} />
      </CardContent>
    </Card>
  )
}
