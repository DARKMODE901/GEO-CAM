// supabase/functions/tutor/index.ts
// Supabase Edge Function: Tutor IA con streaming multimodal y Vercel AI SDK v7
// Arquitectura Proxy Segura: el cliente nunca accede a GEMINI_API_KEY directamente.

import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import {
  APICallError,
  RetryError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'npm:ai@7';
import { z } from 'npm:zod@3';

// Esquema de validación para el perfil de usuario con valores por defecto seguros (.catch)
const PerfilSchema = z
  .object({
    nombre: z.string().catch('Explorador'),
    tema: z.string().catch('Geografía y Entorno'),
    nivel: z.enum(['Principiante', 'Intermedio', 'Avanzado']).catch('Intermedio'),
  })
  .catch({
    nombre: 'Explorador',
    tema: 'Geografía y Entorno',
    nivel: 'Intermedio',
  });

Deno.serve(
  withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'Configuración incompleta: GEMINI_API_KEY no definida.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const modelName = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
      const google = createGoogleGenerativeAI({ apiKey });

      // C5: Control de límite diario (Rate Limiting) en Supabase
      // En @supabase/server, ctx.userClaims normaliza el sub como .id (o en ctx.jwtClaims?.sub)
      const userId = ctx.userClaims?.id ?? (ctx.userClaims as any)?.sub ?? (ctx.jwtClaims as any)?.sub;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'No autorizado: usuario no identificado.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const limiteDiario = Number(Deno.env.get('LIMITE_DIARIO') ?? 20);
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Consultar uso_ia con el cliente contextual del usuario (cumple RLS)
      const { count, error: countErr } = await ctx.supabase
        .from('uso_ia')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hace24Horas);

      if (countErr) {
        console.error('[tutor] Error consultando conteo de uso_ia:', countErr);
      } else if (count !== null && count >= limiteDiario) {
        return new Response(
          JSON.stringify({
            error: 'Vuelve mañana',
            message: 'Has alcanzado tu límite diario de consultas con IA. Por favor, vuelve mañana.',
            limit: limiteDiario,
            used: count,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Registrar consumo en uso_ia
      const { error: insertErr } = await ctx.supabase.from('uso_ia').insert({
        user_id: userId,
        funcion: 'tutor',
      });
      if (insertErr) {
        console.warn('[tutor] Advertencia registrando uso_ia:', insertErr);
      }

      // Leer payload de la solicitud
      const body = await req.json();
      const messages: UIMessage[] = body.messages ?? [];
      const perfilRaw = body.perfil;

      // C2: Validar perfil dinámico con Zod y construir instrucciones
      const perfil = PerfilSchema.parse(perfilRaw);
      const userEmail = ctx.userClaims?.email ?? (ctx.jwtClaims as any)?.email ?? 'usuario';

      const instructions = `Eres el Tutor IA oficial de GeoCam, un asistente educativo experto en geografía, arquitectura urbana, naturaleza y viajes.
Estás conversando con el usuario ${perfil.nombre} (${userEmail}).
Nivel de explicación adaptado: ${perfil.nivel}.
Área de interés o enfoque temático: ${perfil.tema}.
Responde de forma amigable, clara, precisa y siempre en español.
Si el usuario adjunta una foto, analiza detalladamente el paisaje, construcciones, elementos geográficos o biofísicos observables.
Si no puedes identificar con certeza una ubicación o elemento, menciónalo con honestidad y brinda pautas para investigarlo.`;

      // Llamada con streaming en Vercel AI SDK v7
      const result = streamText({
        model: google(modelName),
        instructions,
        messages: await convertToModelMessages(messages.slice(-20)),
        temperature: 0.4,
        maxRetries: 1,
        maxOutputTokens: 1024,
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: result.stream,
          onError: (error) => {
            console.error('[tutor] Error en stream de Gemini:', error);
            const real = RetryError.isInstance(error) ? error.lastError : error;
            if (APICallError.isInstance(real) && real.statusCode === 429) {
              return 'Se ha alcanzado temporalmente la cuota gratuita de Gemini. Por favor, espera un minuto antes de continuar la conversación.';
            }
            return 'Ocurrió un error inesperado al generar la respuesta con la IA. Por favor, reintenta en unos instantes.';
          },
        }),
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'none',
        },
      });
    } catch (err: any) {
      console.error('[tutor] Error general en handler:', err);
      return new Response(
        JSON.stringify({ error: err?.message || 'Error interno del servidor en Edge Function tutor.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  })
);
