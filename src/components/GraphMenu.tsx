import React, { useId } from 'react';
import { Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { CheckboxRow } from "@/components/ui/setting";

interface GraphMenuProps {
    maxValue: number;
    value: number;
    onChange: (value: number) => void;
    uniqueStudentMode: boolean;
    // Optional props for sequence filter checkbox
    showSlider?: boolean;
    showSequenceFilter?: boolean;
    showOnlySequenceStudents?: boolean;
    onSequenceFilterChange?: (value: boolean) => void;
    // Optional props for node coloring checkbox
    showNodeColoringOption?: boolean;
    colorNodesBySequence?: boolean;
    onNodeColoringChange?: (value: boolean) => void;
}

/**
 * Per-graph settings, hung in the corner of a graph panel.
 *
 * Built on the Popover primitive rather than a hand-rolled `isOpen` div: that
 * version had no outside-click or Escape dismissal, left no focus behind when
 * it closed, and — because it was an absolutely-positioned child of the graph
 * box — got clipped by the box's own bounds. Popover portals out of it.
 */
const GraphMenu: React.FC<GraphMenuProps> = ({
    maxValue,
    value,
    onChange,
    uniqueStudentMode,
    showSlider = true,
    showSequenceFilter = false,
    showOnlySequenceStudents = true,
    onSequenceFilterChange,
    showNodeColoringOption = false,
    colorNodesBySequence = true,
    onNodeColoringChange
}) => {
    // One GraphMenu is rendered per graph panel, so ids must be instance-scoped.
    const uid = useId();

    const handleSliderChange = (newValue: number[]) => {
        onChange(newValue[0]);
    };

    const unitLabel = uniqueStudentMode ? 'students' : 'visits';
    const showCheckboxes = Boolean(
        (showSequenceFilter && onSequenceFilterChange) ||
        (showNodeColoringOption && onNodeColoringChange)
    );

    return (
        <div className="absolute left-2 top-2 z-10">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Graph settings"
                        title="Graph settings"
                        className="h-7 w-7 bg-background shadow-sm"
                    >
                        <Settings className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 space-y-3">
                    {showSequenceFilter && onSequenceFilterChange && (
                        <CheckboxRow
                            id={`${uid}-sequence-filter`}
                            label="Only students on this path"
                            hint="Restrict edge counts to students who followed the selected sequence."
                            checked={showOnlySequenceStudents}
                            onCheckedChange={onSequenceFilterChange}
                        />
                    )}

                    {showNodeColoringOption && onNodeColoringChange && (
                        <CheckboxRow
                            id={`${uid}-node-coloring`}
                            label="Color nodes by sequence position"
                            checked={colorNodesBySequence}
                            onCheckedChange={onNodeColoringChange}
                        />
                    )}

                    {showCheckboxes && showSlider && <Separator />}

                    {showSlider && (
                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="field-label">Min {unitLabel}</span>
                                <span className="text-sm font-semibold tabular-nums">{value}</span>
                            </div>
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
                            <p className="field-hint">
                                Hide edges taken by fewer than this many {unitLabel}.
                            </p>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default GraphMenu;
