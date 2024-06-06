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


export function NavBar() {
    return (
        <div className="bg-slate-200 p-1">
            <NavigationMenu>
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger>File</NavigationMenuTrigger>
                        <NavigationMenuContent>
                            <AlertDialog>
                                <AlertDialogTrigger>
                                    <div
                                        className="p-5 w-[150px]"
                                    >
                                        Upload Data
                                    </div>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Upload Data
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>

                                            {/* TODO add dropzone here as modal and handle data in global context */}
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