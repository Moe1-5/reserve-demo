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

type DemoState = {
    tables: Table[];
    selectedId: string | null;
}

const defaultPalette = ["#22c55e", "#f97316", "#38bdf8", "#f43f5e", "#c084fc", "#facc15", "#fb7185"];

export const demoStore = new Store<DemoState>({
    tables: [],
    selectedId: null,
});

export type AddTableOptions = {
    name?: string;
    color?: string;
    x?: number;
    y?: number;
    chairs?: number;
};

export const addTable = (options: AddTableOptions = {}) => {
    demoStore.setState((prev: DemoState) => {
        const {
            name = "Table",
            color,
            x = 60,
            y = 60,
            chairs = 2,
        } = options;

        const nextColor =
            color ?? defaultPalette[Math.floor(Math.random() * defaultPalette.length)];

        const newTable: Table = {
            id: crypto.randomUUID(),
            name,
            x,
            y,
            color: nextColor,
            chairs,
            shape: "square",
        };

        return {
            tables: [...prev.tables, newTable],
            selectedId: newTable.id,
        };
    });
};

export const updateTablePosition = (id: string, x: number, y: number) => {
    demoStore.setState((prev: DemoState) => ({
        ...prev,
        tables: prev.tables.map((t) =>
            t.id === id ? { ...t, x, y } : t
        ),
    }));
};

export const selectTable = (id: string | null) => {
    demoStore.setState((prev: DemoState) => ({
        ...prev,
        selectedId: id,
    }));
};

export const addChairToSelected = () => {
    demoStore.setState((prev: DemoState) => {
        if (!prev.selectedId) {
            return prev;
        }
        return {
            ...prev,
            tables: prev.tables.map((t) =>
                t.id === prev.selectedId
                    ? { ...t, chairs: t.chairs + 1 }
                    : t
            ),
        };
    });
};

export const removeChairFromSelected = () => {
    demoStore.setState((prev: DemoState) => {
        if (!prev.selectedId) {
            return prev;
        }
        return {
            ...prev,
            tables: prev.tables.map((t) =>
                t.id === prev.selectedId && t.chairs > 0
                    ? { ...t, chairs: t.chairs - 1 }
                    : t
            ),
        };
    });
};

export const setChairsForSelected = (chairs: number) => {
    demoStore.setState((prev: DemoState) => {
        if (!prev.selectedId) {
            return prev;
        }

        const sanitized = Math.max(0, Math.floor(Number.isFinite(chairs) ? chairs : 0));

        return {
            ...prev,
            tables: prev.tables.map((t) =>
                t.id === prev.selectedId ? { ...t, chairs: sanitized } : t
            ),
        };
    });
};

export const deleteSelectedTable = () => {
    demoStore.setState((prev: DemoState) => {
        if (!prev.selectedId) {
            return prev;
        }

        const tables = prev.tables.filter((t) => t.id !== prev.selectedId);

        return {
            tables,
            selectedId: tables.length ? tables[tables.length - 1].id : null,
        };
    });
};
