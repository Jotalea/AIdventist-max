import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"

export function Logo() {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" alignItems="center">
      <box flexDirection="row">
        <text fg={theme.textMuted} attributes={TextAttributes.BOLD} selectable={false}>
          {"chipotl"}
        </text>
        <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
          {"ai"}
        </text>
        <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
          {" max"}
        </text>
        <text selectable={false}>{" 🌯"}</text>
      </box>
    </box>
  )
}
