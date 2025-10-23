import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import React from "react";

export default function AppLayout() {
  const { location } = useRouterState();
  const isHome = location.pathname === "/";
  const mainClasses = [
    "mx-auto flex w-full flex-1 flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-10",
    isHome ? "max-w-5xl" : "max-w-none",
  ].join(" ");

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link
              to="/"
              aria-label="Back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              <span className="text-lg leading-none">←</span>
            </Link>
          )}
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
              NeutroReserve
            </p>
            <p className="text-lg font-semibold text-white">
              {isHome ? "Overview" : "Reservation Planner"}
            </p>
          </div>
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-600">
          Restaurant Suite
        </div>
      </header>
      <main className={mainClasses}>
        <Outlet />
      </main>
    </div>
  );
}
