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
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

type CanvasBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function calculateCanvasBounds(
  size: { width: number; height: number } | null,
  scale: number
): CanvasBounds | null {
  if (!size) return null;
  const maxX = Math.max(0, size.width / scale - TABLE_SIZE);
  const maxY = Math.max(0, size.height / scale - TABLE_SIZE);
  return {
    left: 0,
    top: 0,
    right: maxX,
    bottom: maxY,
  };
}

export default function ReservationPanelDemo() {
  const { tables, selectedId } = useStore(demoStore);
  const selectedTable = tables.find((table) => table.id === selectedId) ?? null;
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [canvasSize, setCanvasSize] = React.useState<{ width: number; height: number } | null>(null);
  const [canvasBounds, setCanvasBounds] = React.useState<CanvasBounds | null>(null);

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

  React.useEffect(() => {
    const bounds = calculateCanvasBounds(canvasSize, zoom);
    setCanvasBounds(bounds);

    if (!bounds) {
      return;
    }

    demoStore.setState((prev) => {
      let changed = false;

      const tablesWithinBounds = prev.tables.map((table) => {
        const x = Math.min(Math.max(bounds.left, table.x), bounds.right);
        const y = Math.min(Math.max(bounds.top, table.y), bounds.bottom);

        if (x !== table.x || y !== table.y) {
          changed = true;
          return { ...table, x, y };
        }

        return table;
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        tables: tablesWithinBounds,
      };
    });
  }, [canvasSize, zoom]);

  const handleZoomIn = React.useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, prev + ZOOM_STEP);
      return Math.round(next * 100) / 100;
    });
  }, []);

  const handleZoomOut = React.useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, prev - ZOOM_STEP);
      return Math.round(next * 100) / 100;
    });
  }, []);

  const handleZoomReset = React.useCallback(() => {
    setZoom(1);
  }, []);

  const handleAddTable = React.useCallback(() => {
    if (canvasBounds) {
      const x = canvasBounds.left + (canvasBounds.right - canvasBounds.left) / 2;
      const y = canvasBounds.top + (canvasBounds.bottom - canvasBounds.top) / 2;
      addTable({
        x,
        y,
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      addTable();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = rect.width / 2 - TABLE_SIZE / 2;
    const y = rect.height / 2 - TABLE_SIZE / 2;

    addTable({
      x,
      y,
    });
  }, [canvasBounds]);

  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="-mx-4 flex h-full min-h-0 flex-1 flex-col gap-6 sm:-mx-6 lg:-mx-10">
      <div className="relative flex flex-1 overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900">
        <CanvasTools
          open={sidebarOpen}
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
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(90deg,_rgba(255,255,255,0.03)_1px,_transparent_1px),_linear-gradient(180deg,_rgba(255,255,255,0.03)_1px,_transparent_1px)] bg-[size:64px_64px]" />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.08),_transparent_55%)]" />

          <div
            className="absolute inset-0 z-10"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {tables.map((table) => (
              <DraggableTable
                key={table.id}
                table={table}
                isSelected={table.id === selectedId}
                onSelect={() => setDetailOpen(false)}
                onOpenDetail={() => setDetailOpen(true)}
                zoom={zoom}
                bounds={canvasBounds}
              />
            ))}
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
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Drag tables to reposition | Double-click to edit
            </div>
          </div>

          {tables.length === 0 && (
            <div className="absolute left-1/2 top-1/2 z-30 w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-800 bg-slate-900/85 p-6 text-center text-sm text-slate-300 shadow-lg backdrop-blur">
              <p className="text-base font-semibold text-white">
                Ready to design tonight&apos;s floor?
              </p>
              <p className="mt-2 text-slate-400">
                Tap the table template to drop it in the center, then drag to place.
              </p>
            </div>
          )}
        </div>
      </div>

      {detailOpen && selectedTable && (
        <TableDetailSheet
          table={selectedTable}
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
  onAddTable,
  onToggleSidebar,
}: {
  open: boolean;
  onAddTable: () => void;
  onToggleSidebar: () => void;
}) {
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
  onClose,
}: {
  table: Table;
  onClose: () => void;
}) {
  const [chairInput, setChairInput] = React.useState<string>(
    table.chairs.toString()
  );

  React.useEffect(() => {
    setChairInput(table.chairs.toString());
  }, [table.id, table.chairs]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (/^\d*$/.test(value)) {
      setChairInput(value);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        setChairsForSelected(parsed);
      }
    }
  };

  const handleBlur = () => {
    const parsed = Number.parseInt(chairInput, 10);
    if (Number.isNaN(parsed)) {
      setChairInput(table.chairs.toString());
    } else {
      setChairsForSelected(parsed);
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Table Focus
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {table.name}
            </p>
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
                onChange={handleChange}
                onBlur={handleBlur}
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

function DraggableTable({
  table,
  isSelected,
  onSelect,
  onOpenDetail,
  zoom,
  bounds,
}: {
  table: Table;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  zoom: number;
  bounds: CanvasBounds | null;
}) {
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: table.x, y: table.y });

  React.useEffect(() => {
    setPosition({ x: table.x, y: table.y });
  }, [table.x, table.y]);

  const handleStart = React.useCallback(() => {
    onSelect();
    selectTable(table.id);
    setIsDragging(true);
  }, [onSelect, table.id]);

  const handleStop = React.useCallback(
    (_event: DraggableEvent, data: DraggableData) => {
      setPosition({ x: data.x, y: data.y });
      updateTablePosition(table.id, data.x, data.y);
      setIsDragging(false);
    },
    [table.id]
  );

  const handleDrag = React.useCallback((_event: DraggableEvent, data: DraggableData) => {
    setPosition({ x: data.x, y: data.y });
  }, []);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onSelect();
      selectTable(table.id);
    },
    [onSelect, table.id]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      selectTable(table.id);
      onOpenDetail();
    },
    [table.id, onOpenDetail]
  );

  const stateClass = isDragging
    ? "scale-105 opacity-90 ring-2 ring-emerald-400/80 cursor-grabbing"
    : isSelected
    ? "ring-2 ring-emerald-400/70 cursor-grab"
    : "cursor-grab hover:ring-2 hover:ring-white/40";

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onStart={handleStart}
      onDrag={handleDrag}
      onStop={handleStop}
      bounds={bounds ?? undefined}
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
