import React from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { ArrowLeft, Plus } from "lucide-react";
import { addFloor, demoStore, setActiveFloor, setPlannerMode } from "./lib/demoStore";

export default function AppLayout() {
  const { location } = useRouterState();
  const { floors, activeFloorId, mode } = useStore(demoStore);
  
  const isHome = location.pathname === "/";
  const isPlannerRoute =
    location.pathname === "/reservation" || location.pathname.startsWith("/reservation/");
  const isReservationsRoute =
    location.pathname === "/reservations" || location.pathname.startsWith("/reservations/");
  const showNavLinks = isPlannerRoute || isReservationsRoute;
  const isAdmin = mode === "admin";
  const showFloorControls = isPlannerRoute && (mode === "admin" || mode === "client");
  const headerTitle = isHome
    ? "Overview"
    : isPlannerRoute
    ? "Reservation Planner"
    : isReservationsRoute
    ? "Reservations"
    : "NeutroReserve";

  const handleAddFloor = () => {
    if (!isAdmin) {
      return;
    }
    const newId = addFloor();
    setActiveFloor(newId);
  };

  React.useEffect(() => {
    setPlannerMode("pending");
  }, [isHome, isPlannerRoute]);
  
  const mainClasses = [
    "mx-auto flex w-full flex-1 flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-10",
    isHome ? "max-w-5xl" : "max-w-none",
  ].join(" ");

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-800 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex min-w-[200px] flex-1 items-center gap-3">
          {!isHome && (
            <Link
              to="/"
              aria-label="Back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500">NeutroReserve</p>
            <p className="text-lg font-semibold text-white">{headerTitle}</p>
          </div>
        </div>
        <div className="flex flex-1 justify-center">
          {showFloorControls ? (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-200 shadow">
              {floors.map((floor) => {
                const isActive = floor.id === activeFloorId;
                return (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setActiveFloor(floor.id)}
                    className={[
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition",
                      isActive
                        ? "border-emerald-400 bg-emerald-500 text-slate-950"
                        : "border-slate-700 text-slate-200 hover:border-emerald-400 hover:text-white",
                    ].join(" ")}
                  >
                    {floor.name}
                  </button>
                );
              })}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleAddFloor}
                  aria-label="Add floor"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-emerald-400 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-[160px] flex-1 justify-end">
          {showNavLinks ? (
            <nav className="flex items-center gap-2">
              <Link
                to="/reservation"
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition",
                  isPlannerRoute
                    ? "border-emerald-400 bg-emerald-500 text-slate-950"
                    : "border-slate-700 text-slate-200 hover:border-emerald-400 hover:text-white",
                ].join(" ")}
              >
                Planner
              </Link>
              <Link
                to="/reservations"
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition",
                  isReservationsRoute
                    ? "border-emerald-400 bg-emerald-500 text-slate-950"
                    : "border-slate-700 text-slate-200 hover:border-emerald-400 hover:text-white",
                ].join(" ")}
              >
                Reservations
              </Link>
            </nav>
          ) : (
            <div className="text-xs uppercase tracking-[0.3em] text-slate-600">
              Restaurant Suite
            </div>
          )}
        </div>
      </header>
      <main className={mainClasses}>
        <Outlet />
      </main>
    </div>
  );
}
