import { Store } from "@tanstack/store";

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  chairs: number;
  shape?: "square" | "round";
};

export type Reservation = {
  id: string;
  tableId: string;
  date: string; // YYYY-MM-DD
  slot: string; // HH:mm
  name: string;
  partySize: number;
};

export type Floor = {
  id: string;
  name: string;
  tables: Table[];
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

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createFloor = (order: number): Floor => ({
  id: createId(),
  name: `Floor ${order}`,
  tables: [],
  reservations: [],
});

const initialFloor = createFloor(1);

export const demoStore = new Store<DemoState>({
  floors: [initialFloor],
  activeFloorId: initialFloor.id,
  selectedId: null,
  nextFloorNumber: 2,
  mode: "pending",
});

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
    chairs = 2,
  } = options;

  const newTable: Table = {
    id: createId(),
    name,
    x,
    y,
    color: color ?? pickColor(),
    chairs,
    shape: "square",
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
    updateSelectedTable(prev, (table) => ({ ...table, chairs: table.chairs + 1 })),
  );
};

export const removeChairFromSelected = () => {
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) =>
      table.chairs > 0 ? { ...table, chairs: table.chairs - 1 } : table,
    ),
  );
};

export const setChairsForSelected = (chairs: number) => {
  demoStore.setState((prev) =>
    updateSelectedTable(prev, (table) => {
      const sanitized = Math.max(0, Math.floor(Number.isFinite(chairs) ? chairs : 0));
      return { ...table, chairs: sanitized };
    }),
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
