import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, startOfMonth, getDateString } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  Loader2,
  ShoppingBag,
  Award,
  Calendar,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year';

export default function Reports() {
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; rev: number }[]>([]);
  const [topServers, setTopServers] = useState<{ name: string; orders: number; rev: number }[]>([]);
  const [topTables, setTopTables] = useState<{ name: string; orders: number; rev: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; count: number; amount: number }[]>([]);
  const [dailySales, setDailySales] = useState<{ date: string; revenue: number }[]>([]);

  useEffect(() => {
    loadReport();
  }, [period]);

  function getStartDate(): string {
    const now = new Date();
    switch (period) {
      case 'today': return getDateString();
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month': return startOfMonth();
      case 'year': return new Date(now.getFullYear(), 0, 1).toISOString();
    }
  }

  async function loadReport() {
    setLoading(true);
    const startDate = getStartDate();

    const [orders, orderItems, payments] = await Promise.all([
      supabase.from('orders').select('id, total, server_name, table_name, created_at, status').eq('status', 'paid').gte('created_at', startDate),
      supabase.from('order_items').select('product_name, quantity, total_price').gte('created_at', startDate).eq('status', 'served'),
      supabase.from('payments').select('method, amount').gte('created_at', startDate),
    ]);

    const orderData = orders.data ?? [];
    const totalRev = orderData.reduce((s, o) => s + Number(o.total), 0);
    setRevenue(totalRev);
    setOrderCount(orderData.length);
    setAvgTicket(orderData.length > 0 ? totalRev / orderData.length : 0);

    // Top products
    const prodMap = new Map<string, { qty: number; rev: number }>();
    (orderItems.data ?? []).forEach((item) => {
      const ex = prodMap.get(item.product_name) ?? { qty: 0, rev: 0 };
      ex.qty += item.quantity;
      ex.rev += Number(item.total_price);
      prodMap.set(item.product_name, ex);
    });
    setTopProducts(Array.from(prodMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.rev - a.rev).slice(0, 8));

    // Top servers
    const serverMap = new Map<string, { orders: number; rev: number }>();
    orderData.forEach((o) => {
      if (!o.server_name) return;
      const ex = serverMap.get(o.server_name) ?? { orders: 0, rev: 0 };
      ex.orders += 1;
      ex.rev += Number(o.total);
      serverMap.set(o.server_name, ex);
    });
    setTopServers(Array.from(serverMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.rev - a.rev).slice(0, 5));

    // Top tables
    const tableMap = new Map<string, { orders: number; rev: number }>();
    orderData.forEach((o) => {
      const name = o.table_name ?? 'A emporter';
      const ex = tableMap.get(name) ?? { orders: 0, rev: 0 };
      ex.orders += 1;
      ex.rev += Number(o.total);
      tableMap.set(name, ex);
    });
    setTopTables(Array.from(tableMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.rev - a.rev).slice(0, 5));

    // Payment breakdown
    const payMap = new Map<string, { count: number; amount: number }>();
    (payments.data ?? []).forEach((p) => {
      const ex = payMap.get(p.method) ?? { count: 0, amount: 0 };
      ex.count += 1;
      ex.amount += Number(p.amount);
      payMap.set(p.method, ex);
    });
    setPaymentBreakdown(Array.from(payMap.entries()).map(([method, v]) => ({ method, ...v })));

    // Daily sales (last 7 days)
    const dailyMap = new Map<string, number>();
    orderData.forEach((o) => {
      const date = new Date(o.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + Number(o.total));
    });
    const dailyArr = Array.from(dailyMap.entries()).map(([date, rev]) => ({ date, revenue: rev })).slice(-7);
    setDailySales(dailyArr);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const maxDailyRev = Math.max(...dailySales.map((d) => d.revenue), 1);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Rapports & Analyses</h1>
          <p className="text-sm text-secondary-500 mt-1">Performance des ventes et indicateurs cles</p>
        </div>
        <div className="flex gap-2 p-1 bg-secondary-100 rounded-lg">
          {([
            { id: 'today', label: 'Aujourd\'hui' },
            { id: 'week', label: 'Semaine' },
            { id: 'month', label: 'Mois' },
            { id: 'year', label: 'Annee' },
          ] as { id: Period; label: string }[]).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === p.id ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-600" />
            </div>
            <p className="text-sm text-secondary-500">Recette totale</p>
          </div>
          <p className="text-2xl font-bold text-secondary-900">{formatCurrency(revenue)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-sm text-secondary-500">Total commandes</p>
          </div>
          <p className="text-2xl font-bold text-secondary-900">{formatNumber(orderCount)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-secondary-600" />
            </div>
            <p className="text-sm text-secondary-500">Ticket moyen</p>
          </div>
          <p className="text-2xl font-bold text-secondary-900">{formatCurrency(avgTicket)}</p>
        </div>
      </div>

      {/* Daily sales chart */}
      {dailySales.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            Tendance des ventes journalieres
          </h2>
          <div className="flex items-end gap-3 h-48">
            {dailySales.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full relative">
                  <div
                    className="w-full rounded-t-md bg-primary-500 hover:bg-primary-600 transition-all opacity-80 group-hover:opacity-100"
                    style={{ height: `${Math.max((d.revenue / maxDailyRev) * 160, 2)}px` }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {formatCurrency(d.revenue)}
                  </div>
                </div>
                <span className="text-xs text-secondary-400">{d.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-600" />
            Top produits
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-secondary-400 text-center py-8">Aucune donnee pour cette periode</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-600'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">{p.name}</p>
                    <p className="text-xs text-secondary-400">{p.qty} vendus</p>
                  </div>
                  <span className="text-sm font-semibold text-secondary-700">{formatCurrency(p.rev)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top servers */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            Top serveurs
          </h2>
          {topServers.length === 0 ? (
            <p className="text-sm text-secondary-400 text-center py-8">Aucune donnee pour cette periode</p>
          ) : (
            <div className="space-y-3">
              {topServers.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-600'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">{s.name}</p>
                    <p className="text-xs text-secondary-400">{s.orders} commandes</p>
                  </div>
                  <span className="text-sm font-semibold text-secondary-700">{formatCurrency(s.rev)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top tables */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Tables les plus rentables
          </h2>
          {topTables.length === 0 ? (
            <p className="text-sm text-secondary-400 text-center py-8">Aucune donnee pour cette periode</p>
          ) : (
            <div className="space-y-3">
              {topTables.map((t, i) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-600'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">{t.name}</p>
                    <p className="text-xs text-secondary-400">{t.orders} commandes</p>
                  </div>
                  <span className="text-sm font-semibold text-secondary-700">{formatCurrency(t.rev)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Methodes de paiement
          </h2>
          {paymentBreakdown.length === 0 ? (
            <p className="text-sm text-secondary-400 text-center py-8">Aucune donnee pour cette periode</p>
          ) : (
            <div className="space-y-3">
              {paymentBreakdown.map((p) => {
                const total = paymentBreakdown.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? (p.amount / total) * 100 : 0;
                return (
                  <div key={p.method}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-secondary-900 capitalize">{p.method.replace('_', ' ')}</span>
                      <span className="text-sm font-semibold text-secondary-700">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-secondary-100 overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-secondary-400 w-12 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
