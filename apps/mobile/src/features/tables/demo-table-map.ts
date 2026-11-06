import { create } from "zustand";

export type DemoTableStatus =
  | "free"
  | "occupied"
  | "reserved"
  | "closing";

export type TableStatusFilter = "all" | DemoTableStatus;

export type DemoTable = {
  id: string;
  number: string;
  status: DemoTableStatus;
  openComandas: readonly DemoOpenComanda[];
};

export type DemoOpenComanda = {
  id: string;
  label: string;
};

export const DEMO_TABLES: readonly DemoTable[] = [
  { id: "demo-table-01", number: "01", status: "free", openComandas: [] },
  {
    id: "demo-table-02",
    number: "02",
    status: "occupied",
    openComandas: [
      { id: "demo-comanda-02-a", label: "Comanda 1" },
      { id: "demo-comanda-02-b", label: "Comanda 2" },
    ],
  },
  { id: "demo-table-03", number: "03", status: "reserved", openComandas: [] },
  { id: "demo-table-04", number: "04", status: "closing", openComandas: [] },
  { id: "demo-table-05", number: "05", status: "free", openComandas: [] },
  {
    id: "demo-table-06",
    number: "06",
    status: "occupied",
    openComandas: [{ id: "demo-comanda-06-a", label: "Comanda 1" }],
  },
  { id: "demo-table-07", number: "07", status: "reserved", openComandas: [] },
  { id: "demo-table-08", number: "08", status: "free", openComandas: [] },
  {
    id: "demo-table-09",
    number: "09",
    status: "occupied",
    openComandas: [
      { id: "demo-comanda-09-a", label: "Comanda 1" },
      { id: "demo-comanda-09-b", label: "Comanda 2" },
    ],
  },
  { id: "demo-table-10", number: "10", status: "closing", openComandas: [] },
  { id: "demo-table-11", number: "11", status: "free", openComandas: [] },
  { id: "demo-table-12", number: "12", status: "reserved", openComandas: [] },
];

type DemoTableMapState = {
  filter: TableStatusFilter;
  setFilter: (filter: TableStatusFilter) => void;
};

export const useDemoTableMapStore = create<DemoTableMapState>((set) => ({
  filter: "all",
  setFilter: (filter) => set({ filter }),
}));
