import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Radix-backed switch. Replaces the hand-rolled div/button switch that used to
 * live here (and in `src/components/switch.tsx`): that one had no `id`, so it
 * could not be associated with a label, and its hidden `<label>` shell made it
 * unreachable by clicking the visible text.
 *
 * Radix renders a real `<button role="switch">` with a paired hidden checkbox,
 * so Space/Enter toggle it, `htmlFor` works, and disabled state is announced.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-40",
      // slate-400 rather than the usual bg-input: the white thumb needs to read
      // against the track for "off" to be legible without relying on position.
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-400",
      className
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow ring-0",
        "transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
