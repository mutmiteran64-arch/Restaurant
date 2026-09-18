import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/lib/supabase';
import {
  LayoutDashboard,
  ShoppingCart,
  LayoutGrid,
  UtensilsCrossed,
  Package,
  Users,
  Wallet,
  BarChart3,
  Settings,
  ScrollText,
  LogOut,
  ChefHat,
  Menu as MenuIcon,
  X,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'pos'
  | 'tables'
  | 'menu'
  | 'stock'
  | 'staff'
  | 'finance'
  | 'reports'
  | 'settings'
  | 'audit';

type NavItem = {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['owner', 'manager', 'accountant'] },
  { id: 'pos', label: 'Caisse / Commandes', icon: ShoppingCart, roles: ['owner', 'manager', 'cashier', 'server'] },
  { id: 'tables', label: 'Plan de salle', icon: LayoutGrid, roles: ['owner', 'manager', 'cashier', 'server'] },
  { id: 'menu', label: 'Menu & Recettes', icon: UtensilsCrossed, roles: ['owner', 'manager', 'chef'] },
  { id: 'stock', label: 'Stock', icon: Package, roles: ['owner', 'manager', 'storekeeper', 'chef'] },
  { id: 'staff', label: 'Personnel', icon: Users, roles: ['owner', 'manager'] },
  { id: 'finance', label: 'Finance', icon: Wallet, roles: ['owner', 'accountant', 'manager'] },
  { id: 'reports', label: 'Rapports', icon: BarChart3, roles: ['owner', 'manager', 'accountant'] },
  { id: 'settings', label: 'Parametres', icon: Settings, roles: ['owner'] },
  { id: 'audit', label: "Journal d'audit", icon: ScrollText, roles: ['owner', 'manager'] },
];

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietaire',
  manager: 'Manager',
  cashier: 'Caissier',
  server: 'Serveur',
  chef: 'Chef',
  storekeeper: 'Magasinier',
  accountant: 'Comptable',
};

export default function AppLayout({
  currentPage,
  onNavigate,
  children,
}: {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile?.role ?? 'server';
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  function handleNav(page: PageId) {
    onNavigate(page);
    setMobileOpen(false);
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-secondary-100">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600">
          <ChefHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-secondary-900 font-display leading-tight">RestoFlow</h1>
          <p className="text-xs text-secondary-400">Gestion de restaurant</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-secondary-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-secondary-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-secondary-200 flex items-center justify-center text-sm font-semibold text-secondary-600">
            {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900 truncate">{profile?.full_name}</p>
            <p className="text-xs text-secondary-400">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-secondary-400 hover:bg-secondary-100 hover:text-error-600 transition-colors"
            title="Deconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-secondary-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-white border-r border-secondary-100">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-secondary-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white shadow-xl animate-slide-in-right">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-secondary-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-secondary-900 font-display">RestoFlow</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-100"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
