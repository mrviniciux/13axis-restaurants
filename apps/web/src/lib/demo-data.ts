export type KitchenDemoTicket = {
  id: string;
  orderNumber: string;
  table: string;
  checkId: string;
  items: string[];
  elapsed: string;
  status: "Novo" | "Preparando" | "Pronto";
};

export const demoKitchenTickets: KitchenDemoTicket[] = [
  {
    id: "demo-order-104",
    orderNumber: "104",
    table: "Mesa 08",
    checkId: "CM-008-A",
    items: ["1× Hambúrguer da casa", "1× Batata rústica"],
    elapsed: "3 min",
    status: "Novo",
  },
  {
    id: "demo-order-107",
    orderNumber: "107",
    table: "Mesa 08",
    checkId: "CM-008-B",
    items: ["2× Risoto de cogumelos"],
    elapsed: "11 min",
    status: "Preparando",
  },
  {
    id: "demo-order-109",
    orderNumber: "109",
    table: "Mesa 03",
    checkId: "CM-003-A",
    items: ["1× Salada da estação", "1× Suco de laranja"],
    elapsed: "16 min",
    status: "Pronto",
  },
];
