// src/context/AuthContext.tsx
// Contexto de autenticación con Supabase para GeoCam.
// Gestiona sesión, usuario y operaciones de auth (login, registro, logout).

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ─── Tipos del contexto de autenticación ──────────────────────────────────────

interface AuthContextValue {
  /** Sesión activa de Supabase (null si no autenticado) */
  session: Session | null;
  /** Usuario autenticado (null si no autenticado) */
  user: User | null;
  /** Indica si se está restaurando la sesión al iniciar */
  loading: boolean;
  /** Inicia sesión con email y contraseña */
  signIn: (email: string, password: string) => Promise<void>;
  /** Registra un nuevo usuario con email y contraseña */
  signUp: (email: string, password: string) => Promise<void>;
  /** Cierra la sesión actual */
  signOut: () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * AuthProvider: Provee el estado de autenticación a toda la app.
 *
 * - Restaura la sesión persistida al montar (getSession).
 * - Escucha cambios de autenticación con onAuthStateChange.
 * - Expone métodos para signIn, signUp y signOut.
 *
 * REGLA 4: Solo usa API v2 de Supabase (getSession, getUser, onAuthStateChange).
 * REGLA 5: NO usa router.replace() — la navegación se controla con renderizado condicional.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión persistida al montar con timeout de seguridad (2.5s)
    const restoreSession = async () => {
      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<any>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2500)
        );
        const { data } = await Promise.race([getSessionPromise, timeoutPromise]);
        const currentSession = data?.session ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (error) {
        console.warn('Error restaurando sesión:', error);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    // Escuchar cambios de autenticación (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    // Limpiar suscripción al desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ── Métodos de autenticación ──────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // ── Valor del contexto ────────────────────────────────────────────────────

  const value: AuthContextValue = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Custom Hook de acceso ────────────────────────────────────────────────────

/**
 * useAuth: hook de acceso seguro al contexto de autenticación.
 * Debe usarse dentro de <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
