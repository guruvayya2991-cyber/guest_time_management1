import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { AuthPage } from '@/pages/AuthPage';
import { Dashboard } from '@/pages/Dashboard';
import { History } from '@/pages/History';
import { SettingsPage } from '@/pages/SettingsPage';
import { Stats } from '@/pages/Stats';
import { Staff } from '@/pages/Staff';
import { Clock } from 'lucide-react';

type Page = 'dashboard' | 'history' | 'settings' | 'stats' | 'staff';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-500 mb-4 animate-pulse">
            <Clock className="w-7 h-7 text-slate-950" strokeWidth={2.5} />
          </div>
          <p className="text-slate-400 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  // Guard admin-only pages
  const isAdmin = profile.role === 'admin';
  const safePage = (page === 'stats' || page === 'staff') && !isAdmin ? 'dashboard' : page;

  return (
    <>
      {safePage === 'dashboard' && <Dashboard onNavigate={setPage} />}
      {safePage === 'history' && <History onNavigate={setPage} />}
      {safePage === 'settings' && <SettingsPage onNavigate={setPage} />}
      {safePage === 'stats' && isAdmin && <Stats onNavigate={setPage} />}
      {safePage === 'staff' && isAdmin && <Staff onNavigate={setPage} />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
