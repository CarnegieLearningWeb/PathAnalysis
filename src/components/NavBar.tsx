import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuIndicator,
    NavigationMenuItem,
    // NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    // NavigationMenuViewport,
} from "@/components/ui/navigation-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
// import { useContext } from "react"
// import { Context } from "@/Context"
// import DropZone from "./DropZone"
// import { GlobalDataType } from "@/lib/types"

export function NavBar() {

    return (
        <div className="bg-slate-200 p-1">
            <NavigationMenu>
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger>Upload</NavigationMenuTrigger>
                        <NavigationMenuContent>
                            <AlertDialog>
                                <AlertDialogTrigger>
                                    <div
                                        className="p-5 w-[150px]"
                                    >
                                        Upload and Process Data
                                    </div>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Upload Data
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>

                                            {/* <DropZone
                                                afterDrop={() => { }}
                                                onLoadingChange={(loading) => {
                                                    setLoading(loading)
                                                }}
                                            /> */}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                        </NavigationMenuContent>
                    </NavigationMenuItem>
                    <NavigationMenuIndicator />
                </NavigationMenuList>
            </NavigationMenu>

        </div>
    )
}