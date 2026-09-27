import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { StaffUser } from '@/lib/types';

interface AuthState {
  session: Session | null;
  profile: StaffUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    loading: true,
  });

  async function loadProfile(userId: string): Promise<StaffUser | null> {
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data as StaffUser | null;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session;
      let profile: StaffUser | null = null;
      if (session?.user) {
        profile = await loadProfile(session.user.id);
      }
      setState({ session, profile, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        let profile: StaffUser | null = null;
        if (session?.user) {
          // Retry profile load — trigger may not have run yet on brand-new signup
          for (let i = 0; i < 5; i++) {
            profile = await loadProfile(session.user.id);
            if (profile) break;
            await new Promise((r) => setTimeout(r, 300));
          }
        }
        setState({ session, profile, loading: false });
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign in error:', error.message, error.status);
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        return { error: 'Invalid email or password.' };
      }
      if (msg.includes('email not confirmed') || msg.includes('confirm')) {
        return { error: 'Please confirm your email first, then sign in.' };
      }
      if (msg.includes('rate') || msg.includes('limit')) {
        return { error: 'Too many attempts. Please wait a moment and try again.' };
      }
      return { error: `Unable to sign in: ${error.message}` };
    }
    return { error: null };
  }

  async function signUp(name: string, email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      console.error('Sign up error:', error.message, error.status);
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered')) {
        return { error: 'An account with this email already exists. Try signing in instead.' };
      }
      if (msg.includes('password')) {
        return { error: 'Password is too weak. Please use at least 6 characters.' };
      }
      if (msg.includes('email') || msg.includes('invalid')) {
        return { error: 'Please enter a valid email address.' };
      }
      if (msg.includes('rate') || msg.includes('limit')) {
        return { error: 'Too many attempts. Please wait a moment and try again.' };
      }
      return { error: `Unable to create account: ${error.message}` };
    }
    // If no session returned, email confirmation may be enabled.
    // The onAuthStateChange handler will pick up the session once they confirm.
    if (data.session) {
      for (let i = 0; i < 5; i++) {
        const profile = await loadProfile(data.session.user.id);
        if (profile) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    } else if (data.user) {
      // Email confirmation required — session is null but user was created
      return { error: 'Account created! Please check your email to confirm, then sign in.' };
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ session: null, profile: null, loading: false });
  }

  async function refreshProfile() {
    if (!state.session?.user) return;
    const profile = await loadProfile(state.session.user.id);
    setState((s) => ({ ...s, profile }));
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
