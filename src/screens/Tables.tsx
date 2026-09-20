import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RestaurantTable, Order, Reservation } from '@/lib/supabase';
import { formatCurrency, formatTime, getDateString } from '@/lib/utils';
import {
  Plus,
  Users,
  Clock,
  Check,
  X,
  Trash2,
  Merge,
  Split,
  ArrowRightLeft,
  CalendarPlus,
  Loader2,
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  free: { bg: 'bg-accent-50', text: 'text-accent-700', border: 'border-accent-300', label: 'Libre' },
  occupied: { bg: 'bg-error-50', text: 'text-error-700', border: 'border-error-300', label: 'Occupee' },
  reserved: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-300', label: 'Reservee' },
  waiting: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-300', label: 'En attente' },
  cleaning: { bg: 'bg-secondary-100', text: 'text-secondary-600', border: 'border-secondary-300', label: 'Nettoyage' },
};

export default function Tables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Map<string, Order>>(new Map());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showReserve, setShowReserve] = useState<RestaurantTable | null>(null);
  const [newTable, setNewTable] = useState({ name: '', zone: 'Main', capacity: 4, shape: 'round' });

  useEffect(() => {
    loadTables();
  }, []);

  async function loadTables() {
    const [tbls, ords, resv] = await Promise.all([
      supabase.from('restaurant_tables').select('*').order('zone').order('name'),
      supabase.from('orders').select('*').in('status', ['open', 'sent']),
      supabase.from('reservations').select('*').eq('reservation_date', getDateString()).neq('status', 'cancelled'),
    ]);

    setTables(tbls.data ?? []);
    const orderMap = new Map<string, Order>();
    (ords.data ?? []).forEach((o) => {
      if (o.table_id) orderMap.set(o.table_id, o as Order);
    });
    setOrders(orderMap);
    setReservations(resv.data ?? []);
    setLoading(false);
  }

  async function updateTableStatus(tableId: string, status: RestaurantTable['status']) {
    await supabase.from('restaurant_tables').update({ status }).eq('id', tableId);
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status } : t)));
  }

  async function addTable() {
    if (!newTable.name) return;
    await supabase.from('restaurant_tables').insert({
      name: newTable.name,
      zone: newTable.zone,
      capacity: newTable.capacity,
      shape: newTable.shape,
      pos_x: Math.floor(Math.random() * 400),
      pos_y: Math.floor(Math.random() * 300),
    });
    setNewTable({ name: '', zone: 'Main', capacity: 4, shape: 'round' });
    setShowAdd(false);
    loadTables();
  }

  async function deleteTable(id: string) {
    await supabase.from('restaurant_tables').delete().eq('id', id);
    loadTables();
  }

  const zones = Array.from(new Set(tables.map((t) => t.zone)));
  const stats = {
    free: tables.filter((t) => t.status === 'free').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
    cleaning: tables.filter((t) => t.status === 'cleaning').length,
  };

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
          <h1 className="text-2xl font-bold text-secondary-900">Plan de salle</h1>
          <p className="text-sm text-secondary-500 mt-1">Gerez les tables et reservations en temps reel</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Ajouter une table
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_COLORS).map(([status, config]) => (
          <div key={status} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config.bg} border ${config.border}`} />
              <div>
                <p className="text-xs text-secondary-500">{config.label}</p>
                <p className="text-xl font-bold text-secondary-900">{stats[status as keyof typeof stats] ?? 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables by zone */}
      {zones.map((zone) => (
        <div key={zone}>
          <h2 className="text-sm font-semibold text-secondary-700 uppercase tracking-wide mb-3">{zone}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables
              .filter((t) => t.zone === zone)
              .map((table) => {
                const config = STATUS_COLORS[table.status];
                const order = orders.get(table.id);
                const tableRes = reservations.find((r) => r.table_id === table.id);

                return (
                  <div
                    key={table.id}
                    className={`card p-4 border-2 ${config.border} ${config.bg} hover:shadow-md transition-all cursor-pointer group`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 rounded-xl ${table.shape === 'round' ? 'rounded-full' : ''} bg-white border-2 ${config.border} flex items-center justify-center`}>
                        <span className={`text-lg font-bold ${config.text}`}>{table.name}</span>
                      </div>
                      <span className={`badge ${config.bg} ${config.text} border ${config.border}`}>
                        {config.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-secondary-600 mb-3">
                      <Users className="w-3.5 h-3.5" />
                      <span>{table.capacity} places</span>
                    </div>

                    {order && (
                      <div className="text-xs text-secondary-600 mb-2 p-2 rounded-md bg-white/60">
                        <p className="font-medium">Commande #{order.order_number}</p>
                        <p>{formatCurrency(order.total)}</p>
                      </div>
                    )}

                    {tableRes && table.status === 'reserved' && (
                      <div className="text-xs text-warning-700 mb-2 p-2 rounded-md bg-white/60">
                        <p className="font-medium">{tableRes.customer_name}</p>
                        <p>{formatTime(`2000-01-01T${tableRes.reservation_time}`)} • {tableRes.party_size}p</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      {table.status !== 'free' && (
                        <button
                          onClick={() => updateTableStatus(table.id, 'free')}
                          className="px-2 py-1 text-xs rounded bg-white border border-secondary-200 hover:bg-accent-50 text-accent-700"
                        >
                          Liberer
                        </button>
                      )}
                      {table.status !== 'occupied' && (
                        <button
                          onClick={() => updateTableStatus(table.id, 'occupied')}
                          className="px-2 py-1 text-xs rounded bg-white border border-secondary-200 hover:bg-error-50 text-error-700"
                        >
                          Occuper
                        </button>
                      )}
                      {table.status !== 'reserved' && (
                        <button
                          onClick={() => setShowReserve(table)}
                          className="px-2 py-1 text-xs rounded bg-white border border-secondary-200 hover:bg-warning-50 text-warning-700"
                        >
                          Reserver
                        </button>
                      )}
                      {table.status !== 'cleaning' && (
                        <button
                          onClick={() => updateTableStatus(table.id, 'cleaning')}
                          className="px-2 py-1 text-xs rounded bg-white border border-secondary-200 hover:bg-secondary-100 text-secondary-600"
                        >
                          Nettoyer
                        </button>
                      )}
                      <button
                        onClick={() => deleteTable(table.id)}
                        className="px-2 py-1 text-xs rounded bg-white border border-secondary-200 hover:bg-error-50 text-error-600 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {tables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-secondary-400">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Aucune table. Ajoutez votre premiere table pour commencer.</p>
        </div>
      )}

      {/* Add table modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
          <div className="card p-6 max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-secondary-900">Ajouter une table</h2>
              <button onClick={() => setShowAdd(false)} className="text-secondary-400 hover:text-secondary-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nom / Numero de table</label>
                <input
                  value={newTable.name}
                  onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                  className="input"
                  placeholder="T1, Table 5, etc."
                />
              </div>
              <div>
                <label className="label">Zone</label>
                <input
                  value={newTable.zone}
                  onChange={(e) => setNewTable({ ...newTable, zone: e.target.value })}
                  className="input"
                  placeholder="Salle, Terrasse, Bar..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Capacite</label>
                  <input
                    type="number"
                    value={newTable.capacity}
                    onChange={(e) => setNewTable({ ...newTable, capacity: Number(e.target.value) })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Forme</label>
                  <select
                    value={newTable.shape}
                    onChange={(e) => setNewTable({ ...newTable, shape: e.target.value })}
                    className="input"
                  >
                    <option value="round">Ronde</option>
                    <option value="square">Carree</option>
                    <option value="rect">Rectangle</option>
                  </select>
                </div>
              </div>
              <button onClick={addTable} className="btn-primary w-full">
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation modal */}
      {showReserve && (
        <ReservationModal
          table={showReserve}
          onClose={() => setShowReserve(null)}
          onSaved={() => {
            setShowReserve(null);
            loadTables();
          }}
        />
      )}
    </div>
  );
}

function ReservationModal({
  table,
  onClose,
  onSaved,
}: {
  table: RestaurantTable;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    party_size: 2,
    reservation_time: '19:00',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('reservations').insert({
      table_id: table.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      party_size: form.party_size,
      reservation_date: getDateString(),
      reservation_time: form.reservation_time,
      status: 'confirmed',
      notes: form.notes || null,
    });
    await supabase.from('restaurant_tables').update({ status: 'reserved' }).eq('id', table.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
      <div className="card p-6 max-w-md w-full animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary-900">Reserver {table.name}</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nom du client</label>
            <input
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              className="input"
              placeholder="Jean Dupont"
            />
          </div>
          <div>
            <label className="label">Telephone</label>
            <input
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              className="input"
              placeholder="+243 000 000 000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre de personnes</label>
              <input
                type="number"
                min="1"
                value={form.party_size}
                onChange={(e) => setForm({ ...form, party_size: Number(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Heure</label>
              <input
                type="time"
                value={form.reservation_time}
                onChange={(e) => setForm({ ...form, reservation_time: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input"
              rows={2}
              placeholder="Demandes speciales..."
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
            Confirmer la reservation
          </button>
        </form>
      </div>
    </div>
  );
}
