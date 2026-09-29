# 🤖 AI-LOG.md — Semana 6

## Registro de uso de IA en el desarrollo de GeoCam

### Fecha: Septiembre 2026

---

## Herramientas de IA utilizadas

| Herramienta | Uso principal |
|---|---|
| **Google Antigravity (AGY)** | Asistente de codificación para generar hooks, componentes y configuración del proyecto |

---

## Actividades asistidas por IA

### 1. Generación de Custom Hooks
- **`useCamera.ts`** — Se generó la estructura del hook con manejo de permisos (`PermissionState`), referencia a `CameraView` con `useRef`, función `takePhoto` y `toggleFacing` con `prevState`.
- **`useGeoLocation.ts`** — Se generó el hook con `watchPositionAsync`, cleanup del watcher, y función `getCurrent` para obtener coordenadas puntuales.
- **`useShake.ts`** — Se generó el hook con `Accelerometer` de `expo-sensors`, cooldown con `useRef` y cleanup de la suscripción.

### 2. Generación de Context API
- **`GeoPhotosContext.tsx`** — Se generó el Provider con funciones `addPhoto`, `removePhoto` y `clearAll` usando inmutabilidad con spread operator.

### 3. Generación de tipos TypeScript
- **`geo.ts`** — Se generaron las interfaces `Coords`, `GeoPhoto`, `PermissionState` y `PhotoSource`.

### 4. Componentes UI
- **`PermissionPrimer.tsx`** — Se generó el componente para mostrar la solicitud de permisos con dos estados: denegado (botón "Conceder permiso") y bloqueado (botón "Abrir Ajustes").

### 5. Configuración de navegación
- **`app-tabs.tsx`** y **`app-tabs.web.tsx`** — Se configuraron las pestañas de navegación para incluir Cámara, Mapa y Explorar.
- **`_layout.tsx`** — Se envolvió la app con `GeoPhotosProvider`.

### 6. Pantallas
- **`geocam.tsx`** — Pantalla de cámara con overlay de coordenadas, banner de ubicación y controles.
- **`mapa.tsx`** — Galería de fotos en grid con coordenadas y badges de fuente.

### 7. Corrección de errores
- `StyleSheet.absoluteFillObject` → `StyleSheet.absoluteFill` (API actualizada en RN 0.86).
- Eliminación de `expo-intent-launcher` no instalado, reemplazado por `Linking.openSettings()`.
- Configuración de tabs web (`app-tabs.web.tsx`) que faltaba actualizar.

---

## Revisión y modificaciones manuales

- Se verificó el funcionamiento en dispositivo físico con Expo Go.
- Se tomaron capturas de pantalla de los 3 estados de permiso (concedido, rechazado, bloqueado).
- Se probó la funcionalidad de shake para borrar fotos.
- Se validó que las coordenadas GPS se muestran en tiempo real.
- Se confirmó la degradación elegante cuando se niega el permiso de ubicación.

---

## Lecciones aprendidas

1. **Permisos en contexto** — Es mejor UX solicitar permisos cuando el usuario necesita la funcionalidad, no al inicio de la app.
2. **Cleanup en useEffect** — Todo efecto con suscripciones (GPS watcher, acelerómetro, intervalos) debe incluir su función de limpieza.
3. **useRef vs useState** — Para datos que no necesitan re-render (IDs de intervalos, timestamps de cooldown), `useRef` es más eficiente.
4. **Archivos `.web.tsx`** — Expo usa archivos con sufijo `.web.tsx` para la versión web, separados de los nativos `.tsx`.
