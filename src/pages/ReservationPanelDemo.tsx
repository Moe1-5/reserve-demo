import React from "react";
import Draggable from "react-draggable";
import type { DraggableData, DraggableEvent } from "react-draggable";
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
  updateTablePosition,
  type Table,
} from "../lib/demoStore";
import {
  ArrowLeft,
  Grip,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";

const TABLE_SIZE = 96;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;
const STORAGE_KEY = "neutro-reserve.canvas-state";
const STORAGE_VERSION = 1;
const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2400;
type PlannerMode = "pending" | "admin" | "client";
type Reservation = {
  id: string;
  tableId: string;
  date: string; // YYYY-MM-DD
  slot: string; // HH:mm
  name: string;
  partySize: number;
};
type ReservationRequest = {
  tableId: string;
  date: string;
  slot: string;
  name: string;
  partySize: number;
};

const TIME_SLOTS = [
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

function isValidTable(value: unknown): value is Table {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.color === "string" &&
    typeof candidate.chairs === "number"
  );
}

function isValidReservation(value: unknown): value is Reservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.tableId === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.slot === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.partySize === "number"
  );
}

function clampTablePosition(x: number, y: number) {
  return {
    x: Math.min(Math.max(0, x), WORLD_WIDTH - TABLE_SIZE),
    y: Math.min(Math.max(0, y), WORLD_HEIGHT - TABLE_SIZE),
  };
}

function clampPanToWorld(
  pan: { x: number; y: number },
  viewport: { width: number; height: number } | null,
  zoom: number
) {
  if (!viewport) {
    return pan;
  }

  const worldWidth = WORLD_WIDTH * zoom;
  const worldHeight = WORLD_HEIGHT * zoom;

  const horizontalCenter = (viewport.width - worldWidth) / 2;
  const verticalCenter = (viewport.height - worldHeight) / 2;

  const clampedX =
    worldWidth <= viewport.width
      ? horizontalCenter
      : Math.min(0, Math.max(pan.x, viewport.width - worldWidth));

  const clampedY =
    worldHeight <= viewport.height
      ? verticalCenter
      : Math.min(0, Math.max(pan.y, viewport.height - worldHeight));

  return { x: clampedX, y: clampedY };
}

const TABLE_BOUNDS = {
  left: 0,
  top: 0,
  right: WORLD_WIDTH - TABLE_SIZE,
  bottom: WORLD_HEIGHT - TABLE_SIZE,
};

export default function ReservationPanelDemo() {
  const { tables, selectedId } = useStore(demoStore);
  const selectedTable = tables.find((table) => table.id === selectedId) ?? null;
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [canvasSize, setCanvasSize] = React.useState<{ width: number; height: number } | null>(null);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [mode, setMode] = React.useState<PlannerMode>("pending");
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const interactionLayerRef = React.useRef<HTMLDivElement>(null);
  const hasHydratedRef = React.useRef(false);

  const zoomRef = React.useRef(zoom);
  const panRef = React.useRef(pan);
  const canvasSizeRef = React.useRef(canvasSize);
  const activePointersRef = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = React.useRef<{
    distance: number;
    midpoint: { x: number; y: number };
    zoom: number;
    pan: { x: number; y: number };
  } | null>(null);
  const isPanningRef = React.useRef(false);
  const pointerTypeRef = React.useRef<string | null>(null);
  const lastPanPointRef = React.useRef<{ x: number; y: number } | null>(null);

  const isAdmin = mode === "admin";
  const isClient = mode === "client";

  React.useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  React.useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  React.useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  const setPanState = React.useCallback(
    (
      updater:
        | { x: number; y: number }
        | ((current: { x: number; y: number }) => { x: number; y: number })
    ) => {
      setPan((prev) => {
        const nextValue = typeof updater === "function" ? updater(prev) : updater;
        const clamped = clampPanToWorld(nextValue, canvasSizeRef.current, zoomRef.current);
        if (clamped.x === prev.x && clamped.y === prev.y) {
          panRef.current = prev;
          return prev;
        }
        panRef.current = clamped;
        return clamped;
      });
    },
    []
  );

  const handleModeSelect = (nextMode: Exclude<PlannerMode, "pending">) => {
    setMode(nextMode);
    setSidebarOpen(nextMode === "admin");
    setDetailOpen(false);
    selectTable(null);
  };

  const handleResetMode = () => {
    setMode("pending");
    setSidebarOpen(false);
    setDetailOpen(false);
    selectTable(null);
  };

  React.useEffect(() => {
    setPanState((prev) => prev);
  }, [canvasSize, zoom, setPanState]);

  const handleCreateReservation = React.useCallback(
    (request: ReservationRequest) => {
      let created = false;
      setReservations((prev) => {
        const conflict = prev.some(
          (reservation) =>
            reservation.tableId === request.tableId &&
            reservation.date === request.date &&
            reservation.slot === request.slot
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
    []
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        hasHydratedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as {
        version?: unknown;
        tables?: unknown;
        selectedId?: unknown;
        pan?: unknown;
        zoom?: unknown;
        mode?: unknown;
        reservations?: unknown;
      };

      if (parsed.version !== STORAGE_VERSION) {
        hasHydratedRef.current = true;
        return;
      }

      const storedTables = Array.isArray(parsed.tables)
        ? parsed.tables
            .filter(isValidTable)
            .map((table) => {
              const clamped = clampTablePosition(table.x, table.y);
              return { ...table, x: clamped.x, y: clamped.y };
            })
        : [];

      if (storedTables.length > 0) {
        const persistedSelected =
          typeof parsed.selectedId === "string" &&
          storedTables.some((table) => table.id === parsed.selectedId)
            ? parsed.selectedId
            : storedTables[0]?.id ?? null;

        demoStore.setState((prev) => ({
          ...prev,
          tables: storedTables,
          selectedId: persistedSelected,
        }));
      }

      if (Array.isArray(parsed.reservations)) {
        const validReservations = parsed.reservations
          .filter(isValidReservation)
          .filter((reservation) =>
            storedTables.some((table) => table.id === reservation.tableId)
          );
        setReservations(validReservations);
      } else {
        setReservations([]);
      }

      if (
        parsed.pan &&
        typeof parsed.pan === "object" &&
        typeof (parsed.pan as { x?: unknown }).x === "number" &&
        typeof (parsed.pan as { y?: unknown }).y === "number"
      ) {
        const storedPan = {
          x: (parsed.pan as { x: number }).x,
          y: (parsed.pan as { y: number }).y,
        };
        setPanState(storedPan);
      }

      if (typeof parsed.zoom === "number") {
        const normalizedZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, parsed.zoom)
        );
        zoomRef.current = normalizedZoom;
        setZoom(normalizedZoom);
      }

      if (parsed.mode === "admin" || parsed.mode === "client") {
        setMode(parsed.mode);
        setSidebarOpen(parsed.mode === "admin");
      } else {
        setMode("pending");
        setSidebarOpen(false);
      }
    } catch {
      // ignore malformed storage
    } finally {
      hasHydratedRef.current = true;
    }
  }, [setPanState]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedRef.current) {
      return;
    }

    const payload = {
      version: STORAGE_VERSION,
      tables,
      selectedId,
      pan,
      zoom,
      mode: mode === "pending" ? null : mode,
      reservations,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore write errors (e.g., private mode)
    }
  }, [tables, selectedId, pan, zoom, mode, reservations]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", updateSize);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", updateSize);
      }
    };
  }, [sidebarOpen]);

  const clampZoom = React.useCallback((value: number) => {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }, []);

  const applyZoom = React.useCallback(
    (nextZoom: number, focusPoint?: { x: number; y: number }) => {
      const size = canvasSizeRef.current;
      const currentZoom = zoomRef.current;
      const clampedZoom = clampZoom(Math.round(nextZoom * 100) / 100);

      if (!size) {
        zoomRef.current = clampedZoom;
        setZoom((prev) => (prev === clampedZoom ? prev : clampedZoom));
        setPanState({ x: 0, y: 0 });
        return;
      }

      const focus =
        focusPoint ?? {
          x: size.width / 2,
          y: size.height / 2,
        };

      const currentPan = panRef.current;
      const canvasPoint = {
        x: focus.x / currentZoom - currentPan.x,
        y: focus.y / currentZoom - currentPan.y,
      };

      const panRaw = {
        x: focus.x / clampedZoom - canvasPoint.x,
        y: focus.y / clampedZoom - canvasPoint.y,
      };

      zoomRef.current = clampedZoom;
      setZoom((prev) => (prev === clampedZoom ? prev : clampedZoom));
      setPanState(() => panRaw);
    },
    [clampZoom, setPanState]
  );

  const handleZoomIn = React.useCallback(() => {
    applyZoom(zoomRef.current + ZOOM_STEP);
  }, [applyZoom]);

  const handleZoomOut = React.useCallback(() => {
    applyZoom(zoomRef.current - ZOOM_STEP);
  }, [applyZoom]);

  const handleZoomReset = React.useCallback(() => {
    applyZoom(1);
    setPanState({ x: 0, y: 0 });
  }, [applyZoom, setPanState]);

  const getCanvasPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { x: clientX, y: clientY };
      }
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const handleCanvasWheel = React.useCallback(
    (event: WheelEvent) => {
      event.preventDefault();

      const ctrlLike = event.ctrlKey || event.metaKey;

      if (ctrlLike) {
        const focus = getCanvasPoint(event.clientX, event.clientY);
        const delta = -event.deltaY * 0.002;
        if (delta !== 0) {
          applyZoom(zoomRef.current * (1 + delta), focus);
        }
        return;
      }

      const { deltaX, deltaY } = event;
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      setPanState((prev) => ({
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    },
    [applyZoom, getCanvasPoint, setPanState]
  );

  React.useEffect(() => {
    const node = interactionLayerRef.current;
    if (!node) return;

    const listener = (event: WheelEvent) => {
      handleCanvasWheel(event);
    };

    node.addEventListener("wheel", listener, { passive: false });

    return () => {
      node.removeEventListener("wheel", listener);
    };
  }, [handleCanvasWheel]);

  const handleCanvasPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-table-node='true']")) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const currentTarget = event.currentTarget;
      const point = getCanvasPoint(event.clientX, event.clientY);

      if (event.pointerType === "touch") {
        activePointersRef.current.set(event.pointerId, point);

        if (activePointersRef.current.size === 2) {
          const [p1, p2] = Array.from(activePointersRef.current.values());
          pinchStateRef.current = {
            distance: Math.hypot(p1.x - p2.x, p1.y - p2.y),
            midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
            zoom: zoomRef.current,
            pan: panRef.current,
          };
          isPanningRef.current = false;
          setIsPanning(false);
        } else {
          pinchStateRef.current = null;
          isPanningRef.current = true;
          pointerTypeRef.current = event.pointerType;
          lastPanPointRef.current = { x: event.clientX, y: event.clientY };
          setIsPanning(true);
        }

        currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      isPanningRef.current = true;
      pointerTypeRef.current = event.pointerType;
      lastPanPointRef.current = { x: event.clientX, y: event.clientY };
      setIsPanning(true);
      currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [getCanvasPoint]
  );

  const handleCanvasPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const point = getCanvasPoint(event.clientX, event.clientY);

      if (event.pointerType === "touch") {
        activePointersRef.current.set(event.pointerId, point);

        if (activePointersRef.current.size === 2) {
          const [p1, p2] = Array.from(activePointersRef.current.values());
          const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

          const pinchState = pinchStateRef.current;
          if (!pinchState) {
            pinchStateRef.current = {
              distance,
              midpoint,
              zoom: zoomRef.current,
              pan: panRef.current,
            };
            isPanningRef.current = false;
            setIsPanning(false);
            return;
          }

          if (pinchState.distance > 0) {
            const ratio = distance / pinchState.distance;
            const targetZoom = clampZoom(pinchState.zoom * ratio);
            applyZoom(targetZoom, midpoint);
            pinchStateRef.current = {
              distance,
              midpoint,
              zoom: zoomRef.current,
              pan: panRef.current,
            };
          }
          event.preventDefault();
          return;
        }

        if (activePointersRef.current.size === 1) {
          if (!isPanningRef.current) {
            isPanningRef.current = true;
            pointerTypeRef.current = event.pointerType;
            setIsPanning(true);
          }
          lastPanPointRef.current = { x: event.clientX, y: event.clientY };
        }
      }

      if (isPanningRef.current && pointerTypeRef.current === event.pointerType) {
        const lastPoint = lastPanPointRef.current;
        if (!lastPoint) {
          lastPanPointRef.current = { x: event.clientX, y: event.clientY };
          return;
        }

        const deltaX = event.clientX - lastPoint.x;
        const deltaY = event.clientY - lastPoint.y;

        if (deltaX === 0 && deltaY === 0) {
          return;
        }

        lastPanPointRef.current = { x: event.clientX, y: event.clientY };

        setPanState((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));

        event.preventDefault();
      }
    },
    [applyZoom, clampZoom, getCanvasPoint, setPanState]
  );

  const endPanIfNeeded = React.useCallback(() => {
    isPanningRef.current = false;
    pointerTypeRef.current = null;
    lastPanPointRef.current = null;
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  const handleCanvasPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") {
        activePointersRef.current.delete(event.pointerId);
        if (activePointersRef.current.size < 2) {
          pinchStateRef.current = null;
        }
      }

      if (pointerTypeRef.current === event.pointerType) {
        endPanIfNeeded();
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [endPanIfNeeded]
  );

  const handleCanvasPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (pointerTypeRef.current === event.pointerType) {
        endPanIfNeeded();
      }
    },
    [endPanIfNeeded]
  );

  const screenToWorld = React.useCallback(
    (point: { x: number; y: number }) => {
      const currentPan = panRef.current;
      const currentZoom = zoomRef.current;
      return {
        x: (point.x - currentPan.x) / currentZoom,
        y: (point.y - currentPan.y) / currentZoom,
      };
    },
    []
  );

  const handleAddTable = React.useCallback(() => {
    if (!isAdmin) {
      return;
    }
    const size = canvasSizeRef.current;
    if (size) {
      const centerWorld = screenToWorld({
        x: size.width / 2,
        y: size.height / 2,
      });
      const desired = {
        x: centerWorld.x - TABLE_SIZE / 2,
        y: centerWorld.y - TABLE_SIZE / 2,
      };
      const clamped = clampTablePosition(desired.x, desired.y);
      addTable(clamped);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      addTable();
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
    addTable(clamped);
  }, [isAdmin, screenToWorld]);

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
              className="absolute left-0 top-0"
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
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
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 shadow">
                <span className="px-2 py-0.5 text-xs uppercase tracking-[0.25em] text-slate-500">
                  Mode
                </span>
                <button
                  type="button"
                  onClick={() => handleModeSelect("admin")}
                  className={[
                    "rounded-full px-2 py-1 text-xs font-semibold transition",
                    isAdmin
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-300 hover:text-white",
                  ].join(" ")}
                  disabled={isAdmin}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSelect("client")}
                  className={[
                    "rounded-full px-2 py-1 text-xs font-semibold transition",
                    isClient
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-300 hover:text-white",
                  ].join(" ")}
                  disabled={isClient}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={handleResetMode}
                  className="ml-1 rounded-full px-2 py-1 text-xs font-semibold text-slate-400 transition hover:text-white"
                >
                  Change
                </button>
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
            <span className="absolute -top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg">
              <Plus className="h-4 w-4" />
            </span>
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
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
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
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const [reservationDate, setReservationDate] = React.useState<string>(todayIso);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [guestName, setGuestName] = React.useState("");
  const [partySize, setPartySize] = React.useState(() =>
    Math.max(1, Math.min(table.chairs, 2))
  );
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  React.useEffect(() => {
    setReservationDate(todayIso);
    setSelectedSlot(null);
    setGuestName("");
    setPartySize(Math.max(1, Math.min(table.chairs, 2)));
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
      .filter((reservation) => reservation.tableId === table.id)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.slot.localeCompare(b.slot);
      });
  }, [reservations, table.id]);

  const slotIsUnavailable = React.useCallback(
    (slot: string) =>
      reservationsForDate.some((reservation) => reservation.slot === slot),
    [reservationsForDate]
  );

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
      setPartySize(Math.max(1, Math.min(table.chairs, 2)));
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
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
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
                  onChange={(event) => {
                    setReservationDate(event.target.value);
                    setSelectedSlot(null);
                    setFeedback(null);
                  }}
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

function DraggableTable({
  table,
  mode,
  isSelected,
  onSelect,
  onOpenDetail,
  zoom,
}: {
  table: Table;
  mode: PlannerMode;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  zoom: number;
}) {
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: table.x, y: table.y });
  const isAdmin = mode === "admin";
  const isClient = mode === "client";

  React.useEffect(() => {
    const clamped = clampTablePosition(table.x, table.y);
    setPosition(clamped);
    if (clamped.x !== table.x || clamped.y !== table.y) {
      updateTablePosition(table.id, clamped.x, clamped.y);
    }
  }, [table.id, table.x, table.y]);

  const handleStart = React.useCallback(
    (event: DraggableEvent) => {
      void event;
      if (!isAdmin) {
        return false;
      }
      onSelect();
      selectTable(table.id);
      setIsDragging(true);
      return undefined;
    },
    [isAdmin, onSelect, table.id]
  );

  const handleStop = React.useCallback(
    (_event: DraggableEvent, data: DraggableData) => {
      const clamped = clampTablePosition(data.x, data.y);
      setPosition(clamped);
      updateTablePosition(table.id, clamped.x, clamped.y);
      setIsDragging(false);
    },
    [table.id]
  );

  const handleDrag = React.useCallback((_event: DraggableEvent, data: DraggableData) => {
    const clamped = clampTablePosition(data.x, data.y);
    setPosition(clamped);
  }, []);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      selectTable(table.id);
      onSelect();
      if (isClient) {
        onOpenDetail();
      }
    },
    [isClient, onSelect, onOpenDetail, table.id]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isAdmin) {
        return;
      }
      event.stopPropagation();
      selectTable(table.id);
      onOpenDetail();
    },
    [isAdmin, onOpenDetail, table.id]
  );

  const stateClass = isDragging
    ? "scale-105 opacity-90 ring-2 ring-emerald-400/80 cursor-grabbing"
    : isSelected
    ? "ring-2 ring-emerald-400/70 cursor-grab"
    : isAdmin
    ? "cursor-grab hover:ring-2 hover:ring-white/40"
    : "cursor-pointer hover:ring-2 hover:ring-white/20";

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onStart={handleStart}
      onDrag={handleDrag}
      onStop={handleStop}
      disabled={!isAdmin}
      bounds={isAdmin ? TABLE_BOUNDS : undefined}
      scale={zoom}
    >
      <div
        ref={nodeRef}
        className={[
          "absolute flex h-24 w-24 items-center justify-center rounded-none border border-white/80 text-sm font-semibold text-slate-950 shadow-lg transition-colors",
          stateClass,
        ].join(" ")}
        style={{ backgroundColor: table.color }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        data-table-node="true"
        role="button"
        tabIndex={0}
      >
        {table.name}
        {renderChairs(table.chairs)}
      </div>
    </Draggable>
  );
}
function renderChairs(
  count: number,
  {
    size = TABLE_SIZE,
    chairSize = 18,
    offset = size / 2 + 16,
    chairClassName,
  }: {
    size?: number;
    chairSize?: number;
    offset?: number;
    chairClassName?: string;
  } = {}
) {
  if (count <= 0) {
    return null;
  }

  type Side = "top" | "bottom" | "right" | "left";
  const sideOrder: Side[] = ["top", "bottom", "right", "left"];
  const perSideTotals: Record<Side, number> = {
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
  };

  for (let i = 0; i < count; i++) {
    const side = sideOrder[i % sideOrder.length];
    perSideTotals[side] += 1;
  }

  const perSideIndex: Record<Side, number> = {
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
  };

  const rotationMap: Record<Side, number> = {
    top: 180,
    bottom: 0,
    right: -90,
    left: 90,
  };

  const chairs: React.ReactNode[] = [];

  for (let i = 0; i < count; i++) {
    const side = sideOrder[i % sideOrder.length];
    const seatIndex = perSideIndex[side];
    perSideIndex[side] += 1;

    const seatsOnSide = perSideTotals[side];
    const step = seatsOnSide > 0 ? size / (seatsOnSide + 1) : 0;

    let x = 0;
    let y = 0;

    if (side === "top" || side === "bottom") {
      const lateral = seatsOnSide > 1 ? -size / 2 + step * (seatIndex + 1) : 0;
      x = lateral;
      y = side === "top" ? -offset : offset;
    } else {
      const vertical = seatsOnSide > 1 ? -size / 2 + step * (seatIndex + 1) : 0;
      y = vertical;
      x = side === "left" ? -offset : offset;
    }

    const transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotationMap[side]}deg)`;

    chairs.push(
      <div
        key={`${side}-${seatIndex}`}
        className={[
          "pointer-events-none absolute flex items-center justify-center",
          chairClassName ?? "",
        ].join(" ")}
        style={{
          width: chairSize,
          height: chairSize,
          transform,
          transformOrigin: "center",
          top: "50%",
          left: "50%",
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-between">
          <div className="h-[32%] w-[70%] rounded-full bg-slate-500/70 shadow-sm" />
          <div className="flex h-[55%] w-full items-center justify-center rounded-[5px] border border-slate-800/80 bg-slate-200 shadow-[inset_0_-1px_0_rgba(15,23,42,0.32)]" />
        </div>
      </div>
    );
  }

  return <>{chairs}</>;
}

