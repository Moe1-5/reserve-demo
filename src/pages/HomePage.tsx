import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Manage dining rooms.
          </h1>
          <p className="mt-4 text-slate-300">
            Lorem ipsum dolor, sit amet consectetur 
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              to="/reservation"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <LayoutDashboard className="h-5 w-5" />
              Reservation Panel
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
