import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChefHat, Lock, Mail, User, Loader2, ArrowRight, Store } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp, setupAvailable } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(setupAvailable ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (setupAvailable) setMode('signup');
  }, [setupAvailable]);

  function switchMode(next: 'signin' | 'signup') {
    setError(null);
    setSuccess(null);
    setMode(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (mode === 'signin') {
      const result = await signIn(email, password);
      if (result.error) setError(result.error);
    } else {
      if (!setupAvailable) {
        setError('Le compte principal existe déjà. Les autres utilisateurs doivent être créés par le propriétaire.');
        setSubmitting(false);
        return;
      }
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères');
        setSubmitting(false);
        return;
      }
      if (restaurantName.trim().length < 2) {
        setError('Le nom du restaurant est obligatoire');
        setSubmitting(false);
        return;
      }
      const result = await signUp(email, password, fullName, restaurantName);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Compte principal créé et confirmé avec succès. Connexion automatique en cours…');
        window.setTimeout(async () => {
          const loginResult = await signIn(email, password);
          if (loginResult.error) {
            setSuccess(null);
            setError(`Le compte a bien été créé, mais la connexion automatique a échoué : ${loginResult.error}`);
            setSubmitting(false);
          }
        }, 900);
        return;
      }
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary-950 via-secondary-900 to-primary-950 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-lg shadow-primary-600/30">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white font-display">RestoFlow</h1>
          <p className="text-secondary-400 mt-2 text-sm">Gestion de restaurant, simplifiée</p>
        </div>

        <div className="card p-8">
          {setupAvailable ? (
            <div className="flex gap-2 mb-6 p-1 bg-secondary-100 rounded-lg">
              <button onClick={() => switchMode('signin')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'signin' ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'}`}>
                Connexion
              </button>
              <button onClick={() => switchMode('signup')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'signup' ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500'}`}>
                Premier compte
              </button>
            </div>
          ) : (
            <div className="mb-6 rounded-xl bg-primary-50 border border-primary-100 p-4">
              <p className="text-sm font-semibold text-primary-900">Connexion au restaurant</p>
              <p className="text-xs text-primary-700 mt-1">Le compte principal est déjà configuré. Les nouveaux utilisateurs sont créés par le propriétaire depuis Personnel.</p>
            </div>
          )}

          {mode === 'signup' && setupAvailable && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-secondary-900">Créer le compte principal</p>
              <p className="text-xs text-secondary-500 mt-1">Ce compte deviendra le propriétaire du restaurant. Il sera le seul à pouvoir créer les autres utilisateurs.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && setupAvailable && (
              <>
                <div>
                  <label className="label">Nom du restaurant</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                    <input type="text" required value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} className="input pl-10" placeholder="Mon Restaurant" />
                  </div>
                </div>
                <div>
                  <label className="label">Nom complet du propriétaire</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input pl-10" placeholder="Jean Dupont" />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="vous@restaurant.com" />
              </div>
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10" placeholder="••••••••" />
              </div>
            </div>

            {error && <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2 animate-fade-in">{error}</div>}
            {success && <div className="text-sm text-success-700 bg-success-50 border border-success-200 rounded-lg px-3 py-2 animate-fade-in">{success}</div>}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'signin' ? 'Se connecter' : 'Créer le compte principal'}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-secondary-500 text-xs mt-6">Gérez vos ventes, tables, stocks, personnel et finances — tout au même endroit.</p>
      </div>
    </div>
  );
}
