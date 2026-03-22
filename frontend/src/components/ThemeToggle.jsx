import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons"

const STORAGE_KEY = "crosscheck-theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "dark" || saved === "light") {
      return saved
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
    localStorage.setItem(STORAGE_KEY, next)
  }

  const nextThemeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
  const nextThemeIcon = theme === "dark" ? Sun01Icon : Moon01Icon

  return (
    <Button
      aria-label={nextThemeLabel}
      className="text-foreground px-3"
      variant="secondary"
      size="md"
      onClick={toggleTheme}
    >
      <HugeiconsIcon icon={nextThemeIcon} />
    </Button>
  )
}
