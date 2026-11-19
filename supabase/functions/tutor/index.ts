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
  type TextStreamPart,
  type ToolSet,
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

      const modelMessages = await convertToModelMessages(messages.slice(-20));
      const fallbackModel = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
      const PRIMARY_FIRST_TOKEN_MS = 8000;
      const FALLBACK_FIRST_TOKEN_MS = 25000;

      type TutorChunk = TextStreamPart<ToolSet>;

      const iniciarStream = (targetModel: string, maxRetries: number, abortSignal: AbortSignal) =>
        streamText({
          model: google(targetModel),
          instructions,
          messages: modelMessages,
          temperature: 0.4,
          maxRetries,
          maxOutputTokens: 1024,
          abortSignal,
        }).stream;

      const readWithDeadline = async (
        reader: ReadableStreamDefaultReader<TutorChunk>,
        deadlineMs: number | null,
        label: string
      ) => {
        if (deadlineMs === null) return reader.read();
        const remaining = deadlineMs - Date.now();
        if (remaining <= 0) {
          throw new Error(`TIMEOUT_${label}`);
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`TIMEOUT_${label}`)), remaining);
            }),
          ]);
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      };

      // Stream con fallback rápido: maxRetries=0 y timeout de 8s en el modelo primario (gemini-3.8-flash).
      // Si devuelve error (503/429) o no responde texto en 8s, aborta y conmuta a gemini-3.5-flash-lite.
      let activeReader: ReadableStreamDefaultReader<TutorChunk> | null = null;
      let activeAbort: AbortController | null = null;
      let clientCancelled = false;

      const streamWithFallback = new ReadableStream<TutorChunk>({
        async start(controller) {
          console.log(`[tutor] Iniciando stream primario con ${modelName}`);
          const primaryAbort = new AbortController();
          activeAbort = primaryAbort;
          const primaryReader = iniciarStream(modelName, 0, primaryAbort.signal).getReader();
          activeReader = primaryReader;

          const buffered: TutorChunk[] = [];
          let hasText = false;
          let fallbackNeeded = false;
          const primaryDeadline = Date.now() + PRIMARY_FIRST_TOKEN_MS;

          try {
            while (!clientCancelled) {
              const { done, value } = await readWithDeadline(
                primaryReader,
                hasText ? null : primaryDeadline,
                'PRIMARIO'
              );
              if (done) break;

              if (!hasText) {
                if (value.type === 'error' && modelName !== fallbackModel) {
                  console.warn(
                    `[tutor] Modelo primario (${modelName}) devolvió error antes de emitir texto; conmutando a ${fallbackModel}:`,
                    value.error
                  );
                  fallbackNeeded = true;
                  break;
                }

                buffered.push(value);
                if (value.type === 'text-delta' || value.type === 'error') {
                  hasText = true;
                  console.log(`[tutor] Primer chunk de ${modelName}: ${value.type}`);
                  for (const item of buffered) controller.enqueue(item);
                  buffered.length = 0;
                }
              } else {
                controller.enqueue(value);
              }
            }

            if (!fallbackNeeded || clientCancelled) {
              if (!clientCancelled) {
                for (const item of buffered) controller.enqueue(item);
                controller.close();
              }
              return;
            }
          } catch (err) {
            if (clientCancelled) return;
            if (hasText || modelName === fallbackModel) {
              controller.enqueue({ type: 'error', error: err });
              controller.close();
              return;
            }
            console.warn(
              `[tutor] Modelo primario (${modelName}) falló o superó ${PRIMARY_FIRST_TOKEN_MS}ms; conmutando a ${fallbackModel}:`,
              err
            );
            primaryAbort.abort(err);
            fallbackNeeded = true;
          } finally {
            try {
              primaryReader.releaseLock();
            } catch {
              // Ignorar si ya fue liberado
            }
            if (activeReader === primaryReader) activeReader = null;
            if (activeAbort === primaryAbort) activeAbort = null;
          }

          if (fallbackNeeded && !clientCancelled) {
            console.log(`[tutor] Iniciando stream de respaldo con ${fallbackModel}`);
            const fallbackAbort = new AbortController();
            activeAbort = fallbackAbort;
            const fallbackReader = iniciarStream(fallbackModel, 1, fallbackAbort.signal).getReader();
            activeReader = fallbackReader;
            const fallbackDeadline = Date.now() + FALLBACK_FIRST_TOKEN_MS;
            let fallbackHasText = false;

            try {
              while (!clientCancelled) {
                const { done, value } = await readWithDeadline(
                  fallbackReader,
                  fallbackHasText ? null : fallbackDeadline,
                  'RESPALDO'
                );
                if (done) break;
                if (!fallbackHasText && (value.type === 'text-delta' || value.type === 'error')) {
                  fallbackHasText = true;
                  console.log(`[tutor] Primer chunk de ${fallbackModel}: ${value.type}`);
                }
                controller.enqueue(value);
              }
              if (!clientCancelled) controller.close();
            } catch (err) {
              if (!clientCancelled) {
                fallbackAbort.abort(err);
                controller.enqueue({ type: 'error', error: err });
                controller.close();
              }
            } finally {
              try {
                fallbackReader.releaseLock();
              } catch {
                // Ignorar si ya fue liberado
              }
              if (activeReader === fallbackReader) activeReader = null;
              if (activeAbort === fallbackAbort) activeAbort = null;
            }
          }
        },
        async cancel(reason) {
          clientCancelled = true;
          if (activeAbort) {
            try {
              activeAbort.abort(reason);
            } catch {
              // Ignorar
            }
          }
          if (activeReader) {
            try {
              await activeReader.cancel(reason);
            } catch {
              // Ignorar errores al cancelar lector ya cerrado
            }
          }
        },
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: streamWithFallback,
          onError: (error: unknown) => {
            console.error('[tutor] Error en stream de Gemini:', error);
            if (error instanceof Error && error.message.startsWith('TIMEOUT_')) {
              return 'Google Gemini tardó demasiado en responder en este momento. Por favor, presiona Reintentar.';
            }
            const real = RetryError.isInstance(error) ? error.lastError : error;
            if (APICallError.isInstance(real) && real.statusCode === 429) {
              return 'Se ha alcanzado temporalmente la cuota gratuita de Gemini. Por favor, espera un minuto antes de continuar la conversación.';
            }
            if (APICallError.isInstance(real) && real.statusCode === 503) {
              return 'El servidor de Google Gemini experimenta alta demanda temporal en este momento. Por favor, presiona Reintentar en unos segundos.';
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
