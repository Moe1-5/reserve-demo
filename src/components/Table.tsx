import React from "react";
import { RotateCw } from "lucide-react";
import type { Table } from "../lib/demoStore";
import type { PlannerMode } from "../lib/demoStore";
import {
  selectTable,
  updateTablePosition,
  rotateSelectedTable,
} from "../lib/demoStore";
import { renderChairs } from "./renderChairs";

type DraggableTableProps = {
  table: Table;
  mode: PlannerMode;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  zoom: number;
  clampTablePosition: (x: number, y: number) => { x: number; y: number };
  detailOpen: boolean;
};

export function DraggableTable({
  table,
  mode,
  isSelected,
  onSelect,
  onOpenDetail,
  zoom,
  clampTablePosition,
  detailOpen,
}: DraggableTableProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const isAdmin = mode === "admin";
  const tableColor = table.color || "#54a065";

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!isAdmin) return;

    event.stopPropagation();
    selectTable(table.id);
    onSelect();

    dragStartRef.current = {
      x: event.clientX / zoom - table.x,
      y: event.clientY / zoom - table.y,
    };

    setIsDragging(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const worldX = event.clientX / zoom - dragStartRef.current.x;
    const worldY = event.clientY / zoom - dragStartRef.current.y;

    const clamped = clampTablePosition(worldX, worldY);
    updateTablePosition(table.id, clamped.x, clamped.y);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    }
  };

  // --- UPDATED CLICK LOGIC ---
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // Client: Open panel immediately on single click
    if (!isAdmin) {
      selectTable(table.id);
      onOpenDetail();
      return;
    }

    // Admin: Toggle focus logic
    selectTable(table.id);
    onOpenDetail();
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (!isAdmin) return;
    event.stopPropagation();
    selectTable(table.id);
    onOpenDetail();
  };

  const handleRotateClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    selectTable(table.id);
    rotateSelectedTable();
  };

  return (
    <div
      data-table-node="true"
      className="absolute pointer-events-auto"
      style={{
        left: table.x,
        top: table.y,
        width: table.width,
        height: table.height,
        transform: `rotate(${table.rotation}deg)`,
        transformOrigin: "center center",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={[
          "relative flex h-full w-full items-center justify-center rounded-md text-sm font-semibold transition-all",
          isSelected
            ? `shadow-[0_0_0_2px_#3b82f6] z-10`
            : "shadow-sm hover:shadow-md",
          isDragging
            ? "cursor-grabbing"
            : isAdmin
            ? "cursor-grab"
            : "cursor-pointer",
        ].join(" ")}
        style={{
          backgroundColor: tableColor,
          color: "white",
        }}
      >
        <span
          className="select-none text-white drop-shadow-sm pointer-events-none"
          style={{
            transform: `rotate(-${table.rotation}deg)`,
          }}
        >
          {table.name}
        </span>

        {isAdmin && (isHovering || isSelected) && (
          <button
            type="button"
            onClick={handleRotateClick}
            className="absolute -right-3 -top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 z-20"
            aria-label="Rotate table"
            style={{
              transform: `rotate(-${table.rotation}deg)`,
            }}
          >
            <RotateCw className="h-3 w-3" />
          </button>
        )}
      </div>

      {renderChairs(table.chairs, tableColor, {
        tableWidth: table.width,
        tableHeight: table.height,
        chairSize: 22,
        offset: 32,
      })}
    </div>
  );
}
