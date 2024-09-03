import App from "@/App";
import Debug from "@/components/Debug";

export const routes = [
    {
      path: "/",
      element: <App />,
    },
    {
      path: "/debug",
      element: <Debug />
    }
  ]