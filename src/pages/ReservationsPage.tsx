import React from "react";
import { CalendarClock, CalendarDays, CalendarX2, UsersRound } from "lucide-react";
import { useFloorData } from "../lib/useFloorData";

type ReservationWithMeta = {
  id: string;
  tableId: string;
  date: string;
  slot: string;
  name: string;
  partySize: number;
  floorName: string;
  tableName: string;
  chairs: number | null;
  color: string | null;
  datetime: Date;
};

type ReservationTab = "today" | "upcoming" | "past";

const tabs: Array<{ id: ReservationTab; label: string; icon: React.ReactNode }> = [
  { id: "today", label: "Today", icon: <CalendarDays className="h-4 w-4" /> },
  { id: "upcoming", label: "Upcoming", icon: <CalendarClock className="h-4 w-4" /> },
  { id: "past", label: "Past", icon: <CalendarX2 className="h-4 w-4" /> },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export default function ReservationsPage() {
  const { floors } = useFloorData();
  const [activeTab, setActiveTab] = React.useState<ReservationTab>("today");

  const reservations = React.useMemo<ReservationWithMeta[]>(() => {
    const all: ReservationWithMeta[] = [];

    for (const floor of floors) {
      const tableMap = new Map(floor.tables.map((table) => [table.id, table]));
      for (const reservation of floor.reservations) {
        const table = tableMap.get(reservation.tableId);
        const dateTime = new Date(`${reservation.date}T${reservation.slot}:00`);
        all.push({
          ...reservation,
          floorName: floor.name,
          tableName: table?.name ?? "Table",
          chairs: table?.chairs ?? null,
          color: table?.color ?? null,
          datetime: dateTime,
        });
      }
    }

    return all;
  }, [floors]);

  const categorized = React.useMemo(() => {
    const tomorrow = new Date().getDate() + 1;
    const startOfTomorrow = new Date(tomorrow);
    startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfToday = new Date(tomorrow);
    endOfToday.setHours(23, 59, 59, 999);

    const today: ReservationWithMeta[] = [];
    const upcoming: ReservationWithMeta[] = [];
    const past: ReservationWithMeta[] = [];

    reservations.forEach((reservation) => {
      if (reservation.datetime < startOfTomorrow) {
        past.push(reservation);
      } else if (reservation.datetime > endOfToday) {
        upcoming.push(reservation);
      } else {
        today.push(reservation);
      }
    });

    today.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    upcoming.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    past.sort((a, b) => b.datetime.getTime() - a.datetime.getTime());

    return { today, upcoming, past };
  }, [reservations]);

  const displayed = React.useMemo(() => {
    return categorized[activeTab];
  }, [categorized, activeTab]);

  const totalCount = reservations.length;
  const hasReservations = totalCount > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Reservations</h1>
          <p className="mt-2 text-sm text-slate-300">
            Review upcoming reservations across every floor. Tabs help you quickly filter by time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition",
                  isActive
                    ? "border-emerald-400 bg-emerald-500/90 text-slate-950 shadow"
                    : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-emerald-400 hover:text-white",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
                <span className="ml-1 text-xs text-slate-800/70">
                  {categorized[tab.id].length}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="text-sm text-slate-300">
            Showing <span className="font-semibold text-white">{activeTab}</span> reservations
            ({displayed.length})
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-600">
            Total saved: {totalCount}
          </div>
        </header>

        <div className="divide-y divide-slate-800">
          {hasReservations && displayed.length === 0 ? (
            <EmptyState message="Nothing in this timeframe yet. New reservations will appear here automatically." />
          ) : null}

          {!hasReservations ? (
            <EmptyState message="You have no reservations yet. Start planning and they'll be listed here." />
          ) : null}

          {displayed.map((reservation) => (
            <article
              key={reservation.id}
              className="flex flex-col gap-4 px-6 py-5 text-slate-200 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.25em]"
                    style={
                      reservation.color
                        ? {
                            borderColor: reservation.color,
                            color: reservation.color,
                          }
                        : undefined
                    }
                  >
                    {reservation.floorName}
                  </span>
                  <span className="text-sm text-slate-400">
                    Table&nbsp;
                    <span className="font-semibold text-white">{reservation.tableName}</span>
                    {typeof reservation.chairs === "number"
                      ? ` · ${reservation.chairs} seats`
                      : null}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-slate-200">
                    <CalendarDays className="h-4 w-4" />
                    {dateFormatter.format(reservation.datetime)}
                    <span className="text-slate-500">·</span>
                    {timeFormatter.format(reservation.datetime)}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-slate-200">
                    <UsersRound className="h-4 w-4" />
                    Party of {reservation.partySize}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-right text-sm">
                <span className="font-semibold text-white">{reservation.name}</span>
                <span className="text-xs text-slate-500">Reservation #{reservation.id}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-slate-400">
      <CalendarDays className="h-8 w-8 text-slate-600" />
      <p>{message}</p>
    </div>
  );
}

