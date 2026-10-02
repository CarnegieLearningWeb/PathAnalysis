import * as React from "react"

import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  /** Native tooltip for the longer explanation, so the control stays compact. */
  title?: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
  /** Required: the visible caption above the control is not a <label>. */
  "aria-label"?: string
  "aria-labelledby"?: string
  className?: string
}

/**
 * Two-or-three-way exclusive choice, rendered as a joined segmented control.
 *
 * Preferred over a switch whenever *both* states are meaningful named options
 * (e.g. "unique students" vs "total visits"): a switch whose label text changes
 * with its own state cannot be read without first knowing the state.
 *
 * Radix's single-mode ToggleGroup allows deselection; this wrapper swallows the
 * empty value so the control can never end up with nothing selected.
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next: string) => {
        if (next) onValueChange(next as T)
      }}
      className={cn(
        "inline-flex gap-0.5 rounded-md border border-input bg-muted p-0.5",
        className
      )}
      {...aria}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          title={option.title}
          className={cn(
            "h-7 rounded-[0.25rem] px-2.5 text-xs font-medium text-muted-foreground",
            "hover:bg-background/60 hover:text-foreground",
            "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export { SegmentedControl }
