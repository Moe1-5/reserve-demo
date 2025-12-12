import React from "react";
import { X } from "lucide-react";
import type { Divider } from "../lib/demoStore";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../constants/reservationConst";

type DraggableDividerProps = {
  divider: Divider;
  zoom: number;
  onUpdate: (id: string, updates: Partial<Divider> & { name?: string }) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  isAdmin: boolean; // Added prop
};

export function DraggableDivider({
  divider,
  zoom,
  onUpdate,
  onDelete,
  isSelected,
  onSelect,
  isAdmin,
}: DraggableDividerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [activeHandle, setActiveHandle] = React.useState<
    "n" | "s" | "e" | "w" | null
  >(null);

  const dragOffsetRef = React.useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = React.useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const [nameInput, setNameInput] = React.useState(divider.name || "Area");

  React.useEffect(() => {
    setNameInput(divider.name || "Area");
  }, [divider.name]);

  // --- CLIENT VIEW (STATIC) ---
  if (!isAdmin) {
    return (
      <div
        className="absolute pointer-events-none" // Pass-through clicks so it doesn't block background if needed, or remove if you want it clickable
        style={{
          left: divider.x,
          top: divider.y,
          width: divider.width,
          height: divider.height,
        }}
      >
        <div className="relative h-full w-full rounded-xl border-[4px] border-dashed border-gray-400 bg-gray-600/10 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-600 select-none truncate px-2">
            {divider.name || "Area"}
          </span>
        </div>
      </div>
    );
  }

  // --- ADMIN VIEW (INTERACTIVE) ---

  const handlePointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
    onSelect();

    dragOffsetRef.current = {
      x: event.clientX / zoom - divider.x,
      y: event.clientY / zoom - divider.y,
    };

    setIsDragging(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleResizeStart =
    (edge: "n" | "s" | "e" | "w") => (event: React.PointerEvent) => {
      event.stopPropagation();
      onSelect();

      resizeStartRef.current = {
        startX: divider.x,
        startY: divider.y,
        startWidth: divider.width,
        startHeight: divider.height,
        mouseX: event.clientX,
        mouseY: event.clientY,
      };

      setActiveHandle(edge);
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (isDragging && dragOffsetRef.current) {
      const mouseWorldX = event.clientX / zoom;
      const mouseWorldY = event.clientY / zoom;

      const newX = mouseWorldX - dragOffsetRef.current.x;
      const newY = mouseWorldY - dragOffsetRef.current.y;

      const clampedX = Math.max(0, Math.min(newX, WORLD_WIDTH - divider.width));
      const clampedY = Math.max(
        0,
        Math.min(newY, WORLD_HEIGHT - divider.height)
      );

      onUpdate(divider.id, { x: clampedX, y: clampedY });
    }

    if (activeHandle && resizeStartRef.current) {
      const { startX, startY, startWidth, startHeight, mouseX, mouseY } =
        resizeStartRef.current;

      const deltaX = (event.clientX - mouseX) / zoom;
      const deltaY = (event.clientY - mouseY) / zoom;

      let updates: Partial<Divider> = {};

      if (activeHandle === "n") {
        const maxDeltaY = startY;
        const validDeltaY = Math.max(deltaY, -maxDeltaY);
        const newHeight = Math.max(40, startHeight - validDeltaY);
        if (newHeight > 40) {
          updates.y = startY + validDeltaY;
          updates.height = newHeight;
        }
      } else if (activeHandle === "s") {
        const maxDeltaY = WORLD_HEIGHT - (startY + startHeight);
        const validDeltaY = Math.min(deltaY, maxDeltaY);
        updates.height = Math.max(40, startHeight + validDeltaY);
      } else if (activeHandle === "w") {
        const maxDeltaX = startX;
        const validDeltaX = Math.max(deltaX, -maxDeltaX);
        const newWidth = Math.max(50, startWidth - validDeltaX);
        if (newWidth > 50) {
          updates.x = startX + validDeltaX;
          updates.width = newWidth;
        }
      } else if (activeHandle === "e") {
        const maxDeltaX = WORLD_WIDTH - (startX + startWidth);
        const validDeltaX = Math.min(deltaX, maxDeltaX);
        updates.width = Math.max(50, startWidth + validDeltaX);
      }

      onUpdate(divider.id, updates);
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    setIsDragging(false);
    setActiveHandle(null);
    dragOffsetRef.current = null;
    resizeStartRef.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(e.target.value);
  };

  const handleNameBlur = () => {
    onUpdate(divider.id, { name: nameInput });
  };

  return (
    <div
      className="absolute touch-none group"
      style={{
        left: divider.x,
        top: divider.y,
        width: divider.width,
        height: divider.height,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`relative h-full w-full rounded-xl border-[4px] border-dashed flex items-center justify-center transition-all ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${
          isSelected
            ? "border-blue-500 bg-blue-500/20"
            : "border-gray-400 bg-gray-600/10"
        }`}
      >
        {isSelected ? (
          <input
            type="text"
            value={nameInput}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onPointerDown={(e) => e.stopPropagation()}
            className="bg-white/90 text-center text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 min-w-[80px]"
            autoFocus
          />
        ) : (
          <span className="text-sm font-bold text-gray-600 select-none pointer-events-none truncate px-2">
            {divider.name || "Area"}
          </span>
        )}

        {isSelected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(divider.id);
            }}
            className="absolute -right-4 -top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200 text-red-500 shadow-md hover:bg-red-50 hover:scale-110 transition z-30"
            aria-label="Delete area"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {isSelected && (
          <>
            <div
              className="absolute top-[-6px] left-1/2 -translate-x-1/2 h-3 w-10 bg-blue-500 rounded-full cursor-ns-resize hover:scale-125 transition shadow-sm z-20"
              onPointerDown={handleResizeStart("n")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <div
              className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 h-3 w-10 bg-blue-500 rounded-full cursor-ns-resize hover:scale-125 transition shadow-sm z-20"
              onPointerDown={handleResizeStart("s")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <div
              className="absolute left-[-6px] top-1/2 -translate-y-1/2 h-10 w-3 bg-blue-500 rounded-full cursor-ew-resize hover:scale-125 transition shadow-sm z-20"
              onPointerDown={handleResizeStart("w")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <div
              className="absolute right-[-6px] top-1/2 -translate-y-1/2 h-10 w-3 bg-blue-500 rounded-full cursor-ew-resize hover:scale-125 transition shadow-sm z-20"
              onPointerDown={handleResizeStart("e")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </>
        )}
      </div>
    </div>
  );
}
