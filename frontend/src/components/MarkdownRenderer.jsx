import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

function mapOutsideCodeFences(text, transform) {
  const lines = text.split("\n")
  let inFence = false
  let buffer = []
  const out = []

  const flush = () => {
    if (buffer.length === 0) return
    out.push(transform(buffer.join("\n")))
    buffer = []
  }

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith("```")) {
      flush()
      inFence = !inFence
      out.push(line)
      continue
    }

    if (inFence) {
      out.push(line)
      continue
    }

    buffer.push(line)
  }

  flush()
  return out.join("\n")
}

function normalizeLatexOutsideCodeFences(text) {
  return mapOutsideCodeFences(text, (chunk) => {
    let out = chunk

    // Convert double-escaped LaTeX commands like \\frac -> \frac
    out = out.replace(/\\\\([a-zA-Z])/g, "\\$1")

    // Convert \( ... \) into inline $ ... $
    out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => {
      const body = String(inner ?? "").trim()
      return body ? `$${body}$` : ""
    })

    // Convert \[ ... \] into block $$ ... $$
    out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
      const body = String(inner ?? "").trim()
      if (!body) return ""
      return `\n\n$$\n${body}\n$$\n\n`
    })

    return out
  })
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

  cleaned = normalizeLatexOutsideCodeFences(cleaned)

  return cleaned.trim()
}

export default function MarkdownRenderer({ content }) {
  const normalized = normalizeMarkdown(content)

  return (
    <div className="markdown-content text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ className, ...props }) => (
            <p className={["my-2", className].filter(Boolean).join(" ")} {...props} />
          ),
          h1: ({ className, ...props }) => (
            <h1
              className={["mb-2 mt-4 text-base font-semibold", className]
                .filter(Boolean)
                .join(" ")}
              {...props}
            />
          ),
          h2: ({ className, ...props }) => (
            <h2
              className={["mb-2 mt-4 text-sm font-semibold", className]
                .filter(Boolean)
                .join(" ")}
              {...props}
            />
          ),
          h3: ({ className, ...props }) => (
            <h3
              className={["mb-2 mt-4 text-sm font-medium", className]
                .filter(Boolean)
                .join(" ")}
              {...props}
            />
          ),
          ul: ({ className, ...props }) => (
            <ul className={["my-2 list-disc pl-5", className].filter(Boolean).join(" ")} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={["my-2 list-decimal pl-5", className].filter(Boolean).join(" ")} {...props} />
          ),
          li: ({ className, ...props }) => (
            <li className={["my-1", className].filter(Boolean).join(" ")} {...props} />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote
              className={["my-2 border-l-2 border-border pl-3 text-muted-foreground", className]
                .filter(Boolean)
                .join(" ")}
              {...props}
            />
          ),
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
