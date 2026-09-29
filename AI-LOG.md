# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Leonardo Peña  
**Semana:** 6  
**Proyecto:** GeoCam – Taller Integrador 2

---

## 1. Prompts Utilizados

- "Necesito solucionar este error" — Acompañado de una captura de pantalla mostrando `CameraView` con `StyleSheet.absoluteFillObject` subrayado en rojo.
- "Implementa los hooks useCamera, useGeoLocation y useShake para una app de cámara con geolocalización en Expo SDK 57."
- "Crea un Context API (GeoPhotosContext) para almacenar las fotos geolocalizadas y compartirlas entre pantallas sin Prop Drilling."
- "Crea un componente PermissionPrimer que muestre un botón 'Conceder permiso' cuando el estado es denied y un botón 'Abrir Ajustes' cuando es blocked."
- "Los botones de abajo no aparecen, las opciones de Cámara y Mapa no se visualizan en los tabs nativos."

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

---

## 3. Alucinaciones o Errores Detectados

- **`StyleSheet.absoluteFillObject`** — La IA usó `StyleSheet.absoluteFillObject` en `geocam.tsx`, pero en React Native 0.86 la propiedad correcta es `StyleSheet.absoluteFill`. TypeScript lo marcó como error.

- **`expo-intent-launcher`** — La IA importó `import * as IntentLauncher from 'expo-intent-launcher'` en `useCamera.ts`, pero ese paquete no estaba instalado en el proyecto ni era necesario. Se reemplazó por `Linking.openSettings()`.

- **Tabs nativos sin ícono** — La IA creó tabs en `app-tabs.tsx` solo con `Label` y sin `Icon`. En Android, `NativeTabs` requiere un ícono PNG para renderizar cada pestaña. Los tabs de Cámara y Mapa no aparecían hasta agregar los íconos.

- **Solo actualizó el archivo nativo** — La IA modificó `app-tabs.tsx` pero olvidó que Expo usa `app-tabs.web.tsx` para la versión web. Los tabs de Cámara y Mapa no aparecían en el navegador hasta actualizar ambos archivos.
