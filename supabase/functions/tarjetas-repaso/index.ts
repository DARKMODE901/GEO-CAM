// supabase/functions/tarjetas-repaso/index.ts
// Supabase Edge Function: Generación de salida estructurada (Tarjetas de Repaso C3)
// Utiliza estrictamente generateText junto con output: Output.object({ schema }) validado con Zod

import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import {
  generateText,
  Output,
  convertToModelMessages,
  type UIMessage,
} from 'npm:ai@7';
import { z } from 'npm:zod@3';

const TarjetasSchema = z.object({
  tarjetas: z
    .array(
      z.object({
        pregunta: z.string().describe('Pregunta de estudio concisa y reflexiva'),
        respuesta: z.string().describe('Respuesta didáctica, clara y verificada'),
      })
    )
    .min(3)
    .max(5),
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

      // C5: Control de límite diario en Supabase
      const userId = ctx.userClaims?.sub;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'No autorizado: usuario no identificado.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const limiteDiario = Number(Deno.env.get('LIMITE_DIARIO') ?? 20);
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count, error: countErr } = await ctx.supabase
        .from('uso_ia')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hace24Horas);

      if (countErr) {
        console.error('[tarjetas-repaso] Error consultando conteo de uso_ia:', countErr);
      } else if (count !== null && count >= limiteDiario) {
        return new Response(
          JSON.stringify({
            error: 'Vuelve mañana',
            message: 'Has alcanzado tu límite diario de consultas con IA.',
            limit: limiteDiario,
            used: count,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Registrar uso en uso_ia
      await ctx.supabase.from('uso_ia').insert({
        user_id: userId,
        funcion: 'tarjetas-repaso',
      });

      const body = await req.json();
      const messages: UIMessage[] = body.messages ?? [];

      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Se requiere al menos un mensaje para generar tarjetas.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // En Vercel AI SDK v7: generateText + output: Output.object({ schema })
      const { output } = await generateText({
        model: google(modelName),
        instructions:
          'Eres el Tutor Pedagógico de GeoCam. Analiza la conversación proporcionada y genera entre 3 y 5 tarjetas de repaso (pregunta y respuesta breve) para consolidar los conocimientos geográficos, culturales o ambientales tratados.',
        messages: await convertToModelMessages(messages.slice(-20)),
        output: Output.object({
          schema: TarjetasSchema,
        }),
        temperature: 0.3,
        maxRetries: 1,
      });

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.error('[tarjetas-repaso] Error en handler:', err);
      return new Response(
        JSON.stringify({ error: err?.message || 'Error al generar tarjetas con Gemini.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  })
);
