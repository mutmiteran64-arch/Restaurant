import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/utils';
import type { Ingredient, StockMovement, Supplier, PurchaseOrder } from '@/lib/supabase';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Loader2,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
} from 'lucide-react';

type Tab = 'ingredients' | 'movements' | 'suppliers' | 'purchases';

export default function Stock() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showIngredientModal, setShowIngredientModal] = useState<Ingredient | null | 'new'>(null);
  const [showSupplierModal, setShowSupplierModal] = useState<Supplier | null | 'new'>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [ings, movs, sups, pos] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setIngredients(ings.data ?? []);
    setMovements(movs.data ?? []);
    setSuppliers(sups.data ?? []);
    setPurchases(pos.data ?? []);
    setLoading(false);
  }

  const filteredIngredients = ingredients.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = ingredients.filter((i) => i.quantity <= i.min_quantity);
  const totalStockValue = ingredients.reduce((s, i) => s + i.quantity * i.cost_per_unit, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Gestion des stocks</h1>
          <p className="text-sm text-secondary-500 mt-1">Suivez les ingredients, mouvements et fournisseurs</p>
        </div>
        {tab === 'ingredients' && (
          <button onClick={() => setShowIngredientModal('new')} className="btn-primary">
            <Plus className="w-4 h-4" />
            Ajouter un ingredient
          </button>
        )}
        {tab === 'suppliers' && (
          <button onClick={() => setShowSupplierModal('new')} className="btn-primary">
            <Plus className="w-4 h-4" />
            Ajouter un fournisseur
          </button>
        )}
        {tab === 'movements' && (
          <button onClick={() => setShowMovementModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Enregistrer un mouvement
          </button>
        )}
        {tab === 'purchases' && (
          <button onClick={() => setShowPurchaseModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouvelle commande d'achat
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Valeur totale du stock</p>
              <p className="text-xl font-bold text-secondary-900">{formatCurrency(totalStockValue)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Total ingredients</p>
              <p className="text-xl font-bold text-secondary-900">{ingredients.length}</p>
            </div>
          </div>
        </div>
        <div className={`card p-5 ${lowStock.length > 0 ? 'border-warning-200 bg-warning-50' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lowStock.length > 0 ? 'bg-warning-100' : 'bg-secondary-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${lowStock.length > 0 ? 'text-warning-600' : 'text-secondary-400'}`} />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Alertes stock bas</p>
              <p className={`text-xl font-bold ${lowStock.length > 0 ? 'text-warning-700' : 'text-secondary-900'}`}>{lowStock.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary-100 rounded-lg w-fit overflow-x-auto">
        {([
          { id: 'ingredients', label: 'Ingredients' },
          { id: 'movements', label: 'Mouvements' },
          { id: 'suppliers', label: 'Fournisseurs' },
          { id: 'purchases', label: 'Commandes d\'achat' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Ingredients tab */}
      {tab === 'ingredients' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
              placeholder="Rechercher un ingredient..."
            />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Ingredient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Unite</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Quantite</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Min</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Cout/Unite</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Valeur</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filteredIngredients.map((ing) => {
                  const isLow = ing.quantity <= ing.min_quantity;
                  return (
                    <tr key={ing.id} className="hover:bg-secondary-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-secondary-900">{ing.name}</td>
                      <td className="px-4 py-3 text-sm text-secondary-500">{ing.unit}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-secondary-900">{formatNumber(ing.quantity, 3)}</td>
                      <td className="px-4 py-3 text-right text-sm text-secondary-500">{formatNumber(ing.min_quantity, 3)}</td>
                      <td className="px-4 py-3 text-right text-sm text-secondary-500">{formatCurrency(ing.cost_per_unit)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-secondary-700">{formatCurrency(ing.quantity * ing.cost_per_unit)}</td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="badge bg-warning-100 text-warning-700">
                            <AlertTriangle className="w-3 h-3" />
                            Bas
                          </span>
                        ) : (
                          <span className="badge bg-accent-100 text-accent-700">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowIngredientModal(ing)}
                            className="p-1.5 rounded-md text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => supabase.from('ingredients').delete().eq('id', ing.id).then(() => loadData())}
                            className="p-1.5 rounded-md text-secondary-400 hover:bg-error-50 hover:text-error-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Movements tab */}
      {tab === 'movements' && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary-50 border-b border-secondary-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Ingredient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Cause</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Quantite</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Utilisateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-secondary-500">{formatDateTime(m.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-secondary-900">{m.ingredient_name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      m.type === 'in' ? 'bg-accent-100 text-accent-700' :
                      m.type === 'out' ? 'bg-error-100 text-error-700' :
                      'bg-secondary-100 text-secondary-600'
                    }`}>
                      {m.type === 'in' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary-500">{m.cause}</td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${m.quantity < 0 ? 'text-error-600' : 'text-accent-600'}`}>
                    {m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity, 3)}
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary-500">{m.reference ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-secondary-500">{m.user_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-secondary-400">
              <TrendingDown className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Aucun mouvement de stock enregistre</p>
            </div>
          )}
        </div>
      )}

      {/* Suppliers tab */}
      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-secondary-900">{sup.name}</p>
                    {sup.contact_person && <p className="text-xs text-secondary-400">{sup.contact_person}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowSupplierModal(sup)}
                    className="p-1.5 rounded-md text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => supabase.from('suppliers').delete().eq('id', sup.id).then(() => loadData())}
                    className="p-1.5 rounded-md text-secondary-400 hover:bg-error-50 hover:text-error-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm text-secondary-600">
                {sup.phone && <p>{sup.phone}</p>}
                {sup.email && <p>{sup.email}</p>}
                {sup.address && <p className="text-xs text-secondary-400">{sup.address}</p>}
              </div>
            </div>
          ))}
          {suppliers.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-secondary-400">
              <Truck className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Aucun fournisseur ajoute</p>
            </div>
          )}
        </div>
      )}

      {/* Purchases tab */}
      {tab === 'purchases' && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary-50 border-b border-secondary-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">PO #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Fournisseur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {purchases.map((po) => (
                <tr key={po.id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-secondary-900">#{po.po_number}</td>
                  <td className="px-4 py-3 text-sm text-secondary-700">{po.supplier_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      po.status === 'received' ? 'bg-accent-100 text-accent-700' :
                      po.status === 'ordered' ? 'bg-primary-100 text-primary-700' :
                      po.status === 'cancelled' ? 'bg-error-100 text-error-700' :
                      'bg-secondary-100 text-secondary-600'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-secondary-900">{formatCurrency(po.total)}</td>
                  <td className="px-4 py-3 text-sm text-secondary-500">{formatDateTime(po.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {purchases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-secondary-400">
              <Truck className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Aucune commande d'achat</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showIngredientModal && (
        <IngredientModal
          ingredient={showIngredientModal === 'new' ? null : showIngredientModal}
          suppliers={suppliers}
          onClose={() => setShowIngredientModal(null)}
          onSaved={() => { setShowIngredientModal(null); loadData(); }}
        />
      )}
      {showSupplierModal && (
        <SupplierModal
          supplier={showSupplierModal === 'new' ? null : showSupplierModal}
          onClose={() => setShowSupplierModal(null)}
          onSaved={() => { setShowSupplierModal(null); loadData(); }}
        />
      )}
      {showMovementModal && (
        <MovementModal
          ingredients={ingredients}
          userName={profile?.full_name ?? ''}
          onClose={() => setShowMovementModal(false)}
          onSaved={() => { setShowMovementModal(false); loadData(); }}
        />
      )}
      {showPurchaseModal && (
        <PurchaseModal
          suppliers={suppliers}
          ingredients={ingredients}
          userId={profile?.id ?? ''}
          userName={profile?.full_name ?? ''}
          onClose={() => setShowPurchaseModal(false)}
          onSaved={() => { setShowPurchaseModal(false); loadData(); }}
        />
      )}
    </div>
  );
}

function IngredientModal({
  ingredient,
  suppliers,
  onClose,
  onSaved,
}: {
  ingredient: Ingredient | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: ingredient?.name ?? '',
    unit: ingredient?.unit ?? 'unit',
    quantity: ingredient?.quantity ?? 0,
    min_quantity: ingredient?.min_quantity ?? 0,
    cost_per_unit: ingredient?.cost_per_unit ?? 0,
    supplier_id: ingredient?.supplier_id ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const data = {
      name: form.name,
      unit: form.unit,
      quantity: form.quantity,
      min_quantity: form.min_quantity,
      cost_per_unit: form.cost_per_unit,
      supplier_id: form.supplier_id || null,
    };
    if (ingredient) {
      await supabase.from('ingredients').update(data).eq('id', ingredient.id);
    } else {
      await supabase.from('ingredients').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
      <div className="card p-6 max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">{ingredient ? 'Modifier l\'ingredient' : 'Nouvel ingredient'}</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Flour, Tomatoes..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unite</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" placeholder="kg, L, unite..." />
            </div>
            <div>
              <label className="label">Cout/Unite</label>
              <input type="number" step="0.01" value={form.cost_per_unit || ''} onChange={(e) => setForm({ ...form, cost_per_unit: Number(e.target.value) })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantite actuelle</label>
              <input type="number" step="0.001" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Quantite min (alerte)</label>
              <input type="number" step="0.001" value={form.min_quantity || ''} onChange={(e) => setForm({ ...form, min_quantity: Number(e.target.value) })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input">
              <option value="">Aucun fournisseur</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {ingredient ? 'Enregistrer' : 'Creer l\'ingredient'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contact_person: supplier?.contact_person ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = {
        name: form.name.trim(),
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      if (supplier) {
        const { error } = await supabase.from('suppliers').update(data).eq('id', supplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').insert(data);
        if (error) throw error;
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
      <div className="card p-6 max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">{supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="label">Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Personne a contacter</label><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="input" /></div>
            <div><label className="label">Telephone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
          </div>
          <div><label className="label">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
          <div><label className="label">Adresse</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></div>
          {error && (
            <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {supplier ? 'Enregistrer' : 'Ajouter le fournisseur'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementModal({
  ingredients,
  userName,
  onClose,
  onSaved,
}: {
  ingredients: Ingredient[];
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ingredient_id: '', type: 'in' as 'in' | 'out' | 'adjust' | 'waste', cause: 'manual' as string, quantity: 0, reference: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const ing = ingredients.find((i) => i.id === form.ingredient_id);
    if (!ing) return;

    const signedQty = form.type === 'in' ? Math.abs(form.quantity) : -Math.abs(form.quantity);
    const newQty = Math.max(0, ing.quantity + signedQty);

    await supabase.from('ingredients').update({ quantity: newQty }).eq('id', ing.id);
    await supabase.from('stock_movements').insert({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      type: form.type,
      cause: form.cause,
      quantity: signedQty,
      unit_cost: ing.cost_per_unit,
      reference: form.reference || null,
      user_name: userName,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
      <div className="card p-6 max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">Enregistrer un mouvement de stock</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Ingredient</label>
            <select value={form.ingredient_id} onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })} className="input">
              <option value="">Choisir...</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="input">
                <option value="in">Entree</option>
                <option value="out">Sortie</option>
                <option value="adjust">Ajustement</option>
                <option value="waste">Perte</option>
              </select>
            </div>
            <div>
              <label className="label">Cause</label>
              <select value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} className="input">
                <option value="manual">Manuel</option>
                <option value="purchase">Achat</option>
                <option value="waste">Perte</option>
                <option value="breakage">Casse</option>
                <option value="transfer">Transfert</option>
                <option value="consumption">Consommation</option>
                <option value="adjustment">Ajustement</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Quantite</label>
            <input type="number" step="0.001" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" />
          </div>
          <div>
            <label className="label">Reference (optionnel)</label>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="input" placeholder="Facture #, note..." />
          </div>
          <button onClick={handleSave} disabled={saving || !form.ingredient_id} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Enregistrer le mouvement
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseModal({
  suppliers,
  ingredients,
  userId,
  userName,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[];
  ingredients: Ingredient[];
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<{ ingredient_id: string; quantity: number; unit_price: number }[]>([]);
  const [selectedIng, setSelectedIng] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  function addItem() {
    if (!selectedIng) return;
    setItems([...items, { ingredient_id: selectedIng, quantity: qty, unit_price: price }]);
    setSelectedIng('');
    setQty(1);
    setPrice(0);
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  async function handleSave() {
    setSaving(true);
    const supplier = suppliers.find((s) => s.id === supplierId);
    const { data: poData } = await supabase.from('purchase_orders').insert({
      po_number: Math.floor(Math.random() * 10000),
      supplier_id: supplierId || null,
      supplier_name: supplier?.name ?? null,
      status: 'ordered',
      total,
      created_by: userId,
    }).select().single();

    if (poData && items.length > 0) {
      await supabase.from('purchase_order_items').insert(
        items.map((i) => {
          const ing = ingredients.find((ing) => ing.id === i.ingredient_id);
          return {
            purchase_order_id: poData.id,
            ingredient_id: i.ingredient_id,
            ingredient_name: ing?.name ?? '',
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.quantity * i.unit_price,
          };
        })
      );

      // Add stock and record movements
      for (const item of items) {
        const ing = ingredients.find((i) => i.id === item.ingredient_id);
        if (ing) {
          await supabase.from('ingredients').update({ quantity: ing.quantity + item.quantity }).eq('id', ing.id);
          await supabase.from('stock_movements').insert({
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            type: 'in',
            cause: 'purchase',
            quantity: item.quantity,
            unit_cost: item.unit_price,
            reference: `PO #${poData.po_number}`,
            user_name: userName,
          });
        }
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4 overflow-y-auto">
      <div className="card p-6 max-w-lg w-full animate-slide-up my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">Nouvelle commande d'achat</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Fournisseur</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
              <option value="">Aucun fournisseur</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="border-t border-secondary-100 pt-4">
            <h3 className="text-sm font-semibold text-secondary-700 mb-3">Articles</h3>
            <div className="grid grid-cols-12 gap-2 mb-2">
              <select value={selectedIng} onChange={(e) => setSelectedIng(e.target.value)} className="input col-span-5">
                <option value="">Choisir un ingredient...</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" step="0.001" placeholder="Qté" value={qty || ''} onChange={(e) => setQty(Number(e.target.value))} className="input col-span-2" />
              <input type="number" step="0.01" placeholder="Prix" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} className="input col-span-3" />
              <button onClick={addItem} className="btn-secondary col-span-2"><Plus className="w-4 h-4" /></button>
            </div>

            {items.length > 0 && (
              <div className="space-y-1">
                {items.map((item, i) => {
                  const ing = ingredients.find((ing) => ing.id === item.ingredient_id);
                  return (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary-50 text-sm">
                      <span className="text-secondary-700">{ing?.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-secondary-500">{item.quantity} x {formatCurrency(item.unit_price)}</span>
                        <span className="font-semibold text-secondary-900">{formatCurrency(item.quantity * item.unit_price)}</span>
                        <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-error-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between p-2 rounded-lg bg-primary-50">
                  <span className="text-sm font-medium text-primary-700">Total</span>
                  <span className="text-sm font-bold text-primary-700">{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || items.length === 0} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Creer la commande d'achat
          </button>
        </div>
      </div>
    </div>
  );
}
