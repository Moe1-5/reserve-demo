import React from "react";
import { TABLE_SIZE } from "../constants/reservationConst";

export type RenderChairsOptions = {
  size?: number;
  chairSize?: number;
  offset?: number;
  chairClassName?: string;
};

export function renderChairs(
  count: number,
  {
    size = TABLE_SIZE,
    chairSize = 18,
    offset = size / 2 + 16,
    chairClassName,
  }: RenderChairsOptions = {},
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
      </div>,
    );
  }

  return <>{chairs}</>;
}

