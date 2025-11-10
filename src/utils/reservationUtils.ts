import type {Table, Reservation } from "../lib/demoStore";



export function isValidTable(value: unknown): value is Table {
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



export function isValidReservation(value: unknown): value is Reservation {
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
