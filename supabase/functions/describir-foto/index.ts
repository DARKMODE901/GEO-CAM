// supabase/functions/describir-foto/index.ts
// Supabase Edge Function: Describe fotos usando Gemini y Vercel AI SDK v7 (generateText)
// No usa streaming: responde un JSON { descripcion: string }

import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import { generateText } from 'npm:ai@7';

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
        console.error('[describir-foto] Error consultando conteo de uso_ia:', countErr);
      } else if (count !== null && count >= limiteDiario) {
        return new Response(
          JSON.stringify({
            error: 'Vuelve mañana',
            message: 'Has alcanzado tu límite diario de consultas con IA. Vuelve mañana.',
            limit: limiteDiario,
            used: count,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Registrar uso en uso_ia
      await ctx.supabase.from('uso_ia').insert({
        user_id: userId,
        funcion: 'describir-foto',
      });

      const body = await req.json();
      const rawImage = body.imageBase64 || body.image || '';

      if (!rawImage || typeof rawImage !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Parámetro imageBase64 requerido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Limpiar prefijo data:image/...;base64, si viene incluido
      const cleanBase64 = rawImage.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();

      const { text } = await generateText({
        model: google(modelName),
        instructions:
          'Eres un asistente de visión para GeoCam. Describe brevemente la foto en 1 o 2 frases concisas en español neutro, destacando elementos geográficos, urbanos o naturales destacados.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe esta fotografía en 1 o 2 frases breves y precisas.' },
              {
                type: 'file',
                mediaType: 'image/jpeg',
                data: cleanBase64,
              },
            ],
          },
        ],
        temperature: 0.3,
        maxRetries: 1,
        maxOutputTokens: 256,
      });

      return new Response(
        JSON.stringify({ descripcion: text.trim() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      console.error('[describir-foto] Error en handler:', err);
      return new Response(
        JSON.stringify({ error: err?.message || 'Error al procesar la imagen con Gemini.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  })
);
