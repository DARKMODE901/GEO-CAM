# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Leonardo Carrillo Caballero
**Semana:** 6  
**Proyecto:** GeoCam – Taller Integrador 2

---

## 1. Prompts Utilizados

- "Necesito solucionar este error" — Acompañado de una captura de pantalla mostrando `CameraView` con `StyleSheet.absoluteFillObject` subrayado en rojo.
- "Implementa los hooks useCamera, useGeoLocation y useShake para una app de cámara con geolocalización en Expo SDK 57."
- "Crea un Context API (GeoPhotosContext) para almacenar las fotos geolocalizadas y compartirlas entre pantallas sin Prop Drilling."
- "Crea un componente PermissionPrimer que muestre un botón 'Conceder permiso' cuando el estado es denied y un botón 'Abrir Ajustes' cuando es blocked."

---

## 2. Código Generado vs. Código Modificado

### useShake.ts
- **¿Qué generó la IA?:** Un hook que se suscribía a `Accelerometer` dentro de `useEffect`, con `setUpdateInterval(100)`, un cooldown de 1500 ms usando `useRef` y cleanup que remueve la suscripción.
- **¿Qué modifiqué/corregí?:** El código generado era funcional. Verifiqué que el umbral de `SHAKE_THRESHOLD = 1.8` fuera adecuado probando en dispositivo físico y ajustando la sensibilidad.

### useCamera.ts
- **¿Qué generó la IA?:** Un hook con `useCameraPermissions()`, `useRef` para la referencia a `CameraView`, `toggleFacing` con `prevState`, y `takePhoto` con manejo de errores.
- **¿Qué modifiqué/corregí?:** La IA importó `expo-intent-launcher` para abrir ajustes en Android, pero ese paquete no estaba instalado en el proyecto. Lo reemplacé por `Linking.openSettings()` de `react-native` que funciona en ambas plataformas sin dependencias adicionales.

### useGeoLocation.ts
- **¿Qué generó la IA?:** Un hook con `watchPositionAsync` dentro de `useEffect`, cleanup que remueve la suscripción, y `getCurrent` para obtener coordenadas puntuales.
- **¿Qué modifiqué/corregí?:** El código generado era correcto. Verifiqué que el cleanup del watcher funcionara correctamente al cambiar de pestaña (monitoreando el consumo de batería).

### GeoPhotosContext.tsx
- **¿Qué generó la IA?:** Un Provider con `addPhoto` usando spread (`[photo, ...prev]`), `removePhoto` con `filter`, y `clearAll`. Todas las mutaciones usan inmutabilidad.
- **¿Qué modifiqué/corregí?:** El código estaba correcto. Solo verifiqué que las fotos nuevas aparecieran al inicio del array (prepend) y no al final.

### app-tabs.tsx (Navegación nativa)
- **¿Qué generó la IA?:** Tabs de Cámara y Mapa usando solo `NativeTabs.Trigger.Label` sin `NativeTabs.Trigger.Icon`.
- **¿Qué modifiqué/corregí?:** Los tabs sin ícono no se renderizaban en Android. Tuve que generar archivos PNG de ícono y agregar `NativeTabs.Trigger.Icon` a cada tab para que aparecieran correctamente.

### mapa.tsx (Integración de Mapa)
- **¿Qué generó la IA?:** Modificó la pantalla de la galería de fotos para incluir una imagen de OpenStreetMap usando la API estática (`staticmap.openstreetmap.de`) pasándole latitud y longitud. También implementó una función para abrir el mapa interactivo en el navegador al tocar la imagen usando `Linking.openURL()`.
- **¿Qué modifiqué/corregí?:** Durante el proceso de integración, el entorno local de VS Code sobrescribió el código nuevo con una versión antigua porque el archivo había quedado abierto en el editor ("The content of the file is newer"). Tuve que cerrar el archivo sin guardar (`Don't Save`) y pedir a la IA que reescribiera el código completo del componente.

---

## 3. Alucinaciones o Errores Detectados

- **`StyleSheet.absoluteFillObject`** — La IA usó `StyleSheet.absoluteFillObject` en `geocam.tsx`, pero en React Native 0.86 la propiedad correcta es `StyleSheet.absoluteFill`. TypeScript lo marcó como error.

- **`expo-intent-launcher`** — La IA importó `import * as IntentLauncher from 'expo-intent-launcher'` en `useCamera.ts`, pero ese paquete no estaba instalado en el proyecto ni era necesario. Se reemplazó por `Linking.openSettings()`.

- **Tabs nativos sin ícono** — La IA creó tabs en `app-tabs.tsx` solo con `Label` y sin `Icon`. En Android, `NativeTabs` requiere un ícono PNG para renderizar cada pestaña. Los tabs de Cámara y Mapa no aparecían hasta agregar los íconos.

- **Solo actualizó el archivo nativo** — La IA modificó `app-tabs.tsx` pero olvidó que Expo usa `app-tabs.web.tsx` para la versión web. Los tabs de Cámara y Mapa no aparecían en el navegador hasta actualizar ambos archivos.


---

# Registro de Auditoría de IA – Semana 7

**Estudiante(s):** Leonardo Carrillo Caballero  
**Semana:** 7  
**Proyecto:** GeoCam Persistente (Base de Datos Local Offline-First con Drizzle ORM y SQLite)

---

## 1. Prompts Utilizados

- *"Implementa la persistencia offline de GeoCam utilizando expo-sqlite, Drizzle ORM y expo-file-system siguiendo la arquitectura estricta de 5 capas."*
- *"Genera el esquema type-safe con Drizzle para álbumes y fotos con foreign keys y genera dos migraciones SQL (la segunda añadiendo notes y isFavorite)."*
- *"Crea el servicio photoStorage para migrar las imágenes físicas de la caché al directorio permanente FileSystem.documentDirectory."*
- *"Crea los repositorios photoRepository y albumRepository y hooks reactivos con useLiveQuery de Drizzle para la UI."*

---

## 2. Código Generado vs. Código Modificado

### Esquema Drizzle y Migraciones (`src/db/schema.ts`, `src/drizzle/`)
- **¿Qué generó la IA?:** Esquema con tablas `albums` y `photos`, definiendo tipos inferidos (`Photo`, `NewPhoto`, `Album`, `NewAlbum`) y relaciones de Drizzle. Se ejecutó `drizzle-kit generate` dos veces creando:
  1. `0000_init_albums_and_photos.sql` (tablas base con llave foránea y `ON DELETE set null`).
  2. `0001_add_notes_and_favorites.sql` (adición de `notes` y `is_favorite DEFAULT 0`).
- **¿Qué modifiqué/corregí?:** Verifiqué que `drizzle.config.ts` utilizara `dialect: 'sqlite'` y `driver: 'expo'`, y que `src/types/declarations.d.ts` declarara los módulos `.sql` para que el compilador de TypeScript los reconozca sin errores.

### Conexión SQLite y Runtime Migrator (`src/db/client.ts`, `src/app/_layout.tsx`)
- **¿Qué generó la IA?:** Instancia de base de datos con `openDatabaseSync('geocam.db', { enableChangeListener: true })`, ejecución de `PRAGMA foreign_keys = ON;`, e integración de `useMigrations(db, migrations)` en el layout raíz.
- **¿Qué modifiqué/corregí?:** Verifiqué que la pantalla muestre un indicador de carga durante la migración y capture errores con tipado estricto.

### Almacenamiento Físico (`src/services/photoStorage.ts`)
- **¿Qué generó la IA?:** Funciones `savePhotoPermanently`, `deletePhysicalPhoto` y `deleteAllPhysicalPhotos` que copian las fotos desde la caché temporal a `FileSystem.documentDirectory` antes de registrar su ruta en SQLite.
- **¿Qué modifiqué/corregí?:** En Expo SDK 57, la API clásica con `documentDirectory` y `copyAsync` se encuentra bajo `expo-file-system/legacy`. Se corrigió la importación para garantizar 100% de compatibilidad con TypeScript.

### Repositorios y Hooks Reactivos (`src/repositories/`, `src/hooks/`)
- **¿Qué generó la IA?:** `photoRepository` y `albumRepository` (Capa 3) separando totalmente el SQL de la UI. Hooks `useGeoPhotosDB` y `useAlbumsDB` (Capa 2) utilizando `useLiveQuery` de Drizzle para reactividad instantánea.
- **¿Qué modifiqué/corregí?:** Se adaptó `GeoPhotosContext.tsx` como puente de arquitectura para exponer las nuevas funciones a las pantallas sin alterar la degradación elegante existente.

---

## 3. Alucinaciones o Errores Detectados / Evitados

- **Driver de servidor evitado:** Se evitó el uso erróneo de `drizzle-orm/better-sqlite3`, empleando exclusivamente `drizzle-orm/expo-sqlite`.
- **API obsoleto evitado:** No se usó `SQLite.openDatabase`, sino la API moderna síncrona `openDatabaseSync`.
- **Foreign keys activadas:** Se añadió `expoDb.execSync('PRAGMA foreign_keys = ON;');` inmediatamente tras la apertura de la base de datos.
- **`drizzle-kit push` evitado:** Se generaron migraciones versionadas en archivos `.sql` aplicadas en el dispositivo mediante el hook `useMigrations`.
- **Expo SDK 57 FileSystem API:** En SDK 57 `expo-file-system` reestructuró sus exportaciones principales. El uso de `expo-file-system/legacy` permitió mantener la API `documentDirectory` compatible sin errores de TypeScript.

---

# Registro de Auditoría de IA – Semana 8

**Estudiante(s):** Leonardo Carrillo Caballero  
**Semana:** 8  
**Proyecto:** GeoCam Cloud Backup (Backend as a Service con Supabase: Auth, PostgreSQL + RLS, Storage Privado y Realtime)

---

## 1. Prompts Utilizados

- *"Implementa la integración completa de Supabase en GeoCam conectando Auth, PostgreSQL con RLS, Storage privado y Realtime, manteniendo SQLite y Drizzle como fuente de verdad local offline."*
- *"Crea el adaptador por fragmentos en `src/lib/secureStorage.ts` sobre `expo-secure-store` para evitar el límite de 2048 bytes en sesiones de autenticación."*
- *"Genera la migración 3 de Drizzle (`0002_add_sync_fields.sql`) agregando client_id, updated_at, remote_path, synced_at y owner_id sin romper la persistencia de Semana 7."*
- *"Implementa el servicio `cloudPhotos.ts` usando ArrayBuffer para la subida de imágenes físicas y upsert de metadatos con signed URLs para el bucket privado."*
- *"Crea la pestaña Nube (`nube.tsx`) con suscripción Realtime y limpieza estricta del canal en el desmontaje del componente."*
- *"Añade badges de sincronización (`☁️✓ Nube`, `☁️⬆️ Pendiente`, `📱 Local`) y botón de sincronización masiva con progreso en `mapa.tsx`."*

---

## 2. Código Generado vs. Código Modificado

### Almacenamiento Seguro por Fragmentos (`src/lib/secureStorage.ts`)
- **¿Qué generó la IA?:** Un adaptador compatible con la interfaz de almacenamiento de `@supabase/supabase-js`, dividiendo los datos en bloques de `CHUNK_SIZE = 1000` bytes para `expo-secure-store`.
- **¿Qué modifiqué/corregí?:** Verifiqué que `removeItem` limpiara todos los fragmentos `_chunk_i` y el contador `_chunk_count` para evitar dejar fragmentos huérfanos al cerrar sesión.

### Cliente de Supabase (`src/lib/supabase.ts`)
- **¿Qué generó la IA?:** Inicialización con `createClient` utilizando `process.env.EXPO_PUBLIC_SUPABASE_URL` y `process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, almacenamiento `secureStorage`, `autoRefreshToken: true`, `detectSessionInUrl: false` y listener de `AppState` para pausar y reanudar el refresco de tokens.
- **¿Qué modifiqué/corregí?:** Se verificó que ninguna clave de rol de servicio (`service_role`) fuera incluida en el código del cliente.

### Contexto de Autenticación y Pantalla de Acceso (`src/context/AuthContext.tsx`, `src/app/login.tsx`)
- **¿Qué generó la IA?:** `AuthProvider` utilizando la API v2 de Supabase (`getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`) y pantalla `login.tsx` con soporte para login y registro con tema oscuro nativo.
- **¿Qué modifiqué/corregí?:** Para la navegación protegida, en lugar de invocar `router.replace()`, se aplicó un renderizado condicional declarativo en `src/app/_layout.tsx` que muestra `LoginScreen` directamente cuando no hay sesión activa.

### Migración Incremental Local (`src/drizzle/0002_add_sync_fields.sql`, `src/db/schema.ts`)
- **¿Qué generó la IA?:** Archivo SQL de migración añadiendo columnas `client_id`, `updated_at`, `remote_path`, `synced_at` y `owner_id`. Se registró en `_journal.json` y `migrations.js`.
- **¿Qué modifiqué/corregí?:** Se preservó intacta la carpeta `drizzle/` existente de Semana 7 para evitar el error `table photos already exists` en clientes existentes.

### Servicio de Fotos en la Nube (`src/services/cloudPhotos.ts`)
- **¿Qué generó la IA?:** Funciones `uploadPhoto`, `upsertPhotoMetadata`, `fetchRemotePhotos`, `getSignedUrl` y `deleteCloudPhoto`.
- **¿Qué modifiqué/corregí?:** Se aseguró el uso de `ArrayBuffer` mediante `await (await fetch(localUri)).arrayBuffer()` en lugar de `Blob` o `FormData`, garantizando que no se suban archivos vacíos de 0 bytes en React Native.

### Pestaña Nube y Realtime (`src/app/nube.tsx`, `src/components/app-tabs.tsx`)
- **¿Qué generó la IA?:** Pantalla de galería remota con URLs firmadas (para el bucket privado `geocam`), refresco con `RefreshControl` y canal de Realtime escuchando eventos `postgres_changes` en `public.photos`.
- **¿Qué modifiqué/corregí?:** Se añadió `supabase.removeChannel(channel)` en la función de limpieza del `useEffect` para evitar fugas de memoria y reconexiones duplicadas.

---

## 3. Alucinaciones o Errores Detectados / Evitados (Reglas de Oro Semana 8)

1. **Evitar claves secretas en el cliente:** Solo se utilizaron variables públicas `EXPO_PUBLIC_*`. Se aseguró la presencia de `.env` en `.gitignore` y se suministró `.env.example`.
2. **Evitar AsyncStorage y SecureStore directo:** Se implementó `secureStorage.ts` con fragmentación de 1000 bytes para solventar la limitación de 2048 bytes de iOS Keychain y Android KeyStore.
3. **Evitar métodos obsoletos de Supabase:** Se emplearon exclusivamente métodos de Supabase JS v2 (`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`).
4. **Evitar `router.replace()` para navegación de autenticación:** La navegación de login se gestiona de forma reactiva y declarativa dentro de `_layout.tsx`.
5. **Evitar `Blob` y `FormData` en subidas nativas:** En React Native `Blob` genera archivos corruptos de 0 bytes en Supabase Storage; se utilizó estrictamente `ArrayBuffer`.
6. **Ruta estricta de Storage:** Las imágenes se guardan bajo `${userId}/${photo.clientId}.jpg` en el bucket privado `'geocam'`, coincidiendo con las políticas RLS.
7. **Integridad de migraciones Drizzle:** Se generó la migración 3 de forma incremental sin borrar la carpeta `drizzle/` ni regenerar las migraciones 1 y 2.
8. **Limpieza estricta de canales Realtime:** Limpieza garantizada en el retorno de `useEffect` con `supabase.removeChannel(channel)`.
9. **Expresiones no constantes en `ALTER TABLE` de SQLite en Android:** En Android, el motor nativo de SQLite rechaza expresiones dinámicas como `DEFAULT (lower(hex(randomblob(16))))` al añadir columnas con `ALTER TABLE ADD COLUMN`. Se corrigió utilizando el valor literal constante `DEFAULT ''` en `0002_add_sync_fields.sql` y delegando la asignación de UUIDs a la capa de aplicación mediante `photoRepository.ensureSyncFields()` y `Crypto.randomUUID()`.

---

# Registro de Auditoría de IA – Semana 9

**Estudiante(s):** Leonardo Carrillo Caballero  
**Semana:** 9  
**Proyecto:** GeoCam Sync Engine (Offline-First Bidireccional, Soft Deletes, Cursor Pagination y TanStack Query v5)

---

## 1. Prompts Utilizados

- *"Actualiza GeoCam a una arquitectura Offline-First completa con sincronización bidireccional secuencial (Pull luego Push), tabla SQLite `sync_meta`, borrados lógicos sincronizados, paginación por cursor y TanStack Query v5 con persistencia offline."*
- *"Implementa `useSync` con `refetchOnReconnect: 'always'`, `refetchOnWindowFocus: 'always'`, conexión de `expo-network` con `onlineManager` y `AppState` con `focusManager`."*
- *"Implementa el muro remoto `usePostsFeed` con `useInfiniteQuery`, `initialPageParam`, búsqueda debounced y scroll infinito verificando `hasNextPage && !isFetchingNextPage`."*
- *"Crea un Monitor de Estado de Sincronización UI que lea `sync_meta`, muestre pendientes, errores aislados por fila y permita forzar la sincronización manualmente."*

---

## 2. Código Generado vs. Código Modificado

### Migraciones Local y Remota (`0003_add_sync_meta_and_deleted_at.sql`, `supabase/migrations_sync_v2.sql`)
- **¿Qué generó la IA?:** Añadió `deleted_at` a la tabla SQLite `photos` y creó la tabla `sync_meta` (`key` text PK, `value` text) junto con sus índices, además del script idempotente de PostgreSQL con la columna `server_updated_at`, trigger automático `trg_photos_server_updated_at`, índice compuesto `(user_id, server_updated_at)` y políticas RLS `for update to authenticated`.
- **¿Qué modifiqué/corregí?:** Verifiqué que `0003_add_sync_meta_and_deleted_at.sql` también se incrustara en `src/drizzle/migrations.js` (`m0003`) para evitar problemas de caché en Metro con `babel-plugin-inline-import` al desplegar en dispositivos físicos.

### Motor de Sincronización y Conflictos (`syncService.ts`, `syncConflicts.ts`, `photoRepository.ts`)
- **¿Qué generó la IA?:** El ciclo mutex secuencial `Pull -> Push`:
  1. `Pull`: solicita cambios ordenados ASC por `server_updated_at > cursor` (lotes de 200), descarga el binario local con `FileSystem.downloadAsync` sobre Signed URL si es nuevo, compara conflictos con la función pura `remoteWins(localUpdatedAt, remoteUpdatedAt)` y avanza el cursor en `sync_meta` fila por fila.
  2. `Push`: procesa elementos pendientes (`syncedAt === null || syncedAt < updatedAt`, incluidos tombstones `deletedAt !== null`) en bloques `try/catch` independientes por fila, usando `.upsert(..., { onConflict: 'client_id' })` y `markSynced` con el `updatedAt` exacto subido.
- **¿Qué modifiqué/corregí?:** Ajusté `markSynced` para aceptar `remotePath: string | null` cuando una foto es borrada localmente antes de haberse subido jamás a Storage, evitando guardar cadenas vacías `''` en SQLite.

### TanStack Query v5 y Hooks Reactivos (`queryClient.ts`, `useSync.ts`, `usePostsFeed.ts`, `useGeoPhotosDB.ts`)
- **¿Qué generó la IA?:** Configuración central v5 (`gcTime`, `onlineManager`, `focusManager`), persistencia en SQLite (`expo-sqlite/kv-store`), hook automático `useSync`, feed por cursor `usePostsFeed` e invalidación explícita `['sync']` en cada mutación local.
- **¿Qué modifiqué/corregí?:**
  - En `useGeoPhotosDB.ts`, me aseguré de invocar `void queryClient.invalidateQueries({ queryKey: ['sync'] })` sin bloquear con `await` la respuesta local de las mutaciones, garantizando que la cámara, notas y favoritos respondan instantáneamente desde SQLite aunque la red esté lenta.
  - En `AuthContext.tsx`, añadí `clearPersistedQueryCache()` en `signOut()` para evitar filtrar datos en caché persistente al cambiar de cuenta.

### Interfaz de Usuario y Monitor de Estado (`SyncMonitorModal.tsx`, `nube.tsx`, `mapa.tsx`)
- **¿Qué generó la IA?:** Pantalla/Modal de Monitor de Sincronización en tiempo real consumiendo `sync_meta` y `photos` vía `useLiveQuery`, feed remoto con búsqueda debounced, banner offline y botones interactivos de monitoreo.
- **¿Qué modifiqué/corregí?:**
  - Reemplacé el borrado directo en `nube.tsx` y `mapa.tsx` por borrado lógico sincronizado (`deletedAt`) con confirmación preventiva en borrado masivo.
  - Desacoplé completamente las pantallas de `src/app/` de Drizzle y Supabase: las migraciones de SQLite pasaron a `useDatabaseMigrations.ts`, la suscripción Realtime a `usePhotosRealtime.ts`, los tipos compartidos a `src/types/geo.ts` (`GeoAlbum`, `RemotePhotoFeedItem`), y el borrado en la nube a `deleteFeedPhoto()` (`syncService.ts` / `GeoPhotosContext.tsx`).
  - Añadí estados explícitos con botón **Reintentar** en `nube.tsx` tanto en el banner de error (cuando hay caché previa) como en la vista de error completa y de pantalla vacía/sin conexión.

---

## 3. Alucinaciones o Errores Detectados / Evitados

1. **Importación incorrecta de tipo `OmitKeyof` en `@tanstack/react-query-persist-client`:** El compilador `tsc --noEmit` detectó `TS2305` porque `OmitKeyof` pertenece a `@tanstack/react-query` y no al paquete persister. Se corrigió tipando `persistOptions` con `PersistQueryClientProviderProps['persistOptions']`.
2. **Incompatibilidad `string | null` en `SyncCycleResult.cursor`:** `tsc` reportó que `syncSinglePhotoWithPullFirst` propagaba `SyncResultMetadata['cursor']` (`string | null`) sobre `SyncCycleResult['cursor']` (`string`). Se pasó explícitamente `cursor: pullRes.cursor`.
3. **Regla Android `NativeTabs` (máximo 5 pestañas):** En lugar de añadir una sexta pestaña en `app-tabs.tsx` (lo cual excede el límite de 5 ítems de `BottomNavigationView` en Android y habría provocado crash), se integró el Monitor de Estado de Sincronización mediante `SyncMonitorModal` accesible directamente desde las barras de estado de `mapa.tsx` y `nube.tsx`.
4. **Uso estricto de v5 y paginación segura:** Se verificó mediante auditoría estática la ausencia de `cacheTime`, `status === 'loading'`, `.range()` y comandos SQL `DELETE` directos sobre fotos en todo `src/`.
5. **Fuga de capas en pantallas (`src/app/`) y error RLS por cambio de cuenta:** Se detectó que `nube.tsx`, `explore.tsx` y `_layout.tsx` importaban símbolos de `supabase`, `cloudPhotos`, `photoRepository` o `@/db/schema`; además, una fila heredada sin `owner_id` de otra cuenta podía quedar mezclada y fallar en RLS durante un `Push` tras cambiar de usuario. Se aisló la capa de UI de Supabase/Drizzle y se fortaleció `photoRepository.ensureSyncFields()` para inferir y completar el `owner_id` desde el prefijo UUID de `remote_path` cuando falta.



