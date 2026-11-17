// src/services/vision.ts
// Servicio de Visión Multimodal para GeoCam (Taller GeoCam Ve - T2)

import { supabase } from '@/lib/supabase';
import { procesarFotoParaIA } from '@/lib/foto';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface VisionDescriptionResult {
  descripcion: string;
}

/**
 * Describe una fotografía local invocando la Edge Function 'describir-foto' en Supabase.
 * Reduce la imagen a < 300 KB previamente y maneja errores FunctionsHttpError extrayendo
 * el mensaje JSON real retornado por el servidor.
 */
export async function describirFotoConIA(uri: string): Promise<string> {
  // 1. Reducir la imagen local en el teléfono
  const reducida = await procesarFotoParaIA(uri);
  if (!reducida.base64) {
    throw new Error('No se pudo extraer la representación en base64 de la imagen.');
  }

  // 2. Invocar Edge Function protegida en Supabase
  const { data, error } = await supabase.functions.invoke<{ descripcion: string }>(
    'describir-foto',
    {
      body: {
        imageBase64: reducida.base64,
      },
    }
  );

  if (error) {
    let mensajeError = error.message;

    // Si es FunctionsHttpError (4xx o 5xx), extraer el cuerpo JSON del contexto
    if (error instanceof FunctionsHttpError) {
      try {
        const cuerpo = await error.context.json();
        if (cuerpo?.error || cuerpo?.message) {
          mensajeError = cuerpo.message || cuerpo.error;
        }
      } catch {
        // Fallback al mensaje estándar si context no es JSON válido
      }
    }

    if (mensajeError.toLowerCase().includes('not found')) {
      mensajeError =
        'La función "describir-foto" no está desplegada en tu proyecto de Supabase. Despliégala con: npx supabase functions deploy describir-foto';
    }

    throw new Error(mensajeError);
  }

  if (!data?.descripcion) {
    throw new Error('La función de visión no devolvió una descripción válida.');
  }

  return data.descripcion;
}
