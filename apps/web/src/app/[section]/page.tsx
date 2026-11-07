import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { hasPermission } from '@mudra/shared';
import { auth } from '@/auth';
import { OrdersTablesPanel } from '@/components/orders-tables-panel';
import { MenuCatalogManager } from '@/components/menu-catalog-manager';
import { KitchenDemo } from '@/components/kitchen-demo';
import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { sectionDetails, type AppSection } from '@/lib/navigation';
import { listBuffetItems, listMenuItems, listOrders, listTables } from '@/lib/server/operations';
import { getTablesComandasViewPreference } from '@/lib/server/user-preferences';
import { getRestaurantComandaNumbers } from '@/lib/server/comanda-number-settings';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';
import { logOperationalDataLoadFailure } from '@/lib/server/operation-load-log';

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const availableSections = Object.keys(sectionDetails) as AppSection[];

export function generateStaticParams() {
  return availableSections.map((section) => ({ section }));
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  if (!availableSections.includes(section as AppSection)) {
    return { title: 'Página não encontrada' };
  }
  return { title: sectionDetails[section as AppSection].title };
}

export default async function PlaceholderPage({ params }: SectionPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { section } = await params;
  if (!availableSections.includes(section as AppSection)) notFound();

  const { description, icon: Icon, title } = sectionDetails[section as AppSection];
  const isKitchen = section === 'kitchen';
  const isTables = section === 'tables';
  const isMenu = section === 'menu';
  let tablesComandasView: TablesComandasView = 'COMANDA';
  let comandaNumbers = '{20-110}';
  let menuItems: Awaited<ReturnType<typeof listMenuItems>> = [];
  let buffetItems: Awaited<ReturnType<typeof listBuffetItems>> = [];
  let canManageMenu = false;

  let liveData: {
    tables: Awaited<ReturnType<typeof listTables>>;
    orders: Awaited<ReturnType<typeof listOrders>>;
    menuItems: Awaited<ReturnType<typeof listMenuItems>>;
  } | null = null;
  if (isTables) {
    try {
      const context = await getAuthenticatedServerContext();
      const [viewPreference, configuredComandaNumbers] = await Promise.all([
        getTablesComandasViewPreference(context),
        getRestaurantComandaNumbers(context),
      ]);
      comandaNumbers = configuredComandaNumbers;
      let tables: Awaited<ReturnType<typeof listTables>> = [];
      let orders: Awaited<ReturnType<typeof listOrders>> = [];
      let menuItems: Awaited<ReturnType<typeof listMenuItems>> = [];

      if (viewPreference === 'MESA') {
        tables = await listTables(context, { includeOpenOrders: false });
      } else {
        [tables, orders, menuItems] = await Promise.all([
          listTables(context),
          listOrders(context),
          listMenuItems(context),
        ]);
      }
      liveData = { tables, orders, menuItems };
      tablesComandasView = viewPreference;
    } catch (error) {
      logOperationalDataLoadFailure('tables-module', error);
    }
  }
  if (isMenu) {
    try {
      const context = await getAuthenticatedServerContext();
      canManageMenu = context.role === 'ADMIN';
      if (canManageMenu) {
        [menuItems, buffetItems] = await Promise.all([
          listMenuItems(context),
          listBuffetItems(context),
        ]);
      }
    } catch (error) {
      logOperationalDataLoadFailure('menu-catalog', error);
    }
  }

  return (
    <>
      {!isTables && !isMenu ? (
        <header className="page-heading">
          <div>
            {isKitchen ? <p className="eyebrow">Operação</p> : null}
            <h1>{title}</h1>
            {description ? <p className="page-description">{description}</p> : null}
          </div>
        </header>
      ) : null}

      {isTables ? (
        <OrdersTablesPanel
          initialError={liveData === null}
          initialMenuItems={liveData?.menuItems ?? []}
          initialOrders={liveData?.orders ?? []}
          initialTables={liveData?.tables ?? []}
          initialView={tablesComandasView}
          initialComandaNumbers={comandaNumbers}
          canManageMenu={session.user.role === 'ADMIN'}
          canCloseOrders={
            session.user.role ? hasPermission(session.user.role, 'ORDERS_CLOSE') : false
          }
          canReceivePayments={
            session.user.role ? hasPermission(session.user.role, 'PAYMENTS_RECEIVE') : false
          }
          userId={session.user.id}
        />
      ) : isKitchen ? (
        <KitchenDemo />
      ) : isMenu && canManageMenu ? (
        <MenuCatalogManager initialItems={menuItems} initialBuffetItems={buffetItems} />
      ) : isMenu ? (
        <section aria-labelledby="menu-access-heading" className="placeholder-card">
          <h1 id="menu-access-heading">Cardápio</h1>
          <p>Somente um administrador pode cadastrar produtos.</p>
        </section>
      ) : (
        <section aria-labelledby="placeholder-heading" className="placeholder-card">
          <span aria-hidden="true" className="placeholder-icon">
            <Icon size={21} />
          </span>
          <h2 id="placeholder-heading">Esta tela ainda não foi implementada</h2>
          <p>
            O módulo de {title.toLocaleLowerCase('pt-BR')} está previsto no produto, mas suas telas
            e operações ainda serão desenvolvidas.
          </p>
          <div className="placeholder-note">
            <strong>Sem dados ou ações nesta etapa.</strong> Esta página é apenas um destino de
            navegação. Nenhum cadastro ou alteração será carregado ou salvo.
          </div>
        </section>
      )}

      {!isTables && !isMenu ? (
        <p className="footer-note">
          {isKitchen
            ? 'Prévia visual estática: nenhum pedido real é carregado e os status não podem ser alterados. Fila conectada, atualização em tempo real e ações de preparo ainda não foram implementadas.'
            : 'Este módulo segue demonstrativo e sem operações reais. O acesso ao painel já exige sessão autenticada.'}
        </p>
      ) : null}
    </>
  );
}
