// src/app/index.tsx
// Redirige automáticamente a la pantalla de cámara al abrir la app
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/geocam" />;
}
