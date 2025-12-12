import React from "react"; 
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { LayoutDashboard } from "lucide-react";
import { getCreateClientId, setPlannerMode, demoStore } from "../lib/demoStore";

export default function HomePage() {
  const navigate = useNavigate();
  const mode = useStore(demoStore, (state) => state.mode);

  const handleAdminClick = () =>{
    setPlannerMode("admin");
    navigate({to: "/admin"}); 
  }

  React.useEffect(() => {
  }, [mode])

  const handleClientClick = () => {
    setPlannerMode("client");
    const clientId = getCreateClientId();
    navigate({to: "/client/$clientId", params: {clientId}})
  }


  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Manage dining rooms.
          </h1>
          <p className="mt-4 text-slate-300">
            choose your role 
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <button
            onClick={handleAdminClick}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <LayoutDashboard className="h-5 w-5" />
              Admin
            </button>
            <button
              onClick={handleClientClick}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-white"
            >
              <LayoutDashboard className="h-5 w-5" />
              Client
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
