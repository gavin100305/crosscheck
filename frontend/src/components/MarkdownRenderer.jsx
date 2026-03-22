import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

function normalizeLatexEscapesOutsideCodeFences(text) {
  const lines = text.split("\n")
  let inFence = false
  const out = []

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith("```")) {
      inFence = !inFence
      out.push(line)
      continue
    }

    if (inFence) {
      out.push(line)
      continue
    }

    // Convert double-escaped LaTeX commands like \\frac -> \frac
    out.push(line.replace(/\\\\([a-zA-Z])/g, "\\$1"))
  }

  return out.join("\n")
}

function normalizeMarkdown(text) {
  if (!text) {
    return ""
  }

  let cleaned = text

  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "")
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, "")
  cleaned = cleaned.replace(/\u00a0|\u202f/g, " ")
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n")

  cleaned = normalizeLatexEscapesOutsideCodeFences(cleaned)

  return cleaned.trim()
}

export default function MarkdownRenderer({ content }) {
  const normalized = normalizeMarkdown(content)

  return (
    <div className="markdown-content text-sm leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ ...props }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th className="bg-muted px-3 py-2 text-left font-medium" {...props} />
          ),
          td: ({ ...props }) => <td className="border-t border-border px-3 py-2" {...props} />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
