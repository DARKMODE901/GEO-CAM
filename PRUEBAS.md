# Matriz de Pruebas y Validación – Semana 10 (Tag v2.0.0)

**Proyecto:** GeoCam – Asistente IA Multimodal, Proxy Seguro con Supabase Edge Functions y Vercel AI SDK v7  
**Fecha:** 16 de noviembre de 2026  
**Autores / Equipo de Desarrollo:** Leonardo Carrillo, Edgar Zúñiga y Deivis Magdaniel  

---

## 1. Resumen Ejecutivo de Validación

La versión **v2.0.0** de GeoCam integra inteligencia artificial multimodal a través de una arquitectura de **Proxy Seguro**, garantizando que la aplicación móvil nunca exponga secretos de API ni dependa de endpoints de IA sin autenticación previa.

Todas las pruebas fueron ejecutadas sobre **React Native 0.88 / Expo SDK 58** con el motor **Hermes**, validando la persistencia offline en SQLite (Drizzle ORM), la sincronización bidireccional con Supabase y el procesamiento de lenguaje natural y visión artificial con **Google Gemini (`gemini-3.8-flash`)**.

---

## 2. Matriz de Escenarios de Prueba

| ID | Escenario de Prueba | Procedimiento / Entrada | Comportamiento Esperado | Resultado |
| :--- | :--- | :--- | :--- | :---: |
| **EP-01** | **Auditoría de Seguridad: Ausencia de `AIza` en Bundle y Código** | Ejecutar escaneo estático exhaustivo con `git grep "AIza"` y búsqueda en archivos de configuración (`.env`, `.env.example`, bundles compilados). | Cero coincidencias. Ninguna clave de Gemini o cadena que empiece por `AIza` está presente en el cliente. Solo se permiten `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. | **PASS** ✅ |
| **EP-02** | **Arquitectura Proxy y Autenticación de Edge Functions** | Petición a Supabase Edge Function (`/tutor`, `/describir-foto`, `/tarjetas-repaso`) sin cabecera `Authorization` o con token corrupto. | El wrapper `withSupabase({ auth: 'user' })` rechaza inmediatamente la petición con estado HTTP `401 Unauthorized` sin contactar la API de Gemini. | **PASS** ✅ |
| **EP-03** | **Modo Avión / Sin Conexión en Chat ("Tutor IA")** | Activar modo avión en el dispositivo. Abrir la pestaña del Tutor IA. Intentar enviar una consulta o adjuntar una foto. | Se muestra un banner ámbar superior de aviso offline. El campo y botón de envío quedan deshabilitados o advierten al usuario. No se producen bloqueos ni crashes. | **PASS** ✅ |
| **EP-04** | **Control de Límite Diario en Supabase (Rate Limiting C5)** | Realizar múltiples consultas consecutivas hasta superar el límite configurado (`LIMITE_DIARIO` o 20 consultas en 24h). | La Edge Function consulta `uso_ia` con RLS del usuario, detecta que `count >= limit`, y responde de inmediato con HTTP `429 Too Many Requests` y JSON `{ error: 'Vuelve mañana' }` sin consumir cuota de Google. La app muestra aviso claro de límite diario. | **PASS** ✅ |
| **EP-05** | **Sesión Vencida (Token JWT Expirado - C4)** | Simular expiración o revocación del token de sesión mientras se utiliza el chat interactivo. | La Edge Function responde 401; el handler `onError` de `useChat` en la app detecta el código 401, emite alerta informativa y ejecuta `supabase.auth.signOut()` redirigiendo automáticamente a la pantalla de Login. | **PASS** ✅ |
| **EP-06** | **Chat en Streaming con Vercel AI SDK v7 y Botón de Detener** | Enviar una pregunta amplia al Tutor IA con conexión activa. | La respuesta crece palabra por palabra en tiempo real (`status === 'streaming'`). Durante la generación, el botón de enviar se convierte en un botón rojo de detención (ícono cuadrado) que aborta la transmisión inmediatamente con `stop()`. | **PASS** ✅ |
| **EP-07** | **Persistencia del Historial de Chat en SQLite (C1)** | Conversar con el Tutor IA, cerrar completamente la aplicación (force close) y volver a abrir la pestaña del Tutor. Probar botón "Nueva conversación". | Los mensajes se recuperan intactos desde la tabla SQLite `chat_messages`. Al presionar el botón "Nueva conversación", se solicita confirmación, se limpia el estado en memoria y se purga la tabla en SQLite. | **PASS** ✅ |
| **EP-08** | **Perfil de Usuario Dinámico y Validación con Zod (C2)** | Configurar en el modal de perfil: Nombre "Leo", Tema "Geología", Nivel "Avanzado". Enviar una pregunta. | El transporte envía `{ perfil }` en el cuerpo. La Edge Function valida con Zod (`.catch()`) e inyecta dinámicamente las instrucciones (`instructions`) adaptando la profundidad y vocabulario de Gemini. | **PASS** ✅ |
| **EP-09** | **Salida Estructurada: Tarjetas de Repaso (C3)** | Tras dialogar sobre un tema geográfico, pulsar el botón "✨ Tarjetas de Repaso". | La Edge Function ejecuta `generateText` con `output: Output.object({ schema })`. Retorna entre 3 y 5 flashcards validadas con Zod. La app las muestra en un modal interactivo donde el usuario toca cada tarjeta para voltearla y revelar la respuesta. | **PASS** ✅ |
| **EP-10** | **Taller "GeoCam Ve": Visión Multimodal y Reducción de Imágenes** | En el detalle de una foto de la galería (o capturada en la cámara), presionar "Describir con IA". | La foto local se comprime en el teléfono a 1024 px JPEG 0.7 (&lt; 300 KB). Se invoca `describir-foto` mostrando un spinner y el aviso "La foto se envía a Google Gemini". La descripción se inyecta en un `TextInput` editable y al guardar se sella `updatedAt` para sincronización Pull/Push. | **PASS** ✅ |
| **EP-11** | **Polyfills de Hermes (React Native)** | Iniciar la app en un dispositivo Android/iOS con motor Hermes habilitado. | `structuredClone`, `TextEncoderStream` y `TextDecoderStream` funcionan sin excepciones de símbolo no definido gracias a `src/polyfills.ts` cargado en la primera línea de `src/app/_layout.tsx`. | **PASS** ✅ |
| **EP-12** | **Límite de Pestañas Android `NativeTabs`** | Verificar el número total de pestañas en `app-tabs.tsx`. | Se tienen exactamente 5 pestañas (Cámara, Mapa, Álbumes, Nube, Tutor IA). No se excede el límite de 5 de `BottomNavigationView`, previniendo crashes nativos en Android. | **PASS** ✅ |

---

## 3. Detalle de Ejecución de Pruebas Clave

### 3.1. Prueba de Ausencia de Claves `AIza` (Seguridad)
Comando ejecutado en consola:
```powershell
git grep "AIza"
```
*Resultado:* Retorno código 1 (sin coincidencias). La cadena `AIza` no existe en ningún archivo del código fuente ni del repositorio.

### 3.2. Prueba de Tipos TypeScript
Comando ejecutado en consola:
```powershell
npx tsc --noEmit
```
*Resultado:* Código de salida 0. Cero errores de TypeScript en toda la aplicación.

### 3.3. Prueba de Migración de Base de Datos Local
Comando ejecutado:
```powershell
npm run db:generate
```
*Resultado:* Generación exitosa de `0004_minor_colossus.sql` con sintaxis estricta `ALTER TABLE photos ADD ai_description text;` y `CREATE TABLE IF NOT EXISTS chat_messages (...)`, preservando intactos los registros y snapshots de migraciones anteriores.
