import { Store } from "@tanstack/store";

const DEFAULT_TABLE_WIDTH = 120;
const DEFAULT_TABLE_HEIGHT = 80;
const CHAIR_PAIR_WIDTH_INCREMENT = 30;

function calculateTableWidth(chairs: number): number {
  const pairs = Math.floor(chairs / 2);
  return DEFAULT_TABLE_WIDTH + (pairs * CHAIR_PAIR_WIDTH_INCREMENT);
}

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  chairs: number;
  shape?: "square" | "round";
  rotation: number;
  width: number;
  height: number;
};

export type Divider = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string; 
};

export type Reservation = {
  id: string;
  tableId: string;
  date: string; // YYYY-MM-DD
  slot: string; // HH:mm
  name: string;
  partySize: number;
  clientId?: string;
};

export type Floor = {
  id: string;
  name: string;
  tables: Table[];
  dividers: Divider[];
  reservations: Reservation[];
};

type DemoState = {
  floors: Floor[];
  activeFloorId: string | null;
  selectedId: string | null;
  nextFloorNumber: number;
  mode: PlannerMode;
};

export type PlannerMode = "pending" | "admin" | "client";

export type AddTableOptions = {
  name?: string;
  color?: string;
  x?: number;
  y?: number;
  chairs?: number;
};

const defaultPalette = [
  "#22c55e",
  "#f97316",
  "#38bdf8",
  "#f43f5e",
  "#c084fc",
  "#facc15",
  "#fb7185",
];

const STORAGE_KEYS = {
  CLIENT_ID: "neutro_session_client_id",
  CLIENT_RESERVATIONS: "neutro_client_reservations",
} as const;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;


const createFloor = (order: number): Floor => ({
  id: createId(),
  name: `Floor ${order}`,
  tables: [],
  dividers: [],
  reservations: [],
});
const getInitialMode = (): PlannerMode => {
  try {
    const stored = localStorage.getItem("neutro_planner_mode");
    if (stored === "admin" || stored === "client" || stored === "pending") {
      return stored as PlannerMode;
    }
  } catch (error) {
  }
  return "pending";
}

const initialFloor = createFloor(1);

export const demoStore = new Store<DemoState>({
  floors: [initialFloor],
  activeFloorId: initialFloor.id,
  selectedId: null,
  nextFloorNumber: 2,
  mode:getInitialMode(),
});

export const getCreateClientId = (): string => {
  let clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
  
  if(clientId){
    return clientId;
  }

  clientId = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
  return clientId;
}

export const loadClientReservations = (clientId: string): Reservation[] => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.CLIENT_RESERVATIONS}_${clientId}`);
      return stored ? JSON.parse(stored) : []
    } catch {
      return [];
    }
};

export const saveClientReservations = (clientId: string, reservations: Reservation[]) => {
  try {
    localStorage.setItem(`${STORAGE_KEYS.CLIENT_RESERVATIONS}_${clientId}`, JSON.stringify(reservations));
  }catch (error){
    console.error("Failed To Save Reservations:", error)
  }
}

const applyToActiveFloor = (state: DemoState, mutator: (floor: Floor) => Floor): DemoState => {
  const index = state.floors.findIndex((floor) => floor.id === state.activeFloorId);
  if (index === -1) {
    return state;
  }

  const floor = state.floors[index];
  const updated = mutator(floor);
  if (updated === floor) {
    return state;
  }

  const floors = [...state.floors];
  floors[index] = updated;
  return { ...state, floors };
};

const updateSelectedTable = (
  state: DemoState,
  updater: (table: Table) => Table,
): DemoState => {
  const selectedId = state.selectedId;
  if (!selectedId) {
    return state;
  }

  return applyToActiveFloor(state, (floor) => {
    let changed = false;
    const tables = floor.tables.map((table) => {
      if (table.id !== selectedId) {
        return table;
      }
      changed = true;
      return updater(table);
    });
    return changed ? { ...floor, tables } : floor;
  });
};

const pickColor = () => defaultPalette[Math.floor(Math.random() * defaultPalette.length)];

export const addFloor = (label?: string) => {
  const newId = createId();
  demoStore.setState((prev) => {
    const order = prev.nextFloorNumber;
    const floor: Floor = {
      id: newId,
      name: label?.trim() || `Floor ${order}`,
      tables: [],
      dividers: [],
      reservations: [],
    };

    return {
      ...prev,
      floors: [...prev.floors, floor],
      activeFloorId: floor.id,
      selectedId: null,
      nextFloorNumber: order + 1,
    };
  });
  return newId;
};

export const setActiveFloor = (id: string) => {
  demoStore.setState((prev) => {
    if (prev.activeFloorId === id) {
      return prev;
    }

    if (!prev.floors.some((floor) => floor.id === id)) {
      return prev;
    }

    return {
      ...prev,
      activeFloorId: id,
      selectedId: null,
    };
  });
};

export const addTable = (options: AddTableOptions = {}) => {
  const {
    name = "Table",
    color,
    x = 60,
    y = 60,
    chairs = 4, 
  } = options;

  const newTable: Table = {
    id: createId(),
    name,
    x,
    y,
    color: color ?? pickColor(),
    chairs,
    shape: "square",
    rotation: 0,
    width: calculateTableWidth(chairs),
    height: DEFAULT_TABLE_HEIGHT,
  };

  demoStore.setState((prev) => {
    const next = applyToActiveFloor(prev, (floor) => ({
      ...floor,
      tables: [...floor.tables, newTable],
    }));

    if (next === prev) {
      return prev;
    }

    return {
      ...next,
      selectedId: newTable.id,
    };
  });
};

export const updateTablePosition = (id: string, x: number, y: number) => {
  demoStore.setState((prev) =>
    applyToActiveFloor(prev, (floor) => ({
      ...floor,
      tables: floor.tables.map((table) =>
        table.id === id ? { ...table, x, y } : table,
      ),
    })),
  );
};

export const selectTable = (id: string | null) => {
  demoStore.setState((prev) => {
    if (id === null) {
      if (prev.selectedId === null) {
        return prev;
      }
      return { ...prev, selectedId: null };
    }

    const activeFloor = prev.floors.find((floor) => floor.id === prev.activeFloorId);
    if (!activeFloor || !activeFloor.tables.some((table) => table.id === id)) {
      return prev;
    }

    return { ...prev, selectedId: id };
  });
};

export const addChairToSelected = () => {
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) => ({ 
      ...table, 
      chairs: table.chairs + 2,
      width: calculateTableWidth(table.chairs + 2)
    })),
  );
};

export const removeChairFromSelected = () => {
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) =>
      table.chairs > 2 ? { 
        ...table, 
        chairs: table.chairs - 2,
        width: calculateTableWidth(table.chairs - 2)
      } : table,
    ),
  );
};

export const setChairsForSelected = (chairs: number) => {
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) => {
      const evenChairs = Math.max(2, Math.floor(chairs / 2) * 2);
      return { 
        ...table, 
        chairs: evenChairs,
        width: calculateTableWidth(evenChairs)
      };
    }),
  );
};

export const rotateSelectedTable = () => {
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) => ({
      ...table,
      rotation: (table.rotation + 45) % 360,
    })),
  );
};

// --- FIX: ADDED DEFENSIVE CHECKS (|| []) TO PREVENT CRASH ---
export function addDivider(opts?: Partial<Divider>) {
  demoStore.setState((state) => {
    const floorIndex = state.floors.findIndex((f) => f.id === state.activeFloorId);
    if (floorIndex === -1) return state;

    const newDivider: Divider = {
      id: crypto.randomUUID(),
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      name: "Area",
      ...opts,
    };

    const newFloors = [...state.floors];
    newFloors[floorIndex] = {
      ...newFloors[floorIndex],
      // Fallback to empty array if dividers is undefined
      dividers: [...(newFloors[floorIndex].dividers || []), newDivider], 
    };

    return { ...state, floors: newFloors };
  });
}

export const updateDivider = (id: string, updates: Partial<Divider>) => {
  demoStore.setState((prev) =>
    applyToActiveFloor(prev, (floor) => ({
      ...floor,
      // Fallback to empty array
      dividers: (floor.dividers || []).map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),
  );
};

export const deleteSelectedDivider = (id: string) => {
  demoStore.setState((prev) =>
    applyToActiveFloor(prev, (floor) => ({
      ...floor,
      // Fallback to empty array
      dividers: (floor.dividers || []).filter((d) => d.id !== id),
    })),
  );
};

export const setNameForSelected = (name: string) => {
  const normalized = name.trim() || "Table";
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) => ({ ...table, name: normalized })),
  );
};

export const deleteSelectedTable = () => {
  demoStore.setState((prev) => {
    const selectedId = prev.selectedId;
    if (!selectedId) {
      return prev;
    }

    const index = prev.floors.findIndex((floor) => floor.id === prev.activeFloorId);
    if (index === -1) {
      return prev;
    }

    const floor = prev.floors[index];
    const tables = floor.tables.filter((table) => table.id !== selectedId);
    if (tables.length === floor.tables.length) {
      return prev;
    }

    const nextSelectedId = tables.length ? tables[tables.length - 1].id : null;
    const floors = [...prev.floors];
    floors[index] = { ...floor, tables };

    return {
      ...prev,
      floors,
      selectedId: nextSelectedId,
    };
  });
};

export const setPlannerMode = (mode: PlannerMode) => {
  try {
    localStorage.setItem('neutro_planner_mode', mode);
  }catch(error){
    console.error("Failed To Save Mode", error)
  }

  demoStore.setState((prev) => {
    if (prev.mode === mode) {
      return prev;
    }
    return {
      ...prev,
      mode,
    };
  });
};
