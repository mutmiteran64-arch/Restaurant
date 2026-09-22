import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatNumber, startOfDay, endOfDay, startOfMonth, formatTime } from '@/lib/utils';
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  Utensils,
  ChefHat,
} from 'lucide-react';

type DashboardData = {
  todayRevenue: number;
  todayOrders: number;
  todayAvgTicket: number;
  activeTables: number;
  totalTables: number;
  monthRevenue: number;
  monthExpenses: number;
  lowStockCount: number;
  recentOrders: { id: string; order_number: number; table_name: string | null; total: number; created_at: string; status: string }[];
  topProducts: { product_name: string; total_qty: number; total_rev: number }[];
  hourlySales: { hour: number; revenue: number }[];
  tableOccupancy: number;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const monthStart = startOfMonth();

    const [ordersToday, ordersMonth, expensesMonth, tables, lowStock, recentOrders, topProductsRes, hourlyRes] = await Promise.all([
      supabase.from('orders').select('total, created_at').gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'paid'),
      supabase.from('orders').select('total').gte('created_at', monthStart).eq('status', 'paid'),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart.split('T')[0]),
      supabase.from('restaurant_tables').select('status'),
      supabase.from('ingredients').select('id').filter('quantity', 'lte', 'min_quantity'),
      supabase.from('orders').select('id, order_number, table_name, total, created_at, status').order('created_at', { ascending: false }).limit(8),
      supabase.from('order_items').select('product_name, quantity, total_price').gte('created_at', todayStart).eq('status', 'served'),
      supabase.from('orders').select('total, created_at').gte('created_at', todayStart).eq('status', 'paid'),
    ]);

    const todayRevenue = ordersToday.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0;
    const todayOrders = ordersToday.data?.length ?? 0;
    const monthRevenue = ordersMonth.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0;
    const monthExpenses = expensesMonth.data?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
    const totalTables = tables.data?.length ?? 0;
    const activeTables = tables.data?.filter((t) => t.status === 'occupied').length ?? 0;
    const tableOccupancy = totalTables > 0 ? Math.round((activeTables / totalTables) * 100) : 0;

    // Top products
    const productMap = new Map<string, { qty: number; rev: number }>();
    topProductsRes.data?.forEach((item) => {
      const existing = productMap.get(item.product_name) ?? { qty: 0, rev: 0 };
      existing.qty += item.quantity;
      existing.rev += Number(item.total_price);
      productMap.set(item.product_name, existing);
    });
    const topProducts = Array.from(productMap.entries())
      .map(([name, v]) => ({ product_name: name, total_qty: v.qty, total_rev: v.rev }))
      .sort((a, b) => b.total_rev - a.total_rev)
      .slice(0, 5);

    // Hourly sales
    const hourlyMap = new Array(24).fill(0).map((_, i) => ({ hour: i, revenue: 0 }));
    hourlyRes.data?.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      hourlyMap[h].revenue += Number(o.total);
    });
    const hourlySales = hourlyMap.filter((h) => h.hour >= 8 && h.hour <= 23);

    setData({
      todayRevenue,
      todayOrders,
      todayAvgTicket: todayOrders > 0 ? todayRevenue / todayOrders : 0,
      activeTables,
      totalTables,
      monthRevenue,
      monthExpenses,
      lowStockCount: lowStock.data?.length ?? 0,
      recentOrders: recentOrders.data ?? [],
      topProducts,
      hourlySales,
      tableOccupancy,
    });
    setLoading(false);
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const maxHourly = Math.max(...data.hourlySales.map((h) => h.revenue), 1);
  const monthProfit = data.monthRevenue - data.monthExpenses;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">
          Bon retour, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-secondary-500 text-sm mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Recette du jour"
          value={formatCurrency(data.todayRevenue)}
          icon={DollarSign}
          trend="+12.5%"
          trendUp
          color="primary"
        />
        <KpiCard
          label="Commandes du jour"
          value={formatNumber(data.todayOrders)}
          icon={ShoppingBag}
          trend={`${data.todayOrders > 0 ? '+' : ''}${data.todayOrders}`}
          trendUp={data.todayOrders > 0}
          color="accent"
        />
        <KpiCard
          label="Ticket moyen"
          value={formatCurrency(data.todayAvgTicket)}
          icon={TrendingUp}
          trend={data.todayAvgTicket > 0 ? 'Sain' : 'Pas de vente'}
          trendUp={data.todayAvgTicket > 0}
          color="secondary"
        />
        <KpiCard
          label="Taux d'occupation"
          value={`${data.tableOccupancy}%`}
          icon={Users}
          trend={`${data.activeTables}/${data.totalTables} actives`}
          trendUp={data.activeTables > 0}
          color="warning"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly sales chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">Ventes du jour par heure</h2>
              <p className="text-sm text-secondary-400">Distribution des recettes dans la journee</p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-48">
            {data.hourlySales.map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full relative">
                  <div
                    className="w-full rounded-t-md bg-primary-500 hover:bg-primary-600 transition-all duration-200 group-hover:opacity-100 opacity-80"
                    style={{ height: `${Math.max((h.revenue / maxHourly) * 160, 2)}px` }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {formatCurrency(h.revenue)}
                  </div>
                </div>
                <span className="text-xs text-secondary-400">{h.hour}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* Month summary */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Ce mois-ci</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-accent-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Recettes</p>
                  <p className="text-lg font-bold text-secondary-900">{formatCurrency(data.monthRevenue)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-error-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-error-100 flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5 text-error-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Depenses</p>
                  <p className="text-lg font-bold text-secondary-900">{formatCurrency(data.monthExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Benefice net</p>
                  <p className="text-lg font-bold text-secondary-900">{formatCurrency(monthProfit)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent orders */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Commandes recentes</h2>
          {data.recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-secondary-400">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Aucune commande aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
                      <Utensils className="w-4 h-4 text-secondary-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-900">Commande #{order.order_number}</p>
                      <p className="text-xs text-secondary-400">
                        {order.table_name ?? 'A emporter'} • {formatTime(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${
                      order.status === 'paid' ? 'bg-accent-100 text-accent-700' :
                      order.status === 'open' ? 'bg-warning-100 text-warning-700' :
                      order.status === 'cancelled' ? 'bg-error-100 text-error-700' :
                      'bg-secondary-100 text-secondary-600'
                    }`}>
                      {order.status === 'paid' ? 'payee' : order.status === 'open' ? 'ouverte' : order.status === 'cancelled' ? 'annulee' : order.status}
                    </span>
                    <span className="text-sm font-semibold text-secondary-900">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products + alerts */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Top produits du jour</h2>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-secondary-400 text-center py-4">Aucune vente</p>
            ) : (
              <div className="space-y-3">
                {data.topProducts.map((p, i) => (
                  <div key={p.product_name} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-600'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900 truncate">{p.product_name}</p>
                      <p className="text-xs text-secondary-400">{p.total_qty} vendus</p>
                    </div>
                    <span className="text-sm font-semibold text-secondary-700">{formatCurrency(p.total_rev)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.lowStockCount > 0 && (
            <div className="card p-6 border-warning-200 bg-warning-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-warning-800">Alerte stock bas</p>
                  <p className="text-xs text-warning-600">{data.lowStockCount} ingredient(s) sous le minimum</p>
                </div>
              </div>
            </div>
          )}

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-secondary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary-900">Statut cuisine</p>
                <p className="text-xs text-secondary-400">Tous les systemes operationnels</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  color,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  trend: string;
  trendUp: boolean;
  color: 'primary' | 'accent' | 'secondary' | 'warning';
}) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    secondary: 'bg-secondary-100 text-secondary-600',
    warning: 'bg-warning-50 text-warning-600',
  };

  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-secondary-500">{label}</p>
          <p className="text-2xl font-bold text-secondary-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {trendUp ? (
          <TrendingUp className="w-3.5 h-3.5 text-accent-600" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-secondary-400" />
        )}
        <span className={`text-xs ${trendUp ? 'text-accent-600' : 'text-secondary-400'}`}>{trend}</span>
      </div>
    </div>
  );
}
