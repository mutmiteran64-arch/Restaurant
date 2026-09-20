import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  setupAvailable: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, restaurantName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupAvailable, setSetupAvailable] = useState(false);

  useEffect(() => {
    loadSetupAvailability();

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setLoading(false);
        return;
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        (async () => { await loadProfile(newSession.user.id); })();
      } else {
        setProfile(null);
        setLoading(false);
        loadSetupAvailability();
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function loadSetupAvailability() {
    const { data, error } = await supabase.rpc('initial_setup_available');
    setSetupAvailable(!error && data === true);
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    setProfile(error || !data ? null : data as Profile);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch {
      return { error: 'Impossible de se connecter. Vérifiez votre connexion puis réessayez.' };
    }
  }

  async function signUp(email: string, password: string, fullName: string, restaurantName: string) {
    try {
      const { data, error } = await supabase.functions.invoke('bootstrap-owner', {
        body: { email, password, fullName, restaurantName },
      });

      if (error) return { error: error.message };
      if (!data?.ok) return { error: data?.error ?? 'Impossible de créer le compte principal.' };

      const signInResult = await signIn(email, password);
      if (signInResult.error) return signInResult;

      setSetupAvailable(false);
      return { error: null };
    } catch {
      return { error: 'Impossible de créer le compte. Vérifiez votre connexion puis réessayez.' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
    await loadSetupAvailability();
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, setupAvailable, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
