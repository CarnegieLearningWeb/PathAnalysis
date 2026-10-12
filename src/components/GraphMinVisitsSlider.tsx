import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface GraphMinVisitsSliderProps {
    maxValue: number;
    value: number;
    onChange: (value: number) => void;
    uniqueStudentMode: boolean;
}

/**
 * Inline, collapsible min-visits threshold for a single graph. Same tokens and
 * type scale as GraphMenu's slider block, so the two read as one control in
 * two placements.
 */
const GraphMinVisitsSlider: React.FC<GraphMinVisitsSliderProps> = ({
    maxValue,
    value,
    onChange,
    uniqueStudentMode
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSliderChange = (newValue: number[]) => {
        onChange(newValue[0]);
    };

    const unitLabel = uniqueStudentMode ? 'students' : 'visits';

    return (
        <div className="my-2 w-full rounded-md border bg-card shadow-sm">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                <span className="field-label">Min {unitLabel}</span>
                <span className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">{value}</span>
                    <ChevronDown
                        aria-hidden
                        className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                        )}
                    />
                </span>
            </button>

            {isExpanded && (
                <div className="space-y-2 border-t px-3 py-2.5">
                    <Slider
                        min={0}
                        max={maxValue}
                        step={1}
                        value={[value]}
                        onValueChange={handleSliderChange}
                        thumbLabel={`Minimum ${unitLabel} per edge`}
                    />
                    <div className="flex justify-between field-hint tabular-nums">
                        <span>0</span>
                        <span>{maxValue}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GraphMinVisitsSlider;
