import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDateTime, startOfMonth, getDateString } from '@/lib/utils';
import type { CashSession, Expense } from '@/lib/supabase';
import {
  Wallet,
  Plus,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Lock,
  Unlock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

type Tab = 'overview' | 'expenses' | 'cash';

export default function Finance() {
  const { profile, user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthCogs, setMonthCogs] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const monthStart = startOfMonth();
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = getDateString();

    const [expRes, cashRes, ordersMonth, ordersToday, ordersWeek, expMonth, financialRes] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(50),
      supabase.from('cash_sessions').select('*').order('opened_at', { ascending: false }).limit(20),
      supabase.from('orders').select('total').eq('status', 'paid').gte('created_at', monthStart),
      supabase.from('orders').select('total').eq('status', 'paid').gte('created_at', todayStart),
      supabase.from('orders').select('total').eq('status', 'paid').gte('created_at', weekStart),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart.split('T')[0]),
      supabase.rpc('get_financial_summary', { p_start: monthStart, p_end: new Date().toISOString() }),
    ]);

    setExpenses(expRes.data ?? []);
    setCashSessions(cashRes.data ?? []);
    setMonthRevenue(ordersMonth.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0);
    setTodayRevenue(ordersToday.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0);
    setWeekRevenue(ordersWeek.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0);
    setMonthExpenses(expMonth.data?.reduce((s, e) => s + Number(e.amount), 0) ?? 0);
    setMonthCogs(Number(financialRes.data?.cogs ?? 0));

    if (user) {
      const { data: mySession } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();
      setActiveSession(mySession as CashSession | null);
    }

    setLoading(false);
  }

  async function closeCashSession() {
    if (!activeSession) return;
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, method')
      .gte('created_at', activeSession.opened_at);

    const cashTotal = payments?.filter(p => p.method === 'cash').reduce((s, p) => s + Number(p.amount), 0) ?? 0;
    const closingBalance = Number(activeSession.opening_balance) + cashTotal;

    await supabase.from('cash_sessions').update({
      status: 'closed',
      closing_balance: closingBalance,
      closed_at: new Date().toISOString(),
    }).eq('id', activeSession.id);
    setActiveSession(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const monthGrossProfit = monthRevenue - monthCogs;
  const monthProfit = monthGrossProfit - monthExpenses;
  const foodCostPercent = monthRevenue > 0 ? (monthCogs / monthRevenue) * 100 : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Finance & Comptabilite</h1>
        <p className="text-sm text-secondary-500 mt-1">Suivez les recettes, depenses et flux de tresorerie</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary-100 rounded-lg w-fit">
        {([
          { id: 'overview', label: 'Apercu' },
          { id: 'expenses', label: 'Depenses' },
          { id: 'cash', label: 'Sessions de caisse' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              tab === t.id ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* P&L Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-accent-600" />
                </div>
                <p className="text-sm text-secondary-500">Recette du jour</p>
              </div>
              <p className="text-2xl font-bold text-secondary-900">{formatCurrency(todayRevenue)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
                <p className="text-sm text-secondary-500">Cette semaine</p>
              </div>
              <p className="text-2xl font-bold text-secondary-900">{formatCurrency(weekRevenue)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-error-50 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-error-600" />
                </div>
                <p className="text-sm text-secondary-500">Depenses du mois</p>
              </div>
              <p className="text-2xl font-bold text-secondary-900">{formatCurrency(monthExpenses)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-secondary-600" />
                </div>
                <p className="text-sm text-secondary-500">Food cost (mois)</p>
              </div>
              <p className="text-2xl font-bold text-secondary-900">{formatCurrency(monthCogs)}</p>
              <p className="text-xs text-secondary-500 mt-1">{foodCostPercent.toFixed(1)}% du chiffre d’affaires</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary-700" />
                </div>
                <p className="text-sm text-primary-600">Benefice net (mois)</p>
              </div>
              <p className="text-2xl font-bold text-primary-900">{formatCurrency(monthProfit)}</p>
            </div>
          </div>

          {/* Income statement */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Compte de resultat simplifie</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-secondary-100">
                <span className="text-sm font-medium text-secondary-700">Recettes (mois)</span>
                <span className="text-lg font-bold text-accent-700">{formatCurrency(monthRevenue)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-secondary-100">
                <span className="text-sm font-medium text-secondary-700">Cout des marchandises vendues (food cost)</span>
                <span className="text-lg font-bold text-secondary-900">-{formatCurrency(monthCogs)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-secondary-100">
                <span className="text-sm font-medium text-secondary-700">Marge brute</span>
                <span className="text-lg font-bold text-accent-700">{formatCurrency(monthGrossProfit)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-secondary-100">
                <span className="text-sm font-medium text-secondary-700">Depenses d'exploitation</span>
                <span className="text-lg font-bold text-error-600">-{formatCurrency(monthExpenses)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-bold text-secondary-900">Benefice net</span>
                <span className={`text-xl font-bold ${monthProfit >= 0 ? 'text-accent-700' : 'text-error-600'}`}>
                  {formatCurrency(monthProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Recent expenses */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary-900">Depenses recentes</h2>
              <button onClick={() => setShowExpenseModal(true)} className="btn-secondary">
                <Plus className="w-4 h-4" />
                Ajouter une depense
              </button>
            </div>
            {expenses.length === 0 ? (
              <p className="text-sm text-secondary-400 text-center py-8">Aucune depense enregistree</p>
            ) : (
              <div className="space-y-2">
                {expenses.slice(0, 8).map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-error-50 flex items-center justify-center">
                        <ArrowDownRight className="w-4 h-4 text-error-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-secondary-900">{exp.category}</p>
                        {exp.description && <p className="text-xs text-secondary-400">{exp.description}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-secondary-900">{formatCurrency(exp.amount)}</p>
                      <p className="text-xs text-secondary-400">{exp.expense_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowExpenseModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Ajouter une depense
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Categorie</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Montant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="badge bg-secondary-100 text-secondary-600">{exp.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-700">{exp.description ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-secondary-900">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-sm text-secondary-500">{exp.expense_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-secondary-400">
                <Receipt className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Aucune depense enregistree</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'cash' && (
        <div className="space-y-4">
          {activeSession && (
            <div className="card p-5 bg-accent-50 border-accent-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                    <Unlock className="w-5 h-5 text-accent-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-accent-800">Caisse ouverte</p>
                    <p className="text-xs text-accent-600">Ouverte par {activeSession.user_name} le {formatDateTime(activeSession.opened_at)}</p>
                  </div>
                </div>
                <button onClick={closeCashSession} className="btn-danger">
                  <Lock className="w-4 h-4" />
                  Fermer la session
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Ouverture</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Fermeture</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Ouv.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Cloture</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {cashSessions.map((cs) => (
                  <tr key={cs.id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-secondary-900">{cs.user_name}</td>
                    <td className="px-4 py-3 text-sm text-secondary-500">{formatDateTime(cs.opened_at)}</td>
                    <td className="px-4 py-3 text-sm text-secondary-500">{cs.closed_at ? formatDateTime(cs.closed_at) : '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-secondary-700">{formatCurrency(cs.opening_balance)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-secondary-900">{cs.closing_balance ? formatCurrency(cs.closing_balance) : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${cs.status === 'open' ? 'bg-accent-100 text-accent-700' : 'bg-secondary-100 text-secondary-600'}`}>
                        {cs.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cashSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-secondary-400">
                <Wallet className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Aucune session de caisse enregistree</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showExpenseModal && (
        <ExpenseModal
          userId={user?.id ?? ''}
          onClose={() => setShowExpenseModal(false)}
          onSaved={() => { setShowExpenseModal(false); loadData(); }}
        />
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = ['Loyer', 'Factures (eau, elec)', 'Salaires', 'Fournitures', 'Marketing', 'Maintenance', 'Assurance', 'Taxes', 'Autre'];

function ExpenseModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ category: 'Loyer', description: '', amount: 0, expense_date: getDateString() });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase.from('expenses').insert({
      category: form.category,
      description: form.description || null,
      amount: form.amount,
      expense_date: form.expense_date,
      created_by: userId || null,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
      <div className="card p-6 max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">Ajouter une depense</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Categorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Loyer mensuel, facture d'electricite..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Montant</label>
              <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || form.amount <= 0} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter la depense
          </button>
        </div>
      </div>
    </div>
  );
}
