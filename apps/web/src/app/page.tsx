import {
  ArrowRight,
  Clock3,
  CookingPot,
  DollarSign,
  Info,
  LayoutGrid,
  ShoppingBasket,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { hasPermission } from '@mudra/shared';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { listMenuItems, listOrders, listTables } from '@/lib/server/operations';
import { OrdersTablesPanel } from '@/components/orders-tables-panel';
import { getTablesComandasViewPreference } from '@/lib/server/user-preferences';
import { getRestaurantComandaNumbers } from '@/lib/server/comanda-number-settings';
import { logOperationalDataLoadFailure } from '@/lib/server/operation-load-log';

const demoMetrics = [
  {
    label: 'Vendas hoje',
    value: formatCurrency(2847.5),
    detail: 'Exemplo ilustrativo',
    icon: DollarSign,
  },
  {
    label: 'Comandas abertas',
    value: '08',
    detail: 'Exemplo ilustrativo',
    icon: ShoppingBasket,
  },
  {
    label: 'Mesas ocupadas',
    value: '12 de 20',
    detail: 'Exemplo ilustrativo',
    icon: LayoutGrid,
  },
  {
    label: 'Tempo médio de preparo',
    value: '18 min',
    detail: 'Exemplo ilustrativo',
    icon: Clock3,
  },
];

const demoOrders = [
  {
    number: '104',
    title: 'Mesa 08 · Comanda CM-008-A',
    detail: '2 itens · há 3 min',
    status: 'Novo',
    kind: 'new',
  },
  {
    number: '107',
    title: 'Mesa 08 · Comanda CM-008-B',
    detail: '4 itens · há 11 min',
    status: 'Preparando',
    kind: 'preparing',
  },
  {
    number: '109',
    title: 'Mesa 03 · Comanda CM-003-A',
    detail: '3 itens · há 16 min',
    status: 'Pronto',
    kind: 'ready',
  },
];

function getTodayLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  let liveData: Awaited<ReturnType<typeof loadOperationalData>> | null = null;
  try {
    liveData = await loadOperationalData();
  } catch (error) {
    logOperationalDataLoadFailure('dashboard', error);
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Operação do restaurante</p>
          <h1>Visão geral</h1>
          <p className="page-description">Acompanhe os principais indicadores da operação.</p>
        </div>
        <p className="date-label">{getTodayLabel()}</p>
      </header>

      <section aria-label="Aviso sobre os dados exibidos" className="notice">
        <Info aria-hidden="true" size={17} />
        <div>
          <strong>Dados operacionais conectados.</strong> Mesas e comandas abertas são consultadas
          no backend. Indicadores e resumo da cozinha abaixo seguem demonstrativos.
        </div>
      </section>

      <OrdersTablesPanel
        initialError={liveData === null}
        initialMenuItems={liveData?.menuItems ?? []}
        initialOrders={liveData?.orders ?? []}
        initialTables={liveData?.tables ?? []}
        initialView={liveData?.viewPreference ?? 'COMANDA'}
        initialComandaNumbers={liveData?.comandaNumbers ?? '{20-110}'}
        canManageMenu={session.user.role === 'ADMIN'}
        canCloseOrders={
          session.user.role ? hasPermission(session.user.role, 'ORDERS_CLOSE') : false
        }
        canReceivePayments={
          session.user.role ? hasPermission(session.user.role, 'PAYMENTS_RECEIVE') : false
        }
        userId={session.user.id}
      />

      <section aria-label="Indicadores ilustrativos" className="metrics-grid">
        {demoMetrics.map(({ detail, icon: Icon, label, value }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon aria-hidden="true" size={16} />
              </span>
            </div>
            <p className="metric-value">{value}</p>
            <p className="metric-detail">{detail}</p>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section aria-labelledby="orders-heading" className="panel">
          <div className="panel-heading">
            <div>
              <h2 id="orders-heading">Pedidos recentes</h2>
              <p>Prévia demonstrativa da fila de cozinha</p>
            </div>
            <Link className="text-link" href="/kitchen">
              Abrir KDS <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
          <ul aria-label="Pedidos de exemplo" className="order-list">
            {demoOrders.map((order) => (
              <li className="order-row" key={order.number}>
                <div className="order-main">
                  <span aria-hidden="true" className="order-number">
                    #{order.number}
                  </span>
                  <span>
                    <span className="order-title">{order.title}</span>
                    <span className="order-subtitle">{order.detail}</span>
                  </span>
                </div>
                <span className={`status-pill ${order.kind}`}>{order.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="kitchen-heading" className="panel">
          <div className="panel-heading">
            <div>
              <h2 id="kitchen-heading">Cozinha</h2>
              <p>Resumo de demonstração</p>
            </div>
            <CookingPot aria-hidden="true" color="#187653" size={19} />
          </div>
          <div aria-label="Resumo ilustrativo da cozinha" className="kitchen-summary">
            <div className="kitchen-total">
              <span className="kitchen-symbol">
                <ShoppingBasket aria-hidden="true" size={16} />
              </span>
              <p>
                Pedidos na fila
                <strong>03 pedidos de exemplo</strong>
              </p>
            </div>
            <div className="kitchen-total">
              <span className="kitchen-symbol">
                <Clock3 aria-hidden="true" size={16} />
              </span>
              <p>
                Próxima ação
                <strong>Visualizar fila no KDS</strong>
              </p>
            </div>
            <Link className="text-link" href="/kitchen">
              Ir para Kitchen Display <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </section>
      </div>

      <p className="footer-note">
        Valores de vendas, preparo e fila da cozinha são demonstrativos. Esta tela não lança itens,
        processa pagamentos ou oferece operação offline.
      </p>
    </>
  );
}

async function loadOperationalData() {
  const context = await getAuthenticatedServerContext();
  const [viewPreference, comandaNumbers] = await Promise.all([
    getTablesComandasViewPreference(context),
    getRestaurantComandaNumbers(context),
  ]);
  let tables: Awaited<ReturnType<typeof listTables>> = [];
  let orders: Awaited<ReturnType<typeof listOrders>> = [];
  let menuItems: Awaited<ReturnType<typeof listMenuItems>> = [];

  if (viewPreference === 'MESA') {
    tables = await listTables(context, { includeOpenOrders: false });
  } else if (viewPreference === 'COMANDA') {
    [orders, menuItems] = await Promise.all([listOrders(context), listMenuItems(context)]);
  } else {
    [tables, orders, menuItems] = await Promise.all([
      listTables(context),
      listOrders(context),
      listMenuItems(context),
    ]);
  }

  return { tables, orders, menuItems, viewPreference, comandaNumbers };
}
