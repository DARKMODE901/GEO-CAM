// src/services/tarjetasService.ts
// Invocación a Supabase Edge Function 'tarjetas-repaso' para generar tarjetas de estudio estructuradas (C3)

import { supabase } from '@/lib/supabase';
import type { UIMessage } from 'ai';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface TarjetaRepaso {
  pregunta: string;
  respuesta: string;
}

/**
 * Invoca la Edge Function protegida 'tarjetas-repaso' para generar entre 3 y 5
 * tarjetas de estudio estructuradas con formato Zod validado en el servidor.
 */
export async function generarTarjetasDeRepaso(messages: UIMessage[]): Promise<TarjetaRepaso[]> {
  if (!messages || messages.length === 0) {
    throw new Error('Debes tener al menos un mensaje en la conversación para generar tarjetas de repaso.');
  }

  const { data, error } = await supabase.functions.invoke<{ tarjetas: TarjetaRepaso[] }>(
    'tarjetas-repaso',
    {
      body: { messages },
    }
  );

  if (error) {
    let mensaje = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const cuerpo = await error.context.json();
        if (cuerpo?.error || cuerpo?.message) {
          mensaje = cuerpo.message || cuerpo.error;
        }
      } catch {
        // Fallback
      }
    }

    if (mensaje.toLowerCase().includes('not found')) {
      mensaje =
        'La función "tarjetas-repaso" no está desplegada en tu proyecto de Supabase. Despliégala con: npx supabase functions deploy tarjetas-repaso';
    }
    throw new Error(mensaje);
  }

  if (!data?.tarjetas || !Array.isArray(data.tarjetas)) {
    throw new Error('El servidor no devolvió una lista válida de tarjetas.');
  }

  return data.tarjetas;
}
