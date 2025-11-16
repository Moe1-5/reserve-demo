import React from "react";
import { useStore } from "@tanstack/react-store";
import {
  addChairToSelected,
  addTable,
  deleteSelectedTable,
  demoStore,
  removeChairFromSelected,
  selectTable,
  setChairsForSelected,
  setNameForSelected,
  setPlannerMode,
  type PlannerMode,
  type Reservation,
  type Table,
} from "../lib/demoStore";
import {
  ArrowLeft,
  Grip,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TABLE_SIZE,
  TIME_SLOTS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "../constants/reservationConst";
import { DraggableTable } from "../components/Table";
import { renderChairs } from "../components/renderChairs";
import { useFloorData } from "../lib/useFloorData";
import { useCanvas } from "../lib/useCanvas";

type ReservationRequest = {
  tableId: string;
  date: string;
  slot: string;
  name: string;
  partySize: number;
};

type CanvasExtras = {
  canvasStateByFloor?: Record<string, { pan: { x: number; y: number }; zoom: number }>;
  mode?: PlannerMode | null;
};



function clampTablePosition(x: number, y: number) {
  return {
    x: Math.min(Math.max(0, x), WORLD_WIDTH - TABLE_SIZE),
    y: Math.min(Math.max(0, y), WORLD_HEIGHT - TABLE_SIZE),
  };
}

export default function ReservationPanelDemo() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const canvasStatesRef = React.useRef<
    Record<string, { pan: { x: number; y: number }; zoom: number }>
  >({});
  const { mode } = useStore(demoStore);

  const {
    canvasRef,
    interactionLayerRef,
    canvasSize,
    zoom,
    pan,
    isPanning,
    setPanState,
    applyZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCanvasPointerLeave,
    screenToWorld,
  } = useCanvas();

  const handleHydrate = React.useCallback(
    (extras: CanvasExtras) => {
      if (extras.canvasStateByFloor) {
        canvasStatesRef.current = extras.canvasStateByFloor;
      }
      if (extras.mode === "admin" || extras.mode === "client") {
        setPlannerMode(extras.mode);
        setSidebarOpen(extras.mode === "admin");
      } else if (extras.mode === null) {
        setPlannerMode("pending");
        setSidebarOpen(false);
      }
    },
    [setSidebarOpen],
  );

  const getExtras = React.useCallback(
    () => ({
      mode: mode === "pending" ? null : mode,
      canvasStateByFloor: { ...canvasStatesRef.current },
    }),
    [mode],
  );

  const {
    activeFloorId,
    tables,
    selectedId,
    reservations,
    setReservations,
  } = useFloorData({
    onHydrate: handleHydrate,
    getExtras,
  });


  const selectedTable = React.useMemo(
    () => tables.find((table) => table.id === selectedId) ?? null,
    [tables, selectedId],
  );

  React.useEffect(() => {
    if (!activeFloorId) {
      return;
    }
    selectTable(null);
    setDetailOpen(false);
    const snapshot = canvasStatesRef.current[activeFloorId];
    if (snapshot) {
      applyZoom(snapshot.zoom);
      setPanState(snapshot.pan);
    } else {
      applyZoom(1);
      setPanState({ x:0, y: 0});
    }
  }, [activeFloorId, applyZoom, setDetailOpen, setPanState]);

  React.useEffect(() => {
    if (!activeFloorId) {
      return;
    }
    canvasStatesRef.current[activeFloorId] = { pan, zoom };
  }, [activeFloorId, pan, zoom]);

  const isAdmin = mode === "admin";

  React.useEffect(() => {
    setPanState((prev) => prev);
  }, [activeFloorId, canvasSize, zoom, setPanState]);

  const handleModeSelect = (nextMode: Exclude<PlannerMode, "pending">) => {
    setPlannerMode(nextMode);
    setSidebarOpen(nextMode === "admin");
    setDetailOpen(false);
    selectTable(null);
    handleZoomReset();
  };

  const handleCreateReservation = React.useCallback(
    (request: ReservationRequest) => {
      let created = false;
      setReservations((prev) => {
        const conflict = prev.some(
          (reservation) =>
            reservation.tableId === request.tableId &&
            reservation.date === request.date &&
            reservation.slot === request.slot,
        );

        if (conflict) {
          return prev;
        }

        created = true;
        const newReservation: Reservation = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...request,
        };

        return [...prev, newReservation];
      });
      return created;
    },
    [setReservations],
  );

  const handleAddTable = React.useCallback(() => {
    if (!isAdmin || !activeFloorId) {
      return;
    }

    if (canvasSize) {
      const centerWorld = screenToWorld({
        x: canvasSize.width / 2,
        y: canvasSize.height / 2,
      });
      const desired = {
        x: centerWorld.x - TABLE_SIZE / 2,
        y: centerWorld.y - TABLE_SIZE / 2,
      };
      const clamped = clampTablePosition(desired.x, desired.y);
      addTable({ x: clamped.x, y: clamped.y });
      setDetailOpen(true);

      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      addTable();
      setDetailOpen(true);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const centerWorld = screenToWorld({
      x: rect.width / 2,
      y: rect.height / 2,
    });

    const desired = {
      x: centerWorld.x - TABLE_SIZE / 2,
      y: centerWorld.y - TABLE_SIZE / 2,
    };
    const clamped = clampTablePosition(desired.x, desired.y);
    addTable({ x: clamped.x, y: clamped.y });
    setDetailOpen(true);
  }, [activeFloorId, canvasRef, canvasSize, isAdmin, screenToWorld]);

  const toggleSidebar = React.useCallback(() => {
    if (!isAdmin) return;
    setSidebarOpen((prev) => !prev);
  }, [isAdmin]);

  if (mode === "pending") {
    return (
      <div className="-mx-4 flex h-full min-h-[560px] flex-1 flex-col items-center justify-center gap-8 sm:-mx-6 lg:-mx-10">
        <div className="w-full max-w-2xl rounded-[32px] border border-slate-800 bg-slate-950/95 p-10 text-center shadow-2xl">
          <h1 className="text-3xl font-semibold text-white">Choose how you want to use the planner</h1>
          <p className="mt-4 text-sm text-slate-400">
            Admin mode lets you design the floor plan. Client mode lets you browse tables just like a guest.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => handleModeSelect("admin")}
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 sm:w-auto"
            >
              Enter Admin Mode
            </button>
            <button
              type="button"
              onClick={() => handleModeSelect("client")}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
            >
              Enter Client Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 flex h-full min-h-0 flex-1 flex-col gap-6 sm:-mx-6 lg:-mx-10">
      <div className="relative flex flex-1 overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900">
        <CanvasTools
          open={sidebarOpen}
          mode={mode}
          onAddTable={handleAddTable}
          onToggleSidebar={toggleSidebar}
        />

        <div
          ref={canvasRef}
          className="relative flex-1 min-h-0 w-full overflow-hidden rounded-[32px] border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              selectTable(null);
              setDetailOpen(false);
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(255,255,255,0.03)_1px,_transparent_1px),_linear-gradient(180deg,_rgba(255,255,255,0.03)_1px,_transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.08),_transparent_55%)]" />
          </div>

          <div
            ref={interactionLayerRef}
            className="absolute inset-0 z-10 touch-none"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerLeave}
            style={{
              cursor:
                zoom > 1 || isPanning
                  ? isPanning
                    ? "grabbing"
                    : "grab"
                  : "default",
            }}
          >
            <div
              className="absolute left-0 top-0 border border-white"
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
                // willChange: "transform",
                // backfaceVisibility: "hidden",
                // boxShadow: "0 0 0 0 2px white",
              }}
            >
              {tables.map((table) => (
                <DraggableTable
                  key={table.id}
                  table={table}
                  mode={mode}
                  isSelected={table.id === selectedId}
                  onSelect={() => {
                    if (isAdmin) {
                      setDetailOpen(false);
                    } else {
                      setDetailOpen(true);
                    }
                  }}
                  onOpenDetail={() => setDetailOpen(true)}
                  zoom={zoom}
                  clampTablePosition={clampTablePosition}
                />
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between px-6 pt-6">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 shadow">
              <button
                type="button"
                onClick={handleZoomOut}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={zoom <= MIN_ZOOM + 1e-6}
              >
                -
              </button>
              <span className="min-w-[3rem] text-center font-semibold tracking-wide">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={zoom >= MAX_ZOOM - 1e-6}
              >
                +
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="inline-flex h-7 px-2 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Reset
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-400">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                {isAdmin
                  ? "Drag to move | Double-click to edit | Pinch or scroll to zoom"
                  : "Tap a table to view details | Pinch or scroll to zoom"}
              </div>
            </div>
          </div>

          {tables.length === 0 && (
            <div className="absolute left-1/2 top-1/2 z-30 w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-800 bg-slate-900/85 p-6 text-center text-sm text-slate-300 shadow-lg backdrop-blur">
              <p className="text-base font-semibold text-white">
                {isAdmin ? "Ready to design tonight's floor?" : "Floor plan not published yet"}
              </p>
              <p className="mt-2 text-slate-400">
                {isAdmin
                  ? "Tap the table template to drop it in the center, then drag to place."
                  : "Please reach out to the host for the latest layout or pick another room."}
              </p>
            </div>
          )}
        </div>
      </div>

      {detailOpen && selectedTable && (
        <TableDetailSheet
          table={selectedTable}
          mode={mode}
          reservations={reservations}
          onCreateReservation={handleCreateReservation}
          onClose={() => {
            setDetailOpen(false);
            selectTable(null);
          }}
        />
      )}
    </div>
  );
}

function CanvasTools({
  open,
  mode,
  onAddTable,
  onToggleSidebar,
}: {
  open: boolean;
  mode: PlannerMode;
  onAddTable: () => void;
  onToggleSidebar: () => void;
}) {
  if (mode !== "admin") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-6 top-20 z-20">
      <aside
        className={[
          "pointer-events-auto w-60 rounded-[28px] border border-slate-800 bg-slate-950/95 p-5 shadow-2xl transition duration-300",
          open ? "translate-x-0 opacity-100" : "-translate-x-[130%] opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tools</p>
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
            aria-label="Collapse tools"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          Drop a table into the room and fine-tune it after it lands.
        </p>

        <button
          type="button"
          onClick={onAddTable}
          className="mt-6 flex w-full flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 transition hover:border-slate-600 hover:text-white"
        >
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800"> 
            <div className="flex h-14 w-14 items-center justify-center rounded-none border border-white/70 bg-slate-950/80 text-emerald-400">
              <UsersRound className="h-6 w-6" />
            </div>
            {renderChairs(8, {
              size: 64,
              chairSize: 14,
              offset: 42,
            })}
          </div>
          <span className="text-xs uppercase tracking-[0.25em] text-slate-300">
            Place Table
          </span>
        </button>
      </aside>

      {!open && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="pointer-events-auto absolute top-0 left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
          aria-label="Expand tools"
        >
          <Grip className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function TableDetailSheet({
  table,
  mode,
  reservations,
  onCreateReservation,
  onClose,
}: {
  table: Table;
  mode: PlannerMode;
  reservations: Reservation[];
  onCreateReservation: (request: ReservationRequest) => boolean;
  onClose: () => void;
}) {
  const isAdmin = mode === "admin";
  if (isAdmin) {
    return <AdminReservationSheet table={table} onClose={onClose} />;
  }

  return (
    <ClientReservationSheet
      table={table}
      reservations={reservations}
      onCreateReservation={onCreateReservation}
      onClose={onClose}
    />
  );
}

type AdminReservationSheetProps = {
  table: Table;
  onClose: () => void;
};

function AdminReservationSheet({ table, onClose }: AdminReservationSheetProps) {
  const [chairInput, setChairInput] = React.useState<string>(
    table.chairs.toString()
  );
  const [nameInput, setNameInput] = React.useState<string>(table.name);

  React.useEffect(() => {
    setChairInput(table.chairs.toString());
    setNameInput(table.name);
  }, [table.id, table.chairs, table.name]);

  const commitName = React.useCallback((raw: string) => {
    const trimmed = raw.trim();
    const nextName = trimmed.length === 0 ? "Table" : trimmed;
    setNameForSelected(nextName);
    setNameInput(nextName);
  }, []);

  const handleSeatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (/^\d*$/.test(value)) {
      setChairInput(value);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        setChairsForSelected(parsed);
      }
    }
  };

  const handleSeatBlur = () => {
    const parsed = Number.parseInt(chairInput, 10);
    if (Number.isNaN(parsed)) {
      setChairInput(table.chairs.toString());
    } else {
      setChairsForSelected(parsed);
    }
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(event.target.value);
  };

  const handleNameBlur = () => {
    commitName(nameInput);
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName(nameInput);
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setNameInput(table.name);
      (event.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/40 px-4 py-8 sm:px-8">
      <div
        className="absolute inset-0"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Table Focus
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              placeholder="Table name"
            />
            <p className="text-xs text-slate-500">
              {Math.round(table.x)}, {Math.round(table.y)} | {table.chairs} seats
            </p>
          </div>
          <button
            type="button"
            onClick={deleteSelectedTable}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition hover:border-red-500/60 hover:text-red-400"
            aria-label="Delete table"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950">
            {renderChairs(table.chairs, {
              size: 82,
              chairSize: 16,
              offset: 50,
            })}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Seat Count
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={removeChairFromSelected}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={table.chairs === 0}
              aria-label="Remove seat"
            >
              <UserMinus className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <UsersRound className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={chairInput}
                onChange={handleSeatChange}
                onBlur={handleSeatBlur}
                className="w-full bg-transparent text-sm text-slate-100 focus:outline-none"
                placeholder="0"
              />
            </div>

            <button
              type="button"
              onClick={addChairToSelected}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white"
              aria-label="Add seat"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ClientReservationSheetProps = {
  table: Table;
  reservations: Reservation[];
  onCreateReservation: (request: ReservationRequest) => boolean;
  onClose: () => void;
};

function ClientReservationSheet({
  table,
  reservations,
  onCreateReservation,
  onClose,
}: ClientReservationSheetProps) {
  const todayIso = React.useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate());
    today.setHours(today.getHours() -  today.getTimezoneOffset() / 60);
    return today.toISOString().slice(0, 10);  
  }, []);
  const [reservationDate, setReservationDate] = React.useState<string>(todayIso);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [guestName, setGuestName] = React.useState("");
  const [partySize, setPartySize] = React.useState(() =>
    Math.max(1, table.chairs)
  );
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  React.useEffect(() => {
    setReservationDate(todayIso);
    setSelectedSlot(null);
    setGuestName("");
    setPartySize(Math.max(1, table.chairs));
    setFeedback(null);
  }, [table.id, table.chairs, todayIso]);

  const reservationsForDate = React.useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          reservation.tableId === table.id &&
          reservation.date === reservationDate
      ),
    [reservations, table.id, reservationDate]
  );

  const upcomingReservations = React.useMemo(() => {
    return reservations
      .filter((reservation) => reservation.tableId === table.id && reservation.date >= todayIso)
  }, [reservations, table.id]);

  const slotIsUnavailable = React.useCallback(
    (slot: string) =>
      reservationsForDate.some((reservation) => reservation.slot === slot),
    [reservationsForDate]
  );

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (next !== todayIso) {
      setReservationDate(next);
      setSelectedSlot(null);
      setFeedback({
        type: "error",
        message: "Reservations are limited to today.",
      });
      return;
    }

    setReservationDate(todayIso);
    setSelectedSlot(null);
  };

  const handleReserve = () => {
    if (!guestName.trim()) {
      setFeedback({
        type: "error",
        message: "Please provide a contact name.",
      });
      return;
    }

    if (!selectedSlot) {
      setFeedback({
        type: "error",
        message: "Select a seating time.",
      });
      return;
    }

    const now = new Date();
    console.log("This is the Date:", now)
    const selectedDateTime = new Date(`${reservationDate}T${selectedSlot}:00`);
    if (selectedDateTime < now) {
      setFeedback({
        type: "error",
        message: "Please choose a time in .",
      });
      return;
    }

    const success = onCreateReservation({
      tableId: table.id,
      date: reservationDate,
      slot: selectedSlot,
      name: guestName.trim(),
      partySize,
    });

    if (success) {
      setFeedback({
        type: "success",
        message: "Reservation confirmed. We look forward to hosting you!",
      });
      setSelectedSlot(null);
      setGuestName("");
      setPartySize(Math.max(1, table.chairs));
    } else {
      setFeedback({
        type: "error",
        message: "Just missed it! That slot was taken—please choose another.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/40 px-4 py-8 sm:px-8">
      <div
        className="absolute inset-0"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Table Focus
          </p>
          <input
            type="text"
            value={table.name}
            readOnly
            className="w-full cursor-default rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-300"
          />
          <p className="text-xs text-slate-500">
            {Math.round(table.x)}, {Math.round(table.y)} | {table.chairs} seats
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950">
            {renderChairs(table.chairs, {
              size: 82,
              chairSize: 16,
              offset: 50,
            })}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-slate-500" />
              <span>{table.chairs} seats available</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Reservation Name
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder="Who should we expect?"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Party Size
                </label>
                <input
                  type="number"
                  min={1}
                  max={table.chairs}
                  value={partySize}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    if (Number.isNaN(value)) {
                      setPartySize(1);
                      return;
                    }
                    setPartySize(Math.max(1, Math.min(table.chairs, value)));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Date
                </label>
                <input
                  type="date"
                  value={reservationDate}
                  min={todayIso}
                  // max={todayIso}
                  onChange={handleDateChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Time
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const booked = slotIsUnavailable(slot);
                  const selected = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        if (booked) return;
                        setSelectedSlot(slot);
                        setFeedback(null);
                      }}
                      disabled={booked}
                      className={[
                        "rounded-xl border px-3 py-2 text-sm transition",
                        booked
                          ? "cursor-not-allowed border-slate-800 text-slate-500 opacity-50"
                          : selected
                          ? "border-emerald-400 bg-emerald-500 text-slate-950"
                          : "border-slate-700 text-slate-200 hover:border-emerald-400",
                      ].join(" ")}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {feedback && (
              <div
                className={[
                  "rounded-xl border px-4 py-3 text-sm",
                  feedback.type === "success"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/60 bg-red-500/10 text-red-200",
                ].join(" ")}
              >
                {feedback.message}
              </div>
            )}

            <button
              type="button"
              onClick={handleReserve}
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Reserve Table
            </button>
          </div>

          {upcomingReservations.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Upcoming Bookings
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                {upcomingReservations.map((reservation) => (
                  <li
                    key={reservation.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2"
                  >
                    <span>
                      {reservation.date} · {reservation.slot}
                    </span>
                    <span className="text-slate-500">
                      {reservation.name} · {reservation.partySize} guests
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

