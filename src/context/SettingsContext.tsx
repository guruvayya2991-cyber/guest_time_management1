import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/types';

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  updateSettings: (patch: Partial<Settings>) => Promise<{ error: string | null }>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const FALLBACK_SETTINGS: Settings = {
  id: 1,
  ...DEFAULT_SETTINGS,
  updated_at: new Date().toISOString(),
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (!mounted) return;
      if (!error && data) {
        setSettings(data as Settings);
      }
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: '*', table: 'settings', schema: 'public' },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateSettings(patch: Partial<Settings>) {
    const { data, error } = await supabase
      .from('settings')
      .update(patch)
      .eq('id', 1)
      .select()
      .maybeSingle();
    if (error) return { error: 'Unable to save settings. Please try again.' };
    if (data) setSettings(data as Settings);
    return { error: null };
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
