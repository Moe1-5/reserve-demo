import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import {
  demoStore,
  type Floor,
  type PlannerMode,
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
  mode?: PlannerMode | null;
};

type StoredFloor = {
  id?: unknown;
  name?: unknown;
  tables?: unknown;
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
      mode?: unknown;
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
            reservations: legacyReservations,
          },
        ];

        const panCandidate =
          parsed.pan &&
          typeof parsed.pan === "object" &&
          parsed.pan !== null &&
          typeof (parsed.pan as { x?: unknown }).x === "number" &&
          typeof (parsed.pan as { y?: unknown }).y === "number"
            ? {
                x: (parsed.pan as { x: number }).x,
                y: (parsed.pan as { y: number }).y,
              }
            : null;

        const zoomCandidate =
          typeof parsed.zoom === "number"
            ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsed.zoom))
            : null;

        if (panCandidate && zoomCandidate !== null) {
          extras = {
            ...extras,
            canvasStateByFloor: {
              ...(extras.canvasStateByFloor ?? {}),
              [legacyFloorId]: {
                pan: panCandidate,
                zoom: zoomCandidate,
              },
            },
          };
        }

        if (parsed.mode === "admin" || parsed.mode === "client") {
          extras = { ...extras, mode: parsed.mode };
        } else if (parsed.mode === null) {
          extras = { ...extras, mode: null };
        }
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
  // const { floors, activeFloorId, selectedId, nextFloorNumber } = useStore(demoStore);
  const hasHydratedRef = useRef(false);
  const extrasRef = useRef<CanvasExtras | null>(null);
  const onHydrate = options?.onHydrate;
  const getExtras = options?.getExtras;
  const hydrationAttemptedRef = useRef(false);


   if (
    typeof window !== "undefined" &&
    !hydrationAttemptedRef.current &&
    !storeHydratedFromLocalStorage
  ) {
    const extras = hydrateStoreFromLocalStorage(onHydrate);
    extrasRef.current = extras;
    hydrationAttemptedRef.current = true;
    hasHydratedRef.current = true;
  } else if (typeof window !== "undefined" && !hydrationAttemptedRef.current) {
    extrasRef.current = extrasRef.current ?? {};
    hydrationAttemptedRef.current = true;
    hasHydratedRef.current = true;
  }

  const storeState = useStore(demoStore);

  const floors = storeState?.floors ?? [];
  const activeFloorId = storeState?.activeFloorId ?? null;
  const selectedId = storeState?.selectedId ?? null;
  const nextFloorNumber = storeState?.nextFloorNumber ?? 1;

  const activeFloor = floors.find((floor) => floor.id === activeFloorId) ?? null;
  const tables: Table[] = activeFloor?.tables ?? [];
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
    },
    [],
  );


 

  useEffect(() => {
    if (hydrationAttemptedRef.current) {
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
      }
      return;
    }

    const extras = hydrateStoreFromLocalStorage(onHydrate);
    extrasRef.current = extras;
    hydrationAttemptedRef.current = true;
    hasHydratedRef.current = true;
  }, [onHydrate]);

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
        reservations: floor.reservations,
      })),
      activeFloorId,
      selectedId,
      nextFloorNumber,
    };

    const extras = getExtras?.();
    if (extras && (extras.canvasStateByFloor || extras.mode !== undefined)) {
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
    selectedId,
    reservations,
    setReservations,
    isHydrated: hasHydratedRef.current,
    storedExtras: extrasRef.current,
  };
}
