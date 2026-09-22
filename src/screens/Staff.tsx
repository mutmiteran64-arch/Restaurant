import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils';
import type { Profile, Attendance, Role } from '@/lib/supabase';
import { Users, Clock, LogIn, LogOut, Loader2, UserCircle, TrendingUp, Calendar, UserPlus, X } from 'lucide-react';

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietaire', manager: 'Manager', cashier: 'Caissier', server: 'Serveur',
  chef: 'Chef', storekeeper: 'Magasinier', accountant: 'Comptable',
};

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-primary-100 text-primary-700', manager: 'bg-secondary-100 text-secondary-700',
  cashier: 'bg-accent-100 text-accent-700', server: 'bg-warning-100 text-warning-700',
  chef: 'bg-error-100 text-error-700', storekeeper: 'bg-secondary-100 text-secondary-600',
  accountant: 'bg-primary-50 text-primary-600',
};

type StaffRole = Exclude<Role, 'owner'>;
type Tab = 'list' | 'attendance' | 'performance';

export default function Staff() {
  const { profile, user } = useAuth();
  const [tab, setTab] = useState<Tab>('list');
  const [staff, setStaff] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [myAttendance, setMyAttendance] = useState<Attendance | null>(null);
  const [perfData, setPerfData] = useState<{ name: string; orders: number; revenue: number }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', phone: '', password: '', role: 'server' as StaffRole });

  const isOwner = profile?.role === 'owner';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [staffRes, attRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('attendance').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setStaff((staffRes.data ?? []) as Profile[]);
    setAttendance((attRes.data ?? []) as Attendance[]);

    if (user) {
      const { data: myAtt } = await supabase.from('attendance').select('*').eq('user_id', user.id).is('clock_out', null).maybeSingle();
      setMyAttendance(myAtt as Attendance | null);
    }

    const { data: ordersByServer } = await supabase.from('orders').select('server_name, total').eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const perfMap = new Map<string, { orders: number; revenue: number }>();
    ordersByServer?.forEach((o) => {
      if (!o.server_name) return;
      const existing = perfMap.get(o.server_name) ?? { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += Number(o.total);
      perfMap.set(o.server_name, existing);
    });
    setPerfData(Array.from(perfMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue));
    setLoading(false);
  }

  async function clockIn() {
    if (!user || !profile) return;
    const { data } = await supabase.from('attendance').insert({ user_id: user.id, user_name: profile.full_name, clock_in: new Date().toISOString(), status: 'present' }).select().single();
    if (data) setMyAttendance(data as Attendance);
  }

  async function clockOut() {
    if (!myAttendance || !user) return;
    const now = new Date();
    const hours = (now.getTime() - new Date(myAttendance.clock_in).getTime()) / (1000 * 60 * 60);
    await supabase.from('attendance').update({ clock_out: now.toISOString(), hours_worked: Math.round(hours * 100) / 100 }).eq('id', myAttendance.id);
    setMyAttendance(null);
    loadData();
  }

  async function toggleActive(member: Profile) {
    if (!isOwner && member.id !== user?.id) return;
    const { error } = await supabase.from('profiles').update({ active: !member.active }).eq('id', member.id);
    if (!error) loadData();
  }

  function openCreate() {
    setCreateError(null);
    setCreateSuccess(null);
    setNewUser({ fullName: '', email: '', phone: '', password: '', role: 'server' });
    setShowCreate(true);
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (!isOwner) return;
    if (newUser.password.length < 6) {
      setCreateError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('create-staff-user', { body: newUser });
    setCreating(false);
    if (error) {
      setCreateError(error.message);
      return;
    }
    if (!data?.ok) {
      setCreateError(data?.error ?? 'Impossible de créer l’utilisateur.');
      return;
    }
    setCreateSuccess(`Le compte de ${newUser.fullName} a été créé. Communiquez-lui son email et son mot de passe temporaire.`);
    setNewUser({ fullName: '', email: '', phone: '', password: '', role: 'server' });
    await loadData();
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Gestion du personnel</h1>
          <p className="text-sm text-secondary-500 mt-1">Gérez les membres de l'équipe, présences et performance</p>
        </div>
        {isOwner && <button onClick={openCreate} className="btn-primary"><UserPlus className="w-4 h-4" /> Ajouter un utilisateur</button>}
      </div>

      <div className="card p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${myAttendance ? 'bg-accent-100' : 'bg-secondary-100'}`}><Clock className={`w-6 h-6 ${myAttendance ? 'text-accent-600' : 'text-secondary-400'}`} /></div>
          <div>
            <p className="text-sm font-semibold text-secondary-900">{myAttendance ? 'Vous êtes pointé(e) - en service' : 'Vous êtes hors service'}</p>
            <p className="text-xs text-secondary-500">{myAttendance ? `Depuis ${formatDateTime(myAttendance.clock_in)}` : 'Pointez pour débuter votre service'}</p>
          </div>
        </div>
        {myAttendance ? <button onClick={clockOut} className="btn-danger"><LogOut className="w-4 h-4" /> Fin de service</button> : <button onClick={clockIn} className="btn-primary"><LogIn className="w-4 h-4" /> Pointer (entrée)</button>}
      </div>

      <div className="flex gap-2 p-1 bg-secondary-100 rounded-lg w-fit">
        {([{ id: 'list', label: 'Membres' }, { id: 'attendance', label: 'Présences' }, { id: 'performance', label: 'Performance' }] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === t.id ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <div key={member.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary-200 flex items-center justify-center"><UserCircle className="w-7 h-7 text-secondary-500" /></div>
                  <div><p className="text-sm font-semibold text-secondary-900">{member.full_name}</p><p className="text-xs text-secondary-400">{member.email}</p></div>
                </div>
                {member.id !== user?.id && isOwner && <button onClick={() => toggleActive(member)} aria-label="Activer ou désactiver" className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${member.active ? 'bg-accent-500' : 'bg-secondary-300'}`}><span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${member.active ? 'translate-x-4' : 'translate-x-1'}`} /></button>}
              </div>
              <div className="flex items-center gap-2"><span className={`badge ${ROLE_COLORS[member.role]}`}>{ROLE_LABELS[member.role]}</span><span className={`badge ${member.active ? 'bg-accent-50 text-accent-600' : 'bg-secondary-100 text-secondary-500'}`}>{member.active ? 'Actif' : 'Inactif'}</span></div>
              {member.phone && <p className="text-xs text-secondary-400 mt-3">{member.phone}</p>}
            </div>
          ))}
          {staff.length === 0 && <div className="col-span-full flex flex-col items-center justify-center py-12 text-secondary-400"><Users className="w-10 h-10 mb-2 opacity-50" /><p className="text-sm">Aucun membre du personnel</p></div>}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-secondary-50 border-b border-secondary-100"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Employé</th><th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Entrée</th><th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Sortie</th><th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Heures</th><th className="text-center px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Statut</th></tr></thead>
            <tbody className="divide-y divide-secondary-50">{attendance.map((att) => <tr key={att.id} className="hover:bg-secondary-50"><td className="px-4 py-3 text-sm font-medium text-secondary-900">{att.user_name}</td><td className="px-4 py-3 text-sm text-secondary-500">{formatDateTime(att.clock_in)}</td><td className="px-4 py-3 text-sm text-secondary-500">{att.clock_out ? formatDateTime(att.clock_out) : '—'}</td><td className="px-4 py-3 text-right text-sm font-semibold text-secondary-900">{att.hours_worked ? `${formatNumber(att.hours_worked, 2)}h` : '—'}</td><td className="px-4 py-3 text-center"><span className={`badge ${att.status === 'present' ? 'bg-accent-100 text-accent-700' : att.status === 'late' ? 'bg-warning-100 text-warning-700' : att.status === 'absent' ? 'bg-error-100 text-error-700' : 'bg-secondary-100 text-secondary-600'}`}>{att.status}</span></td></tr>)}</tbody>
          </table>
          {attendance.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-secondary-400"><Calendar className="w-10 h-10 mb-2 opacity-50" /><p className="text-sm">Aucun enregistrement de présence</p></div>}
        </div>
      )}

      {tab === 'performance' && <div className="space-y-4"><div className="card p-6"><h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary-600" />Meilleurs performeurs (30 derniers jours)</h2>{perfData.length === 0 ? <p className="text-sm text-secondary-400 text-center py-8">Pas encore de données de performance</p> : <div className="space-y-3">{perfData.map((p, i) => { const maxRev = Math.max(...perfData.map((d) => d.revenue), 1); return <div key={p.name} className="flex items-center gap-4"><span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-600'}`}>{i + 1}</span><div className="flex-1"><div className="flex justify-between mb-1"><span className="text-sm font-medium text-secondary-900">{p.name}</span><span className="text-sm font-semibold text-secondary-700">{formatCurrency(p.revenue)}</span></div><div className="flex items-center gap-2"><div className="flex-1 h-2 rounded-full bg-secondary-100 overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${(p.revenue / maxRev) * 100}%` }} /></div><span className="text-xs text-secondary-400 w-16 text-right">{p.orders} commandes</span></div></div></div>; })}</div>}</div></div>}

      {showCreate && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-bold text-secondary-900">Ajouter un utilisateur</h2><p className="text-sm text-secondary-500 mt-1">Seul le propriétaire peut créer un nouveau compte.</p></div><button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-secondary-100"><X className="w-5 h-5" /></button></div>
            <form onSubmit={createStaff} className="space-y-4">
              <div><label className="label">Nom complet</label><input required className="input" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Jean Dupont" /></div>
              <div><label className="label">Email</label><input required type="email" className="input" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jean@restaurant.com" /></div>
              <div><label className="label">Téléphone (facultatif)</label><input className="input" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="+243 ..." /></div>
              <div><label className="label">Rôle</label><select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as StaffRole })}>{(['manager', 'cashier', 'server', 'chef', 'storekeeper', 'accountant'] as StaffRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>
              <div><label className="label">Mot de passe temporaire</label><input required minLength={6} type="password" className="input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Minimum 6 caractères" /><p className="text-xs text-secondary-400 mt-1">Le propriétaire communique ce mot de passe au nouvel utilisateur.</p></div>
              {createError && <div className="text-sm text-error-700 bg-error-50 border border-error-200 rounded-lg px-3 py-2">{createError}</div>}
              {createSuccess && <div className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">{createSuccess}</div>}
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button><button disabled={creating} type="submit" className="btn-primary">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Créer le compte</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
