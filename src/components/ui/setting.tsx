import * as React from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * Shared building blocks for the control panel.
 *
 * Every toggle in this app used to be hand-assembled from a bare `<label>`, a
 * custom switch with no `id`, and an ad-hoc `<p className="text-xs ...">`, so
 * spacing, type scale and label association all drifted per row. These three
 * components are the single definition of a settings row: one grid, one type
 * scale, real `htmlFor`/`aria-describedby` wiring.
 */

interface SettingGroupProps extends React.HTMLAttributes<HTMLFieldSetElement> {
  /** Small-caps group heading, e.g. "Node & edge colour". */
  title: string
  /** Optional one-liner explaining what the group as a whole governs. */
  hint?: React.ReactNode
}

/**
 * A semantic grouping of related settings. Uses fieldset/legend so assistive
 * tech announces the group name when focus enters any control inside it.
 */
const SettingGroup = React.forwardRef<HTMLFieldSetElement, SettingGroupProps>(
  ({ className, title, hint, children, ...props }, ref) => (
    <fieldset ref={ref} className={cn("min-w-0", className)} {...props}>
      <legend className="field-label">{title}</legend>
      {hint ? <p className="field-hint mt-1">{hint}</p> : null}
      <div className="mt-2 divide-y divide-border">{children}</div>
    </fieldset>
  )
)
SettingGroup.displayName = "SettingGroup"

interface SettingRowShellProps {
  htmlFor: string
  label: React.ReactNode
  hint?: React.ReactNode
  hintId?: string
  /** Rendered on the right, vertically aligned to the label's first line. */
  control: React.ReactNode
  muted?: boolean
  className?: string
}

function SettingRowShell({
  htmlFor,
  label,
  hint,
  hintId,
  control,
  muted,
  className,
}: SettingRowShellProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2.5", className)}>
      <div className="min-w-0 space-y-1">
        <Label
          htmlFor={htmlFor}
          className={cn(
            "block cursor-pointer text-sm leading-tight",
            muted && "cursor-not-allowed text-muted-foreground"
          )}
        >
          {label}
        </Label>
        {hint ? (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center pt-0.5">{control}</div>
    </div>
  )
}

interface SwitchRowProps {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Shown in place of `hint` while disabled, to explain *why* it is disabled. */
  disabledHint?: React.ReactNode
  className?: string
}

/** Label + help text on the left, switch on the right. */
function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
  disabledHint,
  className,
}: SwitchRowProps) {
  const hintId = `${id}-hint`
  const shownHint = disabled && disabledHint ? disabledHint : hint
  return (
    <SettingRowShell
      htmlFor={id}
      label={label}
      hint={shownHint}
      hintId={shownHint ? hintId : undefined}
      muted={disabled}
      className={className}
      control={
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-describedby={shownHint ? hintId : undefined}
        />
      }
    />
  )
}

interface CheckboxRowProps {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/** Checkbox first, then label + optional help text. For set membership. */
function CheckboxRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: CheckboxRowProps) {
  const hintId = `${id}-hint`
  return (
    <div
      className={cn(
        "flex gap-2",
        // Hintless rows are used inline in the toolbar, where centring reads
        // better; rows with help text align to the label's first line.
        hint ? "items-start" : "items-center",
        className
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onCheckedChange={(value: boolean | "indeterminate") =>
          onCheckedChange(value === true)
        }
        className={cn(hint && "mt-0.5")}
      />
      <div className="min-w-0 space-y-1">
        <Label
          htmlFor={id}
          className={cn(
            "block cursor-pointer text-sm leading-tight",
            disabled && "cursor-not-allowed text-muted-foreground"
          )}
        >
          {label}
        </Label>
        {hint ? (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { SettingGroup, SwitchRow, CheckboxRow }
