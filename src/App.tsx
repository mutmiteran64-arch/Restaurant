import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthScreen from '@/screens/AuthScreen';
import AppLayout, { type PageId } from '@/components/AppLayout';
import Dashboard from '@/screens/Dashboard';
import POS from '@/screens/POS';
import Tables from '@/screens/Tables';
import Menu from '@/screens/Menu';
import Stock from '@/screens/Stock';
import Staff from '@/screens/Staff';
import Finance from '@/screens/Finance';
import Reports from '@/screens/Reports';
import SettingsScreen from '@/screens/Settings';
import AuditLog from '@/screens/AuditLog';
import { Loader2 } from 'lucide-react';
import OfflineStatus from '@/offline/OfflineStatus';
import { startSync } from '@/offline/syncEngine';

function AppContent() {
  useEffect(() => startSync(), []);
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setTimedOut(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'pos': return <POS />;
      case 'tables': return <Tables />;
      case 'menu': return <Menu />;
      case 'stock': return <Stock />;
      case 'staff': return <Staff />;
      case 'finance': return <Finance />;
      case 'reports': return <Reports />;
      case 'settings': return <SettingsScreen />;
      case 'audit': return <AuditLog />;
      default: return <Dashboard />;
    }
  }

  return (
    <AppLayout currentPage={page} onNavigate={setPage}>
      <OfflineStatus />
      {renderPage()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
