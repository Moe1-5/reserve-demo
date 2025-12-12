import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import {
  demoStore,
  type Floor,
  type Divider, // ADDED
  type Reservation,
  type Table,
} from "./demoStore";
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  TABLE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
} from "../constants/reservationConst";
import { isValidReservation, isValidTable } from "../utils/reservationUtils";

type CanvasExtras = {
  canvasStateByFloor?: Record<string, { pan: { x: number; y: number }; zoom: number }>;
};

type StoredFloor = {
  id?: unknown;
  name?: unknown;
  tables?: unknown;
  dividers?: unknown; // ADDED
  reservations?: unknown;
};

type UseFloorDataOptions = {
  onHydrate?: (extras: CanvasExtras) => void;
  getExtras?: () => CanvasExtras;
};

const clampTablePosition = (table: Table) => ({
  ...table,
  x: Math.min(Math.max(0, table.x), WORLD_WIDTH - TABLE_SIZE),
  y: Math.min(Math.max(0, table.y), WORLD_HEIGHT - TABLE_SIZE),
});

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let storeHydratedFromLocalStorage = false;

// Simple validation for dividers
function isValidDivider(value: unknown): value is Divider {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.x === "number" &&
    typeof c.y === "number" &&
    typeof c.width === "number" &&
    typeof c.height === "number"
  );
}

const sanitizeFloor = (floor: StoredFloor, fallbackName: string): Floor | null => {
  if (typeof floor !== "object" || floor === null) {
    return null;
  }

  const id = typeof floor.id === "string" && floor.id.trim() ? floor.id : null;
  const name = typeof floor.name === "string" && floor.name.trim() ? floor.name : fallbackName;

  const tables = Array.isArray(floor.tables)
    ? (floor.tables as unknown[])
      .filter(isValidTable)
      .map((table) => clampTablePosition({ ...table }))
    : [];

  // --- FIX: ADDED DIVIDER LOADING LOGIC ---
  const dividers = Array.isArray(floor.dividers)
    ? (floor.dividers as unknown[])
        .filter(isValidDivider)
        .map((d) => ({ ...d }))
    : [];

  const reservations = Array.isArray(floor.reservations)
    ? (floor.reservations as unknown[])
      .filter(isValidReservation)
      .map((reservation) => ({ ...reservation }))
    : [];

  if (!id) {
    return null;
  }

  return {
    id,
    name,
    tables,
    dividers, // INCLUDE DIVIDERS
    reservations,
  };
};

function hydrateStoreFromLocalStorage(onHydrate?: (extras: CanvasExtras) => void): CanvasExtras {
  const extrasCandidate: CanvasExtras = {};

  if (typeof window === "undefined") {
    return extrasCandidate;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return extrasCandidate;
    }

    const parsed = JSON.parse(raw) as {
      version?: unknown;
      floors?: unknown;
      tables?: unknown;
      activeFloorId?: unknown;
      selectedId?: unknown;
      nextFloorNumber?: unknown;
      extras?: unknown;
      pan?: unknown;
      zoom?: unknown;
      reservations?: unknown;
    };

    if (parsed.version !== STORAGE_VERSION) {
      return extrasCandidate;
    }

    let storedFloors = Array.isArray(parsed.floors)
      ? (parsed.floors as StoredFloor[]).map((floor, index) =>
        sanitizeFloor(floor, `Floor ${index + 1}`),
      ).filter((floor): floor is Floor => floor !== null)
      : [];

    let extras =
      parsed.extras && typeof parsed.extras === "object"
        ? (parsed.extras as CanvasExtras)
        : {};

    // Legacy migration logic (if needed)
    if (storedFloors.length === 0) {
      const legacyTables = Array.isArray(parsed.tables)
        ? (parsed.tables as unknown[])
          .filter(isValidTable)
          .map((table) => clampTablePosition({ ...(table as Table) }))
        : [];

      const legacyReservations = Array.isArray(parsed.reservations)
        ? (parsed.reservations as unknown[])
          .filter(isValidReservation)
          .map((reservation) => ({ ...(reservation as Reservation) }))
        : [];

      if (legacyTables.length > 0 || legacyReservations.length > 0) {
        const legacyFloorId =
          typeof parsed.activeFloorId === "string" && parsed.activeFloorId.trim()
            ? (parsed.activeFloorId as string)
            : generateId();
        storedFloors = [
          {
            id: legacyFloorId,
            name: "Floor 1",
            tables: legacyTables,
            dividers: [],
            reservations: legacyReservations,
          },
        ];
        // ... legacy canvas pan logic ...
      }
    }

    if (storedFloors.length > 0) {
      const activeId =
        typeof parsed.activeFloorId === "string" &&
          storedFloors.some((floor) => floor.id === parsed.activeFloorId)
          ? parsed.activeFloorId
          : storedFloors[0].id;

      const maybeSelectedId = typeof parsed.selectedId === "string" ? parsed.selectedId : null;
      const selectedExists = maybeSelectedId
        ? storedFloors.some((floor) => floor.tables.some((table) => table.id === maybeSelectedId))
        : false;

      const hintedNextFloorNumber =
        typeof parsed.nextFloorNumber === "number" && Number.isFinite(parsed.nextFloorNumber)
          ? Math.max(2, Math.floor(parsed.nextFloorNumber))
          : storedFloors.length + 1;

      demoStore.setState((prev) => ({
        ...prev,
        floors: storedFloors,
        activeFloorId: activeId,
        selectedId: selectedExists ? maybeSelectedId : null,
        nextFloorNumber: Math.max(hintedNextFloorNumber, storedFloors.length + 1),
      }));
    }

    Object.assign(extrasCandidate, extras);
  } catch {
    // ignore malformed storage
  } finally {
    storeHydratedFromLocalStorage = true;
  }

  onHydrate?.(extrasCandidate);
  return extrasCandidate;
}

export function useFloorData(options?: UseFloorDataOptions) {
  const hasHydratedRef = useRef(false);
  const extrasRef = useRef<CanvasExtras | null>(null);
  const getExtras = options?.getExtras;
  const hydrationAttemptedRef = useRef(false);

  const storeState = useStore(demoStore);

  const floors = storeState?.floors ?? [];
  const activeFloorId = storeState?.activeFloorId ?? null;
  const selectedId = storeState?.selectedId ?? null;
  const nextFloorNumber = storeState?.nextFloorNumber ?? 1;

  const activeFloor = floors.find((floor) => floor.id === activeFloorId) ?? null;
  const tables: Table[] = activeFloor?.tables ?? [];
  // Ensure dividers is never undefined
  const dividers: Divider[] = activeFloor?.dividers ?? []; 
  const reservations: Reservation[] = activeFloor?.reservations ?? [];

  const setReservations = useCallback(
    (updater: React.SetStateAction<Reservation[]>) => {
      demoStore.setState((prev) => {
        const index = prev.floors.findIndex((floor) => floor.id === prev.activeFloorId);
        if (index === -1) {
          return prev;
        }

        const floor = prev.floors[index];
        const nextReservations =
          typeof updater === "function" ? (updater as (current: Reservation[]) => Reservation[])(floor.reservations) : updater;

        if (nextReservations === floor.reservations) {
          return prev;
        }

        const floors = [...prev.floors];
        floors[index] = { ...floor, reservations: nextReservations };

        return { ...prev, floors };
      });
    },[]);


  useEffect(() => {
    if (hydrationAttemptedRef.current || typeof window === "undefined") {
      return;
    }

    if (!storeHydratedFromLocalStorage) {
      const extras = hydrateStoreFromLocalStorage();
      extrasRef.current = extras;
    } else {
      extrasRef.current = extrasRef.current ?? {};
    }
    hydrationAttemptedRef.current = true;
    hasHydratedRef.current = true;
  }, []);


  useEffect(() => {
    if (!hasHydratedRef.current || typeof window === "undefined") {
      return;
    }

    const payload: Record<string, unknown> = {
      version: STORAGE_VERSION,
      floors: floors.map((floor) => ({
        id: floor.id,
        name: floor.name,
        tables: floor.tables,
        dividers: floor.dividers, // INCLUDE DIVIDERS IN SAVE
        reservations: floor.reservations,
      })),
      activeFloorId,
      selectedId,
      nextFloorNumber,
    };

    const extras = getExtras?.();
    if (extras && (extras.canvasStateByFloor)) {
      payload.extras = extras;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore write errors
    }
  }, [floors, activeFloorId, selectedId, nextFloorNumber, getExtras]);

  return {
    floors,
    activeFloorId,
    tables,
    dividers, // Export this
    selectedId,
    reservations,
    setReservations,
    isHydrated: hasHydratedRef.current,
    storedExtras: extrasRef.current,
  };
}
