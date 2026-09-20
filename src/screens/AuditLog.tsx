import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/lib/supabase';
import {
  ScrollText,
  Search,
  Loader2,
  Shield,
  Activity,
} from 'lucide-react';

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data ?? []);
    setLoading(false);
  }

  const filteredLogs = logs.filter((log) => {
    const matchSearch = !search || log.action.toLowerCase().includes(search.toLowerCase()) || log.user_name?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const actions = Array.from(new Set(logs.map((l) => l.action)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Journal d'audit</h1>
        <p className="text-sm text-secondary-500 mt-1">Historique complet de toutes les operations sensibles</p>
      </div>

      {/* Info banner */}
      <div className="card p-4 bg-secondary-50 border-secondary-200">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-secondary-500" />
          <p className="text-sm text-secondary-600">
            Toutes les actions sensibles (creation de commandes, modifications, annulations, mouvements de stock) sont enregistrees de maniere permanente pour la securite et la conformite.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Rechercher par action ou utilisateur..."
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input max-w-xs">
          <option value="">Toutes les actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Log table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary-50 border-b border-secondary-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Horodatage</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Utilisateur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Entite</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-50">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-secondary-50 transition-colors">
                <td className="px-4 py-3 text-sm text-secondary-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-3 text-sm font-medium text-secondary-900">{log.user_name ?? 'Systeme'}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-primary-50 text-primary-700">{log.action}</span>
                </td>
                <td className="px-4 py-3 text-sm text-secondary-600">{log.entity_type}</td>
                <td className="px-4 py-3 text-sm text-secondary-500">
                  {log.details ? JSON.stringify(log.details).slice(0, 80) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-secondary-400">
            <Activity className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">Aucun journal d'audit trouve</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-secondary-400">
        <ScrollText className="w-3.5 h-3.5" />
        Affichage de {filteredLogs.length} sur {logs.length} entrees
      </div>
    </div>
  );
}
