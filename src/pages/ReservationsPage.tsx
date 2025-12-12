import React from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  UsersRound,
  History,
} from "lucide-react";
import { useFloorData } from "../lib/useFloorData";
import { useStore } from "@tanstack/react-store";
import { demoStore, loadClientReservations } from "../lib/demoStore";

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

const tabs: Array<{
  id: ReservationTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "today", label: "Today", icon: <CalendarDays className="h-4 w-4" /> },
  {
    id: "upcoming",
    label: "Upcoming",
    icon: <CalendarClock className="h-4 w-4" />,
  },
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
  const mode = useStore(demoStore, (state) => state.mode);

  const clientId = React.useMemo(() => {
    if (mode === "client") {
      const pathParts = window.location.pathname.split("/");
      const clientIndex = pathParts.indexOf("client");
      if (clientIndex !== -1 && pathParts[clientIndex + 1]) {
        return pathParts[clientIndex + 1];
      }
    }
    return null;
  }, [mode]);

  const clientReservations = React.useMemo(() => {
    if (mode === "client" && clientId) {
      return loadClientReservations(clientId);
    }
    return [];
  }, [mode, clientId]);

  const reservations = React.useMemo<ReservationWithMeta[]>(() => {
    const all: ReservationWithMeta[] = [];

    if (mode === "client" && clientReservations.length >= 0) {
      for (const reservation of clientReservations) {
        for (const floor of floors) {
          const table = floor.tables.find((t) => t.id === reservation.tableId);
          if (table) {
            const dateTime = new Date(
              `${reservation.date}T${reservation.slot}:00`
            );
            all.push({
              ...reservation,
              floorName: floor.name,
              tableName: table.name,
              chairs: table.chairs,
              color: table.color,
              datetime: dateTime,
            });
            break;
          }
        }
      }
    } else {
      for (const floor of floors) {
        const tableMap = new Map(
          floor.tables.map((table) => [table.id, table])
        );
        for (const reservation of floor.reservations) {
          if (
            mode === "client" &&
            clientId &&
            reservation.clientId !== clientId
          ) {
            continue;
          }
          const table = tableMap.get(reservation.tableId);
          const dateTime = new Date(
            `${reservation.date}T${reservation.slot}:00`
          );
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
    }
    return all;
  }, [floors, mode, clientId, clientReservations]);

  const categorized = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const today: ReservationWithMeta[] = [];
    const upcoming: ReservationWithMeta[] = [];
    const past: ReservationWithMeta[] = [];

    reservations.forEach((reservation) => {
      if (reservation.datetime < now) {
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

  // For client view: split into active (today + upcoming) and past
  const clientActive = React.useMemo(() => {
    return [...categorized.today, ...categorized.upcoming].sort(
      (a, b) => a.datetime.getTime() - b.datetime.getTime()
    );
  }, [categorized]);

  const displayed = React.useMemo(() => {
    if (mode === "client") {
      return clientActive;
    }
    return categorized[activeTab];
  }, [categorized, activeTab, mode, clientActive]);

  const totalCount = reservations.length;
  const hasReservations = totalCount > 0;
  const hasPastReservations = categorized.past.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {mode === "admin" ? (
        <header className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Reservations
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review upcoming reservations across every floor. Tabs help you
              quickly filter by time.
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
                      ? "border-emerald-400 bg-emerald-500 text-white shadow"
                      : "border-gray-200 bg-white text-gray-600 hover:border-emerald-400 hover:text-emerald-600",
                  ].join(" ")}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="ml-1 text-xs opacity-70">
                    {categorized[tab.id].length}
                  </span>
                </button>
              );
            })}
          </div>
        </header>
      ) : (
        <header className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              My Reservations
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review all your upcoming and past reservations.
            </p>
          </div>
        </header>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="text-sm text-gray-600">
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {mode === "client" ? "active" : activeTab}
            </span>{" "}
            reservations ({displayed.length})
          </div>
        </header>

        <div className="divide-y divide-gray-200">
          {hasReservations && displayed.length === 0 ? (
            <EmptyState message="Nothing in this timeframe yet." />
          ) : null}

          {!hasReservations ? (
            <EmptyState message="You have no reservations yet. Start planning and they'll be listed here." />
          ) : null}

          {displayed.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))}
        </div>

        {/* Past Reservations Section (Client View Only) */}
        {mode === "client" && hasPastReservations && (
          <>
            <div className="border-t-2 border-gray-300 bg-gray-50 px-6 py-3 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                History ({categorized.past.length})
              </span>
            </div>
            <div className="divide-y divide-gray-200 bg-gray-50/50">
              {categorized.past.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  isPast
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ReservationCard({
  reservation,
  isPast = false,
}: {
  reservation: ReservationWithMeta;
  isPast?: boolean;
}) {
  return (
    <article
      className={[
        "flex flex-col gap-4 px-6 py-5 text-gray-700 sm:flex-row sm:items-center sm:justify-between transition",
        isPast ? "opacity-60 hover:opacity-80 bg-gray-50" : "hover:bg-gray-50",
      ].join(" ")}
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-3">
          <span
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.25em]",
              isPast && "opacity-50",
            ].join(" ")}
            style={
              reservation.color
                ? {
                    borderColor: reservation.color,
                    color: reservation.color,
                  }
                : {
                    borderColor: "#6b7280",
                    color: "#6b7280",
                  }
            }
          >
            {reservation.floorName}
          </span>
          <span className={["text-sm", isPast && "text-gray-500"].join(" ")}>
            Table&nbsp;
            <span className="font-semibold text-gray-900">
              {reservation.tableName}
            </span>
            {typeof reservation.chairs === "number"
              ? ` · ${reservation.chairs} seats`
              : null}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1",
              isPast
                ? "border-gray-300 bg-gray-100 text-gray-500"
                : "border-gray-200 bg-gray-50 text-gray-700",
            ].join(" ")}
          >
            <CalendarDays className="h-4 w-4" />
            {dateFormatter.format(reservation.datetime)}
            <span className="text-gray-400">·</span>
            {timeFormatter.format(reservation.datetime)}
          </span>

          <span
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1",
              isPast
                ? "border-gray-300 bg-gray-100 text-gray-500"
                : "border-gray-200 bg-gray-50 text-gray-700",
            ].join(" ")}
          >
            <UsersRound className="h-4 w-4" />
            Party of {reservation.partySize}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-right text-sm">
        <span
          className={[
            "font-semibold",
            isPast ? "text-gray-500" : "text-gray-900",
          ].join(" ")}
        >
          {reservation.name}
        </span>
        <span className="text-xs text-gray-500">
          Reservation #{reservation.id.slice(0, 8)}
        </span>
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-gray-500">
      <CalendarDays className="h-8 w-8 text-gray-300" />
      <p>{message}</p>
    </div>
  );
}
