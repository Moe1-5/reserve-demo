import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { ArrowLeft, Plus, LayoutGrid } from "lucide-react";
import { addFloor, setActiveFloor, demoStore } from "./lib/demoStore";

export default function AppLayout() {
  const { location } = useRouterState();
  const { floors, activeFloorId, mode } = useStore(demoStore);

  const isHome = location.pathname === "/";
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isClientRoute = location.pathname.startsWith("/client");

  // Detect if we are in the visual editor (Panel)
  const isPanel = location.pathname.includes("/panel");

  // Show floor controls only on Panel pages
  const showFloorControls = isPanel && (isAdminRoute || isClientRoute);
  const isAdmin = mode === "admin";

  const handleAddFloor = () => {
    if (!isAdmin) return;
    const newId = addFloor();
    setActiveFloor(newId);
  };

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900">
      {/* HEADER */}
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8 z-50 shadow-sm relative">
        <div className="flex items-center justify-between h-10">
          {/* Left: Branding & Back Button */}
          <div className="flex min-w-[100px] sm:min-w-[200px] items-center gap-4">
            {!isHome && (
              <Link
                to="/"
                aria-label="Back"
                className="group inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition hover:border-gray-300 hover:bg-white hover:text-gray-900 shadow-sm"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </Link>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white shadow-md">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div className="leading-none hidden sm:block">
                {" "}
                {/* Hidden on mobile */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  NeuroReserve
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {isHome
                    ? "Dashboard"
                    : isAdmin
                    ? "Admin Portal"
                    : "Client View"}
                </p>
              </div>
            </div>
          </div>

          {/* Center: Floor Controls (Floating Pills) */}
          {showFloorControls && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-0.5 shadow-sm max-w-[200px] sm:max-w-none overflow-x-auto no-scrollbar">
                {floors.map((floor) => {
                  const isActive = floor.id === activeFloorId;
                  return (
                    <button
                      key={floor.id}
                      type="button"
                      onClick={() => setActiveFloor(floor.id)}
                      className={[
                        "inline-flex items-center rounded-full px-3 py-1 text-[10px] sm:text-[11px] font-semibold transition-all whitespace-nowrap",
                        isActive
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
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
                    className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-emerald-600 flex-shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right Spacer (for balance) */}
          <div className="min-w-[100px] sm:min-w-[200px] flex justify-end">
            {/* Optional: Add User Profile or Logout here */}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main
        className={[
          "flex-1 w-full",
          isPanel
            ? "overflow-hidden relative bg-gray-50"
            : "overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}
