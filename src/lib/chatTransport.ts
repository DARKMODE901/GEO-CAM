// src/lib/chatTransport.ts
// Transporte de streaming para Vercel AI SDK v7 con expo/fetch y autenticación de Supabase

import { fetch as expoFetch } from 'expo/fetch';
import { DefaultChatTransport } from 'ai';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { getUserProfile } from '@/services/userProfile';

/**
 * Crea una instancia de DefaultChatTransport para comunicar useChat con una Supabase Edge Function
 * usando streaming continuo mediante expo/fetch y validación de sesión de usuario en cada petición.
 */
export function crearTransporte(funcion: string = 'tutor') {
  return new DefaultChatTransport({
    api: `${supabaseUrl}/functions/v1/${funcion}`,
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    headers: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        throw new Error('No hay sesión activa de Supabase. Inicia sesión para continuar.');
      }
      return {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: supabaseAnonKey,
      };
    },
    body: async () => {
      const perfil = await getUserProfile();
      return { perfil };
    },
  });
}
