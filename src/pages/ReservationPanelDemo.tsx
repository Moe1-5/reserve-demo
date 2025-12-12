import React from "react";
import { useStore } from "@tanstack/react-store";
import { DraggableDivider } from "../components/Divider";
import {
  updateDivider,
  deleteSelectedDivider,
  addDivider,
  addChairToSelected,
  addTable,
  deleteSelectedTable,
  demoStore,
  removeChairFromSelected,
  selectTable,
  setChairsForSelected,
  setNameForSelected,
  type PlannerMode,
  type Reservation,
  type Table,
  saveClientReservations,
  loadClientReservations,
} from "../lib/demoStore";

import {
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
  Plus,
  LayoutTemplate,
  SeparatorHorizontal,
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
import { useFloorData } from "../lib/useFloorData";
import { useCanvas } from "../lib/useCanvas";

type ReservationRequest = {
  tableId: string;
  date: string;
  slot: string;
  name: string;
  partySize: number;
};

// --- Helper: Clamp Table to World Bounds ---
function clampTablePosition(
  x: number,
  y: number,
  width: number = 120,
  height: number = 80
) {
  return {
    x: Math.min(Math.max(0, x), WORLD_WIDTH - width),
    y: Math.min(Math.max(0, y), WORLD_HEIGHT - height),
  };
}

export default function ReservationPanelDemo() {
  // --- Store & State ---
  const dividers = useStore(demoStore, (state) => {
    const activeFloor = state.floors.find((f) => f.id === state.activeFloorId);
    return activeFloor?.dividers ?? [];
  });
  const [selectedDividerId, setSelectedDividerId] = React.useState<
    string | null
  >(null);
  const mode = useStore(demoStore, (state) => state.mode);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const canvasStatesRef = React.useRef<
    Record<string, { pan: { x: number; y: number }; zoom: number }>
  >({});

  const clientIdFromUrl = React.useMemo(() => {
    if (mode === "client") {
      const pathParts = window.location.pathname.split("/");
      const clientIndex = pathParts.indexOf("client");
      if (clientIndex !== -1 && pathParts[clientIndex + 1]) {
        return pathParts[clientIndex + 1];
      }
    }
    return null;
  }, [mode]);

  // --- Canvas Logic ---
  const {
    canvasRef,
    interactionLayerRef,
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

  const getExtras = React.useCallback(
    () => ({
      mode: mode === "pending" ? null : mode,
      canvasStateByFloor: { ...canvasStatesRef.current },
    }),
    [mode]
  );

  const { activeFloorId, tables, selectedId, reservations, setReservations } =
    useFloorData({
      getExtras,
    });

  const clientReservations = React.useMemo(() => {
    if (mode === "client" && clientIdFromUrl) {
      return loadClientReservations(clientIdFromUrl);
    }
    return reservations;
  }, [mode, clientIdFromUrl, reservations]);

  const selectedTable = React.useMemo(
    () => tables.find((table) => table.id === selectedId) ?? null,
    [tables, selectedId]
  );

  // --- Effects ---
  React.useEffect(() => {
    if (!activeFloorId) return;
    selectTable(null);
    setDetailOpen(false);
    const snapshot = canvasStatesRef.current[activeFloorId];
    if (snapshot) {
      applyZoom(snapshot.zoom);
      setPanState(snapshot.pan);
    } else {
      applyZoom(1);
      setPanState({ x: 0, y: 0 });
    }
  }, [activeFloorId, applyZoom, setPanState]);

  React.useEffect(() => {
    if (!activeFloorId) return;
    canvasStatesRef.current[activeFloorId] = { pan, zoom };
  }, [activeFloorId, pan, zoom]);

  const isAdmin = mode === "admin";

  // --- Actions ---

  const handleAddTable = React.useCallback(() => {
    if (!isAdmin || !activeFloorId) return;

    let desired = { x: 100, y: 100 };
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const centerWorld = screenToWorld({
          x: rect.width / 2,
          y: rect.height / 2,
        });
        desired = {
          x: centerWorld.x - TABLE_SIZE / 2,
          y: centerWorld.y - TABLE_SIZE / 2,
        };
      }
    }
    const clamped = clampTablePosition(desired.x, desired.y);
    addTable({ x: clamped.x, y: clamped.y });
    setDetailOpen(true);
  }, [activeFloorId, canvasRef, isAdmin, screenToWorld]);

  const handleAddDivider = React.useCallback(() => {
    if (!isAdmin || !activeFloorId) return;

    let desired = { x: 150, y: 150 };
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const centerWorld = screenToWorld({
          x: rect.width / 2,
          y: rect.height / 2,
        });
        desired = { x: centerWorld.x - 200, y: centerWorld.y - 40 };
      }
    }

    addDivider({
      x: desired.x,
      y: desired.y,
      width: 400,
      height: 80,
      name: "Area",
    });
  }, [activeFloorId, canvasRef, isAdmin, screenToWorld]);

  const handleCreateReservation = React.useCallback(
    (request: ReservationRequest) => {
      const conflict = reservations.some(
        (reservation) =>
          reservation.tableId === request.tableId &&
          reservation.date === request.date &&
          reservation.slot === request.slot
      );

      if (conflict) return false;

      const newReservation: Reservation = {
        id: crypto.randomUUID(),
        ...request,
        clientId: clientIdFromUrl ?? undefined,
      };

      setReservations((prev) => [...prev, newReservation]);

      if (clientIdFromUrl) {
        const existingClientReservation =
          loadClientReservations(clientIdFromUrl);
        saveClientReservations(clientIdFromUrl, [
          ...existingClientReservation,
          newReservation,
        ]);
      }
      return true;
    },
    [setReservations, reservations, clientIdFromUrl]
  );

  // --- Background Click Handler (Clears selection) ---
  const handleBackgroundClick = (event: React.MouseEvent) => {
    // Only deselect if we clicked directly on the background div
    if (event.target === event.currentTarget) {
      selectTable(null);
      setDetailOpen(false);
      setSelectedDividerId(null);
    }
  };

  // --- Render ---
  return (
    // ADDED 'relative' to fix absolute positioning of side panel
    <div className="relative flex h-full w-full flex-col md:flex-row gap-4 bg-white p-2 md:p-4 overflow-hidden">
      {/* LEFT SIDEBAR - Responsive Height/Width */}
      {isAdmin && (
        <aside className="flex-none w-full md:w-56 flex flex-row md:flex-col gap-4 rounded-3xl bg-white p-4 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-100 z-20">
          <div className="hidden md:block">
            <h2 className="text-lg font-bold text-gray-800 tracking-tight">
              Design Tools
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
              Drag & drop items
            </p>
          </div>

          {/* Tools Grid */}
          <div className="flex flex-1 md:flex-none flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
            <button
              onClick={handleAddTable}
              className="flex-1 group flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md active:scale-95 whitespace-nowrap"
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs font-bold text-gray-700">Table</span>
                <span className="text-[10px] text-gray-400 font-medium hidden md:block">
                  4 Seater
                </span>
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 md:ml-0 ml-2" />
            </button>

            <button
              onClick={handleAddDivider}
              className="flex-1 group flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-blue-500 hover:shadow-md active:scale-95 whitespace-nowrap"
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs font-bold text-gray-700">Area</span>
                <span className="text-[10px] text-gray-400 font-medium hidden md:block">
                  Zone / Floor
                </span>
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 md:ml-0 ml-2" />
            </button>
          </div>

          <div className="hidden md:block mt-auto rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
              Instructions
            </p>
            <div className="text-[10px] text-gray-600 space-y-1.5 leading-relaxed">
              <p>
                <span className="font-bold text-gray-800">Double-click</span>{" "}
                table to edit.
              </p>
              <p>
                <span className="font-bold text-gray-800">Select Area</span> to
                rename it.
              </p>
              <p>
                <span className="font-bold text-gray-800">Drag</span> handles to
                resize.
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* CANVAS CONTAINER */}
      <div className="relative flex-1 overflow-hidden rounded-2xl shadow-xl border border-gray-200">
        <div
          ref={canvasRef}
          className="relative h-full w-full overflow-hidden bg-white cursor-crosshair"
          onClick={handleBackgroundClick} // Attach the fixed click handler here
        >
          {/* Grid background */}
          <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.3]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#e2e8f0_1px,transparent_1px),linear-gradient(180deg,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px]" />
          </div>

          {/* Interaction layer */}
          <div
            ref={interactionLayerRef}
            className="absolute inset-0 z-10 pointer-events-none"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerLeave}
            onClick={handleBackgroundClick}
            style={{
              cursor:
                zoom > 1 || isPanning
                  ? isPanning
                    ? "grabbing"
                    : "grab"
                  : "default",
            }}
          >
            {/* Inner World Border (Dark Grey) */}
            <div
              className="absolute left-0 top-0 border-[3px] border-gray-900 bg-white/20 shadow-2xl pointer-events-auto"
              onClick={handleBackgroundClick}
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
                willChange: "transform",
              }}
            >
              {/* Dividers */}
              {dividers.map((divider) => (
                <DraggableDivider
                  key={divider.id}
                  divider={divider}
                  zoom={zoom}
                  onUpdate={updateDivider}
                  onDelete={deleteSelectedDivider}
                  isSelected={divider.id === selectedDividerId}
                  onSelect={() => {
                    // Only select if Admin
                    if (isAdmin) {
                      setSelectedDividerId(divider.id);
                      selectTable(null);
                    }
                  }}
                  isAdmin={isAdmin}
                />
              ))}

              {/* Tables */}
              {tables.map((table) => (
                <DraggableTable
                  key={table.id}
                  table={table}
                  mode={mode}
                  isSelected={table.id === selectedId}
                  detailOpen={detailOpen}
                  onSelect={() => {
                    setSelectedDividerId(null);
                    setDetailOpen(false);
                  }}
                  onOpenDetail={() => {
                    setDetailOpen(true);
                    setSelectedDividerId(null);
                  }}
                  zoom={zoom}
                  clampTablePosition={(x, y) =>
                    clampTablePosition(x, y, table.width, table.height)
                  }
                />
              ))}
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="pointer-events-none absolute bottom-6 right-6 z-20 flex flex-col gap-3">
            <div className="pointer-events-auto flex flex-col items-center overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100">
              <button
                type="button"
                onClick={handleZoomIn}
                className="flex h-10 w-10 items-center justify-center text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                disabled={zoom >= MAX_ZOOM - 1e-6}
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="flex h-8 w-10 items-center justify-center text-[10px] font-bold text-gray-900 border-y border-gray-100 cursor-default select-none">
                {Math.round(zoom * 100)}%
              </div>
              <button
                type="button"
                onClick={handleZoomOut}
                className="flex h-10 w-10 items-center justify-center text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                disabled={zoom <= MIN_ZOOM + 1e-6}
              >
                <div className="h-0.5 w-3 bg-gray-800" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleZoomReset}
              className="pointer-events-auto rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-gray-700 shadow-md border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Empty state */}
          {tables.length === 0 && dividers.length === 0 && (
            <div className="absolute left-1/2 top-1/2 z-30 w-[80%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/95 p-6 text-center shadow-xl backdrop-blur-sm border border-gray-200 pointer-events-none">
              <p className="text-xl font-bold text-gray-900">
                {isAdmin ? "Start Designing" : "Floor Plan Empty"}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {isAdmin
                  ? "Use the tools on the left to set up the floor."
                  : "Please check back later."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {detailOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:items-stretch md:justify-end pointer-events-none">
          <TableDetailSheet
            table={selectedTable}
            mode={mode}
            reservations={clientReservations}
            onCreateReservation={handleCreateReservation}
            onClose={() => {
              setDetailOpen(false);
              selectTable(null);
            }}
          />
        </div>
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
    // Admin gets the compact floating card in center
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
        <AdminReservationSheet table={table} onClose={onClose} />
      </div>
    );
  }

  return (
    <>
      {/* mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto -z-10"
        onClick={onClose}
      />
      {/* Detail panel */}
      <div className="pointer-events-auto md:h-full w-[90%] md:w-[400px] h-auto max-h-[85%] md:max-h-full bg-white shadow-2xl rounded-2xl md:rounded-none md:rounded-l-2xl border-l border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95 md:slide-in-from-right duration-300">
        <ClientReservationSheet
          table={table}
          reservations={reservations}
          onCreateReservation={onCreateReservation}
          onClose={onClose}
        />
      </div>
    </>
  );
}

type AdminReservationSheetProps = {
  table: Table;
  onClose: () => void;
};

// COMPACT ADMIN CARD (Floating)
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

  const handleNameBlur = () => {
    commitName(nameInput);
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName(nameInput);
      (event.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <div className="w-[300px] rounded-2xl bg-white p-5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Table Focus
        </span>
        <div className="flex gap-2">
          <button
            onClick={deleteSelectedTable}
            className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          className="w-full text-xl font-bold text-gray-900 focus:outline-none border-b border-transparent focus:border-emerald-500 placeholder-gray-300 pb-1"
          placeholder="Table Name"
          autoFocus
        />
      </div>

      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2 border border-gray-100">
        <button
          onClick={removeChairFromSelected}
          disabled={table.chairs <= 1}
          className="h-8 w-8 rounded-lg bg-white shadow-sm border border-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50"
        >
          <UserMinus className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-lg font-bold text-gray-800">{chairInput}</span>
          <span className="text-[10px] text-gray-400 block -mt-1">Seats</span>
        </div>
        <button
          onClick={addChairToSelected}
          className="h-8 w-8 rounded-lg bg-emerald-500 shadow-sm border border-emerald-600 text-white flex items-center justify-center hover:bg-emerald-600"
        >
          <UserPlus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// CLIENT FORM COMPONENT
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
    today.setHours(today.getHours() - today.getTimezoneOffset() / 60);
    return today.toISOString().slice(0, 10);
  }, []);
  const [reservationDate, setReservationDate] =
    React.useState<string>(todayIso);
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
        (r) => r.tableId === table.id && r.date === reservationDate
      ),
    [reservations, table.id, reservationDate]
  );

  const slotIsUnavailable = React.useCallback(
    (slot: string) => reservationsForDate.some((r) => r.slot === slot),
    [reservationsForDate]
  );

  const handleReserve = () => {
    if (!guestName.trim() || !selectedSlot) {
      setFeedback({ type: "error", message: "Missing details" });
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
      setFeedback({ type: "success", message: "Confirmed!" });
      setSelectedSlot(null);
      setGuestName("");
      setPartySize(Math.max(1, table.chairs));
    } else {
      setFeedback({ type: "error", message: "Slot taken." });
    }
  };

  return (
    <div className="h-full w-full bg-white p-6 flex flex-col gap-6 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{table.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <UsersRound className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-gray-600">
              {table.chairs} Seats
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pr-1">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Details
          </label>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={reservationDate}
              min={todayIso}
              onChange={(e) => setReservationDate(e.target.value)}
              className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-3"
            />
            <input
              type="number"
              min={1}
              max={table.chairs}
              value={partySize}
              onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
              className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-3"
              placeholder="Guests"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Contact
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium"
            placeholder="Guest Name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Select Time
          </label>
          <div className="grid grid-cols-3 gap-2 pb-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                disabled={slotIsUnavailable(slot)}
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 text-xs font-bold rounded-lg transition ${
                  selectedSlot === slot
                    ? "bg-emerald-500 text-white shadow-md transform scale-105"
                    : slotIsUnavailable(slot)
                    ? "bg-gray-50 text-gray-300 line-through"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-500"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`text-center text-sm font-bold py-2 rounded-lg ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-500"
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>

      <button
        onClick={handleReserve}
        className="w-full bg-gray-900 text-white text-base font-bold py-4 rounded-xl hover:bg-black transition shadow-lg mt-auto flex-shrink-0"
      >
        Confirm Reservation
      </button>
    </div>
  );
}
