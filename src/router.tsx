import {
    Router,
    Route,
    RootRoute,
} from "@tanstack/react-router";

import AppLayout from "./AppLayout"
import HomePage from "./pages/HomePage";
import DragPanelDemo from "./pages/ReservationPanelDemo";


const rootRoute = new RootRoute({
    component: AppLayout,
});

const HomeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HomePage,
})

const dragRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/reservation",
    component: DragPanelDemo,
})


const routeTree = rootRoute.addChildren([HomeRoute, dragRoute])


export const router = new Router ({routeTree})

// for type safety 
declare module "@tanstack/react-router" {    
    interface Register {
        router : typeof router;
    }
}

