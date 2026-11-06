import {
  Archive,
  ClipboardList,
  CookingPot,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  UsersRound,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export type AppSection =
  'kitchen' | 'menu' | 'tables' | 'inventory' | 'reservations' | 'cash' | 'staff' | 'reports';

export type NavigationLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: AppSection;
};

export const primaryNavigation: NavigationLink[] = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/kitchen', label: 'Cozinha (KDS)', icon: CookingPot, section: 'kitchen' },
];

export const managementNavigation: NavigationLink[] = [
  { href: '/menu', label: 'Cardápio', icon: Utensils, section: 'menu' },
  { href: '/tables', label: 'Gestão de Mesas/Comandas', icon: ClipboardList, section: 'tables' },
  { href: '/inventory', label: 'Estoque', icon: Archive, section: 'inventory' },
  { href: '/reservations', label: 'Reservas', icon: ReceiptText, section: 'reservations' },
  { href: '/cash', label: 'Caixa', icon: Settings2, section: 'cash' },
  { href: '/staff', label: 'Equipe', icon: UsersRound, section: 'staff' },
  { href: '/reports', label: 'Relatórios', icon: ClipboardList, section: 'reports' },
];

export const sectionDetails: Record<
  AppSection,
  { title: string; description: string; icon: LucideIcon }
> = {
  kitchen: {
    title: 'Kitchen Display',
    description: 'Fila de pedidos e acompanhamento do preparo.',
    icon: CookingPot,
  },
  menu: {
    title: 'Cardápio',
    description: 'Categorias, itens, disponibilidade e composição.',
    icon: Utensils,
  },
  tables: {
    title: 'Gestão de Mesas/Comandas',
    description: '',
    icon: ClipboardList,
  },
  inventory: {
    title: 'Estoque',
    description: 'Inventário, movimentações e fornecedores.',
    icon: Archive,
  },
  reservations: {
    title: 'Reservas',
    description: 'Agenda, lista de espera e atendimento de clientes.',
    icon: ReceiptText,
  },
  cash: {
    title: 'Caixa',
    description: 'Abertura, fechamento e conferência de caixa.',
    icon: Settings2,
  },
  staff: {
    title: 'Equipe',
    description: 'Funcionários, perfis e escalas.',
    icon: UsersRound,
  },
  reports: {
    title: 'Relatórios',
    description: 'Indicadores operacionais e de vendas.',
    icon: ClipboardList,
  },
};
