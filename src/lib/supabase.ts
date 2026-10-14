// src/lib/supabase.ts
// Cliente de Supabase configurado con almacenamiento seguro y auto-refresh de sesión.

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { secureStorage } from './secureStorage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

/**
 * Cliente de Supabase con:
 * - Almacenamiento seguro (chunked SecureStore)
 * - Auto-refresh de token según el estado de la app
 * - Sesión persistente
 * - Sin detección de URL (no es web)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Listener de AppState para iniciar/detener el auto-refresh del token.
 * Cuando la app está activa, se refresca automáticamente.
 * Cuando pasa a segundo plano, se detiene para ahorrar recursos.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
