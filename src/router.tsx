import {
    Router,
    Route,
    RootRoute,
    Outlet
} from "@tanstack/react-router";

import AppLayout from "./AppLayout"
import HomePage from "./pages/HomePage";
import DragPanelDemo from "./pages/ReservationPanelDemo";
import ReservationsPage from "./pages/ReservationsPage";
import ChosePageMode from "./pages/ChoosePageMode";


const rootRoute = new RootRoute({
    component: AppLayout,
});

const HomeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HomePage,
})


const adminRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component:() => <Outlet />,
})

const adminChooseRoute = new Route({
    getParentRoute: () => adminRoute,
    path: "/", // Renders at /admin
    component: ChosePageMode,
})


const adminPanelRoute = new Route({
    getParentRoute: () => adminRoute,
    path: "/panel",
    component: DragPanelDemo,
})


const adminReservationRoute = new Route({
    getParentRoute: () => adminRoute,
    path: "/reservations",
    component: ReservationsPage,
})



const clientRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/client/$clientId",
    component:() => <Outlet />,
})

const clientChooseRoute = new Route({
    getParentRoute: () => clientRoute,
    path: "/",
    component: ChosePageMode,
})


const clientPanelRoute = new Route({
    getParentRoute: () => clientRoute,
    path: "/panel",
    component: DragPanelDemo,
})


const clientReservationRoute = new Route({
    getParentRoute: () => clientRoute,
    path: "/reservations",
    component: ReservationsPage,
})


const routeTree = rootRoute.addChildren([
    HomeRoute,
    adminRoute.addChildren([adminChooseRoute, adminPanelRoute, adminReservationRoute]),
    clientRoute.addChildren([clientChooseRoute, clientPanelRoute, clientReservationRoute])
])


export const router = new Router ({routeTree})

// for type safety 
declare module "@tanstack/react-router" {    
    interface Register {
        router : typeof router;
    }
}

