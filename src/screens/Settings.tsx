import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile, Role } from '@/lib/supabase';
import { getExchangeRate } from '@/lib/utils';
import {
  Settings as SettingsIcon,
  Loader2,
  Save,
  User,
  Bell,
  Percent,
  Store,
  Check,
  ArrowLeftRight,
} from 'lucide-react';

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietaire',
  manager: 'Manager',
  cashier: 'Caissier',
  server: 'Serveur',
  chef: 'Chef',
  storekeeper: 'Magasinier',
  accountant: 'Comptable',
};

export default function SettingsScreen() {
  const { profile } = useAuth();
  const [taxRate, setTaxRate] = useState(0);
  const [restaurantName, setRestaurantName] = useState('Mon Restaurant');
  const [exchangeRate, setExchangeRate] = useState(getExchangeRate());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedTax = localStorage.getItem('taxRate');
    const savedName = localStorage.getItem('restaurantName');
    const savedRate = localStorage.getItem('exchangeRate');
    if (savedTax) setTaxRate(Number(savedTax));
    if (savedName) setRestaurantName(savedName);
    if (savedRate) setExchangeRate(Number(savedRate));
  }, []);

  function handleSave() {
    setSaving(true);
    localStorage.setItem('taxRate', String(taxRate));
    localStorage.setItem('restaurantName', restaurantName);
    localStorage.setItem('exchangeRate', String(exchangeRate));
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Parametres</h1>
        <p className="text-sm text-secondary-500 mt-1">Configurez les preferences de votre restaurant</p>
      </div>

      {/* Restaurant info */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-secondary-900">Informations du restaurant</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nom du restaurant</label>
            <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} className="input" />
          </div>
        </div>
      </div>

      {/* Currency & Exchange Rate */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-secondary-900">Devise & Taux d'echange</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Devise principale</label>
            <input value="USD ($)" disabled className="input bg-secondary-50" />
            <p className="text-xs text-secondary-400 mt-1.5">La devise principale est le dollar US (USD).</p>
          </div>
          <div>
            <label className="label">Taux d'echange USD vers Fc (Francs Congolais)</label>
            <input
              type="number"
              step="1"
              value={exchangeRate || ''}
              onChange={(e) => setExchangeRate(Number(e.target.value))}
              className="input max-w-xs"
              placeholder="2000"
            />
            <p className="text-xs text-secondary-400 mt-1.5">
              1 USD = {exchangeRate || 0} Fc. Les montants s'afficheront en USD et en Fc partout dans l'application.
            </p>
          </div>
        </div>
      </div>

      {/* Tax & billing */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-secondary-900">Taxes & Facturation</h2>
        </div>
        <div>
          <label className="label">Taux de taxe par defaut (%)</label>
          <input
            type="number"
            step="0.01"
            value={taxRate || ''}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className="input max-w-xs"
            placeholder="0"
          />
          <p className="text-xs text-secondary-400 mt-1.5">Ce taux sera pre-rempli sur les nouvelles commandes a la caisse.</p>
        </div>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-secondary-900">Votre profil</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nom complet</label>
            <input value={profile?.full_name ?? ''} disabled className="input bg-secondary-50" />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={profile?.email ?? ''} disabled className="input bg-secondary-50" />
          </div>
          <div>
            <label className="label">Role</label>
            <input value={profile ? ROLE_LABELS[profile.role] : ''} disabled className="input bg-secondary-50" />
          </div>
          <div>
            <label className="label">Telephone</label>
            <input value={profile?.phone ?? ''} disabled className="input bg-secondary-50" />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Enregistre !' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
