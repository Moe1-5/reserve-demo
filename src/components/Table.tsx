import React from "react";
import Draggable from "react-draggable";
import type { DraggableData, DraggableEvent } from "react-draggable";
import {
  selectTable,
  updateTablePosition,
  type PlannerMode,
  type Table,
} from "../lib/demoStore";
import { TABLE_BOUNDS } from "../constants/reservationConst";
import { renderChairs } from "./renderChairs";

type ClampFn = (x: number, y: number) => { x: number; y: number };

type DraggableTableProps = {
  table: Table;
  mode: PlannerMode;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  zoom: number;
  clampTablePosition: ClampFn;
};

export function DraggableTable({
  table,
  mode,
  isSelected,
  onSelect,
  onOpenDetail,
  zoom,
  clampTablePosition,
}: DraggableTableProps) {
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
  }, [clampTablePosition, table.id, table.x, table.y]);

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
    [isAdmin, onSelect, table.id],
  );

  const handleStop = React.useCallback(
    (_event: DraggableEvent, data: DraggableData) => {
      const clamped = clampTablePosition(data.x, data.y);
      setPosition(clamped);
      updateTablePosition(table.id, clamped.x, clamped.y);
      setIsDragging(false);
    },
    [clampTablePosition, table.id],
  );

  const handleDrag = React.useCallback(
    (_event: DraggableEvent, data: DraggableData) => {
      const clamped = clampTablePosition(data.x, data.y);
      setPosition(clamped);
    },
    [clampTablePosition],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      selectTable(table.id);
      onSelect();
      if (isClient) {
        onOpenDetail();
      }
    },
    [isClient, onOpenDetail, onSelect, table.id],
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
    [isAdmin, onOpenDetail, table.id],
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
