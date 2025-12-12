import React from "react";

type RenderChairsOptions = {
  tableWidth: number;
  tableHeight: number;
  chairSize?: number;
  offset?: number;
};

export function renderChairs(
  chairCount: number,
  tableColor: string,
  options: RenderChairsOptions
) {
  // FIX: Removed 'tableHeight' from destructuring
  const { tableWidth, chairSize = 28, offset = 34 } = options;
  const chairs: React.ReactElement[] = [];
  const chairsPerSide = Math.floor(chairCount / 2);

  if (chairsPerSide === 0) {
    return <>{chairs}</>;
  }

  const spacing =
    chairsPerSide > 1 ? tableWidth / (chairsPerSide + 1) : tableWidth / 2;

  const seatHeight = chairSize * 0.85;
  const backrestHeight = 4;
  const gap = 4;

  // Top chairs (Backrest at TOP)
  for (let i = 0; i < chairsPerSide; i++) {
    const x = spacing * (i + 1);
    chairs.push(
      <div
        key={`top-${i}`}
        className="absolute flex flex-col items-center"
        style={{
          left: x - chairSize / 2,
          top: -offset,
          width: chairSize,
          height: seatHeight + backrestHeight + gap,
        }}
      >
        {/* Backrest (Thin Line) */}
        <div
          style={{
            width: "100%",
            height: backrestHeight,
            backgroundColor: tableColor,
            borderRadius: "4px",
            marginBottom: gap,
          }}
        />
        {/* Seat (Wide Square) */}
        <div
          style={{
            width: "100%",
            height: seatHeight,
            backgroundColor: tableColor,
            borderRadius: "6px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        />
      </div>
    );
  }

  // Bottom chairs (Backrest at BOTTOM)
  for (let i = 0; i < chairsPerSide; i++) {
    const x = spacing * (i + 1);
    chairs.push(
      <div
        key={`bottom-${i}`}
        className="absolute flex flex-col items-center justify-end"
        style={{
          left: x - chairSize / 2,
          bottom: -offset,
          width: chairSize,
          height: seatHeight + backrestHeight + gap,
        }}
      >
        {/* Seat (Wide Square) */}
        <div
          style={{
            width: "100%",
            height: seatHeight,
            backgroundColor: tableColor,
            borderRadius: "6px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: gap,
          }}
        />
        {/* Backrest (Thin Line) */}
        <div
          style={{
            width: "100%",
            height: backrestHeight,
            backgroundColor: tableColor,
            borderRadius: "4px",
          }}
        />
      </div>
    );
  }

  return <>{chairs}</>;
}
