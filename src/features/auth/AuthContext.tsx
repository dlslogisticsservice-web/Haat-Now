import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, AuthState } from './types';
import { Session } from '@supabase/supabase-js';

const AuthContext = createContext<AuthState>({ user: null, loading: true, error: null });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateUser(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateUser = (session: Session | null) => {
    if (session?.user) {
      setAuthState({
        user: { id: session.user.id, phone_number: session.user.phone || '', role: 'customer' }, // Simplified role mapping
        loading: false,
        error: null,
      });
    } else {
      setAuthState({ user: null, loading: false, error: null });
    }
  };

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
