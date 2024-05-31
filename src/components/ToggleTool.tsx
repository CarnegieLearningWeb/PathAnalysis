import { Toggle } from "@/components/ui/toggle"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
  } from "@/components/ui/hover-card"


import { Clock1, Eye, Settings, Layers, Map, Search, Info, Filter, List, Grid, Plus, Minus, Edit, Trash, Download, Upload, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";


interface ToggleToolProps {
    onStateChange?: (newState: boolean) => void;
    toolName: string;
    description: string;
    icon?: "clock" | "eye" | "camera" | "settings" | "layers" | "map" | "search" | "info" | "filter" | "list" | "grid" | "plus" | "minus" | "edit" | "trash" | "download" | "upload" | "check" | "x" | "arrow-up" | "arrow-down" | "arrow-left" | "arrow-right" | "arrow-up-right" | "arrow-up-left" | "arrow-down-right" | "arrow-down-left" | "arrow-up-down" | "arrow-left-right" | "arrow-up-down-left" | "arrow-up-down-right" | "arrow-up-right-down" | "arrow-down-right-left" | "arrow-up-left-right" | "arrow-up-right-left" | "arrow-up-down-left-right" | "arrow-up-down-right-left" | "arrow-up-right-down-left" | "arrow-down-right-up-left" | "arrow-up-down-right-left" | "arrow-up-down-left-right" | "arrow-up-right-down-left" | "arrow-up-down-right-left" | "arrow-up-down-left-right";
    initialState?: boolean;
    textVisible?: boolean;
    buttonMode?: boolean;
    disabled?: boolean;
}
export default function ToggleTool({ toolName, description, onStateChange, icon, initialState, textVisible = true, buttonMode = false, disabled = false }: ToggleToolProps) {
    if (!icon) {
        icon = "clock"
    }
    const [state, setState] = useState(false || initialState);
    useEffect(() => {
        if (initialState !== undefined) {
            setState(initialState);
        }
    }, [initialState]);

    const handleToggleChange = () => {
        const newState = !state;
        setState(newState);
        if (onStateChange) {
            onStateChange(newState);
        }
    };
    const iconSize = "h-5 w-5"
    const getIcon = () => {
        switch (icon) {
            case "clock":
                return <Clock1 className={iconSize} />;
            case "eye":
                return <Eye className={iconSize} />;
            case "settings":
                return <Settings className={iconSize} />;
            case "layers":
                return <Layers className={iconSize} />;
            case "map":
                return <Map className={iconSize} />;
            case "search":
                return <Search className={iconSize} />;
            case "info":
                return <Info className={iconSize} />;
            case "filter":
                return <Filter className={iconSize} />;
            case "list":
                return <List className={iconSize} />;
            case "grid":
                return <Grid className={iconSize} />;
            case "plus":
                return <Plus className={iconSize} />;
            case "minus":
                return <Minus className={iconSize} />;
            case "edit":
                return <Edit className={iconSize} />;
            case "trash":
                return <Trash className={iconSize} />;
            case "download":
                return <Download className={iconSize} />;
            case "upload":
                return <Upload className={iconSize} />;
            case "camera":
                return <Camera className={iconSize} />;

            default:
                return <Clock1 className={iconSize} />;
        }
    };

    return (
        <>

            {buttonMode ? (
                <>
                    <Button
                        variant={"outline"}
                        className={""}
                        onClick={handleToggleChange}
                        disabled={disabled}
                    >
                        {getIcon()}
                    </Button>
                </>
            ) :
                (
                    <>
                        <div className={disabled ? "disabled cursor-not-allowed bg-gray-400" : ""}>
                            <HoverCard>
                                <HoverCardTrigger>
                                    <Toggle
                                        variant={"outline"}
                                        defaultChecked={state}
                                        onPressedChange={handleToggleChange}
                                    >
                                        {getIcon()}
                                    </Toggle>
                                    {textVisible && (
                                        <div className="text-xs w-1 text-center flex">
                                            {toolName}
                                        </div>
                                    )}

                                </HoverCardTrigger>
                                <HoverCardContent
                                    className="bg-slate-100 p-2 border-2 border-black rounded-md shadow-lg"
                                >
                                    <div >
                                        <div className="font-semibold">
                                            {toolName} {" "}
                                            <span className="font-extrabold border border-black rounded-lg p-1 bg-slate-500 text-white hover:bg-slate-600">
                                                {state ? "Enabled" : "Disabled"}
                                            </span>

                                        </div>
                                        <div className="">
                                            {description}
                                        </div>

                                    </div>

                                </HoverCardContent>
                            </HoverCard>


                        </div>
                    </>

                )}


        </>
    )
}